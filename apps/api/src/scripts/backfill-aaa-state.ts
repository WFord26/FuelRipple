#!/usr/bin/env tsx
/**
 * AAA State Aggregates Backfill
 *
 * Computes per-state AAA price aggregates from raw energy_prices table,
 * then upserts into aaa_state_aggregates for fast state-level queries.
 *
 * Usage:
 *   npm run --workspace=@fuelripple/api backfill-aaa-state
 *
 * Options:
 *   --start <YYYY-MM-DD>    Only compute from this date onward
 *   --end   <YYYY-MM-DD>    Only compute up to this date
 *   --dry-run               Compute but do not write to DB
 *   --help                  Show this help
 */

import 'dotenv/config';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import {
  getKnex,
  closeConnection,
  upsertStateAggregates,
} from '@fuelripple/db';

import type { AaaStateAggregateRow } from '@fuelripple/db';
import { clearCache } from '../services/cache';
import { STATE_INFO } from '../utils/regionMapper';

/** Convert EIA duoarea code (e.g. 'SCO') to 2-letter state abbr (e.g. 'CO'). Falls back to the code itself. */
function duoareaToAbbr(region: string): string {
  return STATE_INFO[region]?.abbr ?? region;
}

interface BackfillOptions {
  start?: string;
  end?: string;
  dryRun: boolean;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
AAA State Aggregates Backfill

Computes per-state AAA prices from raw energy_prices, then upserts into
aaa_state_aggregates for fast state-level queries.

Usage:
  npm run --workspace=@fuelripple/api backfill-aaa-state [options]

Options:
  --start <YYYY-MM-DD>   Start date (default: earliest AAA data)
  --end   <YYYY-MM-DD>   End date   (default: today)
  --dry-run              Compute but do not write to DB
  --help                 Show this help
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

async function main(): Promise<void> {
  const opts = parseArgs();
  console.log('🔄 AAA State Aggregates Backfill');
  console.log(`   Start: ${opts.start ?? '(earliest AAA data)'}`);
  console.log(`   End:   ${opts.end ?? '(today)'}`);
  console.log(`   Dry run: ${opts.dryRun ? 'yes' : 'no'}\n`);

  const knex = getKnex();

  try {
    console.log('📊 Querying per-state AAA data from energy_prices...');

    let query = knex('energy_prices')
      .where('source', 'in', ['aaa', 'aaa_wayback'])
      .select('time', 'region', 'metric', 'value')
      .orderBy('time', 'asc');

    if (opts.start) {
      query = query.andWhere('time', '>=', new Date(opts.start));
    }
    if (opts.end) {
      query = query.andWhere('time', '<=', new Date(opts.end));
    }

    const rawData = await query;
    console.log(`✓ Retrieved ${rawData.length} price records`);

    if (rawData.length === 0) {
      console.log('⚠️  No AAA data found.');
      return;
    }

    // Group by (time, state/region) and pivot metrics
    console.log('🧮 Computing state aggregates...');
    const stateMap = new Map<string, AaaStateAggregateRow>();

    for (const row of rawData) {
      const stateAbbr = duoareaToAbbr(row.region);
      // Normalize to UTC midnight so wayback rows (T12:00:00Z) and live AAA rows
      // (T00:00:00Z) land on the same key and properly overwrite seed data.
      const raw = new Date(row.time);
      const midnight = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
      const key = `${midnight.toISOString()}|${stateAbbr}`;
      if (!stateMap.has(key)) {
        stateMap.set(key, {
          time: midnight,
          state: stateAbbr,
          regular: null,
          mid_grade: null,
          premium: null,
          diesel: null,
        });
      }

      const agg = stateMap.get(key)!;
      if (row.metric === 'gas_regular') agg.regular = row.value;
      else if (row.metric === 'gas_midgrade') agg.mid_grade = row.value;
      else if (row.metric === 'gas_premium') agg.premium = row.value;
      else if (row.metric === 'diesel') agg.diesel = row.value;
    }

    const results = Array.from(stateMap.values());
    console.log(`✓ Computed ${results.length} state aggregate entries`);
    console.log(`  Sample (first 3):`);
    for (let i = 0; i < Math.min(3, results.length); i++) {
      const r = results[i];
      console.log(
        `    ${r.time.toISOString().split('T')[0]} [${r.state}]: ` +
        `regular=$${r.regular?.toFixed(3) ?? 'N/A'} ` +
        `mid=$${r.mid_grade?.toFixed(3) ?? 'N/A'} ` +
        `premium=$${r.premium?.toFixed(3) ?? 'N/A'} ` +
        `diesel=$${r.diesel?.toFixed(3) ?? 'N/A'}`
      );
    }

    if (opts.dryRun) {
      console.log('\n✅ Dry run complete. No changes written to DB.');
      return;
    }

    console.log('\n💾 Upserting to aaa_state_aggregates...');
    await upsertStateAggregates(results);
    console.log(`✅ Upserted ${results.length} state aggregate records`);

    // Invalidate cache
    console.log('🧹 Invalidating AAA cache...');
    await clearCache('aaa:*');
    console.log('✅ Cache invalidated');
  } catch (err) {
    console.error('❌ Error:', err);
    throw err;
  } finally {
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
