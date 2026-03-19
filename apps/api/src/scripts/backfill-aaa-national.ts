#!/usr/bin/env tsx
/**
 * AAA National Averages Backfill
 *
 * Computes daily USA-wide national average gas prices from existing
 * per-state AAA data in the energy_prices table, then upserts into
 * aaa_national_averages.
 *
 * This script derives the daily nationwide average for regular, mid-grade,
 * premium, and diesel by averaging across all states that reported on each
 * day. The state_count field tracks data quality (how many states reported).
 *
 * Usage:
 *   npm run --workspace=@fuelripple/api backfill-aaa-national
 *
 * Options:
 *   --start <YYYY-MM-DD>    Only compute from this date onward (default: earliest AAA data)
 *   --end   <YYYY-MM-DD>    Only compute up to this date (default: today)
 *   --dry-run               Compute but do not write to DB
 *   --help                  Show this help
 *
 * Examples:
 *   # Full backfill from earliest AAA data
 *   npm run --workspace=@fuelripple/api backfill-aaa-national
 *
 *   # Just 2024 data
 *   npm run --workspace=@fuelripple/api backfill-aaa-national -- --start 2024-01-01 --end 2024-12-31
 *
 *   # Dry run to see what would be computed
 *   npm run --workspace=@fuelripple/api backfill-aaa-national -- --dry-run
 */

import 'dotenv/config';
import path from 'path';
import * as dotenv from 'dotenv';

// Load .env from monorepo root (two levels up from apps/api)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import {
  getKnex,
  closeConnection,
  upsertNationalAverages,
} from '@fuelripple/db';

import type { AaaNationalAverageRow } from '@fuelripple/db';
import { clearCache } from '../services/cache';

// ─── CLI argument parsing ─────────────────────────────────────────────────────

interface BackfillOptions {
  start?: string;
  end?: string;
  dryRun: boolean;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
AAA National Averages Backfill

Computes daily USA-wide national average gas prices from existing
per-state AAA data in energy_prices, then upserts into aaa_national_averages.

Usage:
  npm run --workspace=@fuelripple/api backfill-aaa-national [options]

Options:
  --start <YYYY-MM-DD>   Start date (default: earliest AAA data)
  --end   <YYYY-MM-DD>   End date   (default: today)
  --dry-run              Compute but do not write to DB
  --help                 Show this help

Examples:
  npm run --workspace=@fuelripple/api backfill-aaa-national
  npm run --workspace=@fuelripple/api backfill-aaa-national -- --start 2024-01-01
  npm run --workspace=@fuelripple/api backfill-aaa-national -- --dry-run
`);
    process.exit(0);
  }

  const opts: BackfillOptions = {
    dryRun: args.includes('--dry-run'),
  };

  const startIdx = args.indexOf('--start');
  if (startIdx !== -1 && startIdx + 1 < args.length) {
    opts.start = args[startIdx + 1];
  }

  const endIdx = args.indexOf('--end');
  if (endIdx !== -1 && endIdx + 1 < args.length) {
    opts.end = args[endIdx + 1];
  }

  return opts;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs();
  console.log('🔄 AAA National Averages Backfill');
  console.log(`   Start: ${opts.start ?? '(earliest AAA data)'}`);
  console.log(`   End:   ${opts.end ?? '(today)'}`);
  console.log(`   Dry run: ${opts.dryRun ? 'yes' : 'no'}\n`);

  const knex = getKnex();

  try {
    // Query unique dates from energy_prices where source='aaa'
    console.log('📊 Querying existing AAA per-state data...');

    let query = knex('energy_prices')
      .where('source', 'in', ['aaa', 'aaa_wayback'])
      .distinct('time')
      .orderBy('time', 'asc')
      .select('time');

    if (opts.start) {
      query = query.andWhere('time', '>=', new Date(opts.start));
    }
    if (opts.end) {
      query = query.andWhere('time', '<=', new Date(opts.end));
    }

    const dates = await query;
    console.log(`✓ Found ${dates.length} unique dates with AAA data`);

    if (dates.length === 0) {
      console.log('⚠️  No AAA data found. Have you run backfill-aaa-wayback.ts first?');
      return;
    }

    // For each date, compute the national average across all regions
    console.log('🧮 Computing national averages...');
    const results: AaaNationalAverageRow[] = [];

    for (const { time } of dates) {
      const pricesByMetric = await knex('energy_prices')
        .where('source', 'in', ['aaa', 'aaa_wayback'])
        .andWhere('time', time)
        .select('metric', 'value');

      // Group by metric and compute average
      const metricMap = new Map<string, number[]>();
      for (const { metric, value } of pricesByMetric) {
        if (!metricMap.has(metric)) {
          metricMap.set(metric, []);
        }
        metricMap.get(metric)!.push(value);
      }

      const avg = (vals: number[]) =>
        vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

      const regularVals   = metricMap.get('gas_regular') ?? [];
      const midgradeVals  = metricMap.get('gas_midgrade') ?? [];
      const premiumVals   = metricMap.get('gas_premium') ?? [];
      const dieselVals    = metricMap.get('diesel') ?? [];

      results.push({
        time: new Date(time),
        regular:   avg(regularVals),
        mid_grade: avg(midgradeVals),
        premium:   avg(premiumVals),
        diesel:    avg(dieselVals),
        state_count: regularVals.length,
      });
    }

    console.log(`✓ Computed ${results.length} national average entries`);
    console.log(`  Sample (first 3):`);
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const r = results[i];
      console.log(
        `    ${r.time.toISOString().split('T')[0]}: ` +
        `regular=$${r.regular?.toFixed(3) ?? 'N/A'} ` +
        `mid=$${r.mid_grade?.toFixed(3) ?? 'N/A'} ` +
        `premium=$${r.premium?.toFixed(3) ?? 'N/A'} ` +
        `diesel=$${r.diesel?.toFixed(3) ?? 'N/A'} ` +
        `(${r.state_count} states)`
      );
    }

    if (opts.dryRun) {
      console.log('\n✅ Dry run complete. No changes written to DB.');
      return;
    }

    // Upsert into aaa_national_averages
    console.log('\n💾 Upserting to aaa_national_averages...');
    await upsertNationalAverages(results);
    console.log(`✅ Upserted ${results.length} national average records`);

    // Invalidate cache so next API call gets fresh data
    console.log('🧹 Invalidating AAA cache...');
    await clearCache('aaa:national:*');
    console.log('✅ Cache invalidated');
  } catch (err) {
    console.error('❌ Error:', err);
    throw err;
  } finally {
    console.log('\n📊 Closing database connection...');
    await closeConnection();
  }
}

main()
  .then(() => {
    console.log('\n✨ Backfill complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });
