#!/usr/bin/env tsx
/**
 * AAA PADD Regional Aggregates Backfill
 *
 * Computes daily PADD-level price aggregates from the existing
 * aaa_state_aggregates table and writes them into aaa_padd_aggregates.
 *
 * Two methods are computed for every grade / date / PADD combination:
 *   *_mean   — simple arithmetic mean across all reporting states
 *   *_wtd    — population-weighted mean (2020 US Census weights)
 *
 * Usage:
 *   npm run --workspace=@fuelripple/api backfill-aaa-padd
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

import { getKnex, closeConnection, upsertPaddAggregates } from '@fuelripple/db';
import type { AaaStateAggregateRow, AaaPaddAggregateRow } from '@fuelripple/db';
import { PADD_REGIONS, STATE_POPULATIONS } from '@fuelripple/shared';
import { clearCache } from '../services/cache';

const PADD_CODE_TO_REGION = {
  R10: PADD_REGIONS.PADD1,
  R20: PADD_REGIONS.PADD2,
  R30: PADD_REGIONS.PADD3,
  R40: PADD_REGIONS.PADD4,
  R50: PADD_REGIONS.PADD5,
} as const;

interface BackfillOptions {
  start?: string;
  end?: string;
  dryRun: boolean;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
AAA PADD Regional Aggregates Backfill

Computes simple-mean and population-weighted PADD aggregates from
aaa_state_aggregates and upserts into aaa_padd_aggregates.

Usage:
  npm run --workspace=@fuelripple/api backfill-aaa-padd [options]

Options:
  --start <YYYY-MM-DD>   Start date (default: earliest available state aggregate)
  --end   <YYYY-MM-DD>   End date   (default: today)
  --dry-run              Compute but do not write to DB
  --help                 Show this help
`);
    process.exit(0);
  }

  const opts: BackfillOptions = { dryRun: args.includes('--dry-run') };

  const startIdx = args.indexOf('--start');
  if (startIdx !== -1 && startIdx + 1 < args.length) opts.start = args[startIdx + 1];

  const endIdx = args.indexOf('--end');
  if (endIdx !== -1 && endIdx + 1 < args.length) opts.end = args[endIdx + 1];

  return opts;
}

/**
 * Given an array of state aggregate rows for a single date, return PADD aggregates
 * for all 5 regions (both simple mean and population-weighted mean).
 */
function computePaddAggregates(
  date: Date,
  stateRows: AaaStateAggregateRow[],
): AaaPaddAggregateRow[] {
  const results: AaaPaddAggregateRow[] = [];
  const grades = ['regular', 'mid_grade', 'premium', 'diesel'] as const;
  type GradeKey = typeof grades[number];

  for (const [paddCode, region] of Object.entries(PADD_CODE_TO_REGION)) {
    const statesInPadd = stateRows.filter(
      s => (region.states as readonly string[]).includes(s.state),
    );

    const agg: AaaPaddAggregateRow = {
      time: date,
      padd: paddCode,
      regular_mean:   null,
      mid_grade_mean: null,
      premium_mean:   null,
      diesel_mean:    null,
      regular_wtd:    null,
      mid_grade_wtd:  null,
      premium_wtd:    null,
      diesel_wtd:     null,
      state_count: statesInPadd.length,
    };

    for (const grade of grades) {
      const withPrices = statesInPadd.filter(s => s[grade as GradeKey] !== null);
      if (withPrices.length === 0) continue;

      const prices = withPrices.map(s => s[grade as GradeKey] as number);
      (agg as any)[`${grade}_mean`] =
        prices.reduce((a, b) => a + b, 0) / prices.length;

      let weightedSum = 0;
      let totalWeight = 0;
      for (const s of withPrices) {
        const pop = STATE_POPULATIONS[s.state] ?? 0;
        weightedSum += (s[grade as GradeKey] as number) * pop;
        totalWeight += pop;
      }
      if (totalWeight > 0) {
        (agg as any)[`${grade}_wtd`] = weightedSum / totalWeight;
      }
    }

    results.push(agg);
  }

  return results;
}

async function main(): Promise<void> {
  const opts = parseArgs();
  console.log('🔄 AAA PADD Aggregates Backfill');
  console.log(`   Start:   ${opts.start ?? '(earliest state aggregate)'}`);
  console.log(`   End:     ${opts.end ?? '(today)'}`);
  console.log(`   Dry run: ${opts.dryRun ? 'yes' : 'no'}\n`);

  const knex = getKnex();

  try {
    // Pull all state aggregate rows within the date range
    let query = knex('aaa_state_aggregates')
      .select('time', 'state', 'regular', 'mid_grade', 'premium', 'diesel')
      .orderBy('time', 'asc');

    if (opts.start) query = query.andWhere('time', '>=', new Date(opts.start));
    if (opts.end)   query = query.andWhere('time', '<=', new Date(opts.end));

    const rawRows: AaaStateAggregateRow[] = await query;
    console.log(`✓ Retrieved ${rawRows.length} state aggregate rows`);

    if (rawRows.length === 0) {
      console.log('⚠️  No aaa_state_aggregates data found. Run backfill-aaa-state first.');
      return;
    }

    // Group rows by UTC-midnight date key
    const byDate = new Map<string, AaaStateAggregateRow[]>();
    for (const row of rawRows) {
      const d = new Date(row.time);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(row);
    }

    console.log(`✓ Found ${byDate.size} distinct dates to process\n`);

    const allPaddRows: AaaPaddAggregateRow[] = [];
    let processed = 0;

    for (const [dateKey, stateRows] of byDate) {
      const date = new Date(Date.UTC(
        parseInt(dateKey.slice(0, 4)),
        parseInt(dateKey.slice(5, 7)) - 1,
        parseInt(dateKey.slice(8, 10)),
      ));

      const paddRows = computePaddAggregates(date, stateRows);
      allPaddRows.push(...paddRows);
      processed++;

      if (processed % 100 === 0) {
        console.log(`  … ${processed}/${byDate.size} dates processed`);
      }
    }

    console.log(`\n✓ Computed ${allPaddRows.length} PADD aggregate rows`);

    // Sample output
    const sample = allPaddRows.slice(0, 3);
    console.log('\nSample (first 3 rows):');
    for (const r of sample) {
      console.log(
        `  ${r.time.toISOString().slice(0, 10)} ${r.padd}` +
        `  regular: mean=$${r.regular_mean?.toFixed(3) ?? 'N/A'} wtd=$${r.regular_wtd?.toFixed(3) ?? 'N/A'}` +
        `  states=${r.state_count}`
      );
    }

    if (opts.dryRun) {
      console.log('\n🏁 Dry run — no data written.');
      return;
    }

    console.log('\n💾 Upserting PADD aggregates to DB …');
    await upsertPaddAggregates(allPaddRows);
    console.log(`✅ Upserted ${allPaddRows.length} rows into aaa_padd_aggregates`);

    // Bust the API cache so the new data is visible immediately
    try {
      await clearCache('aaa:regions:latest');
      for (const padd of ['R10', 'R20', 'R30', 'R40', 'R50']) {
        await clearCache(`aaa:region:${padd}:latest`);
      }
      console.log('✅ Cache cleared');
    } catch {
      console.warn('⚠️  Cache clear skipped (Redis not available)');
    }

  } finally {
    await closeConnection();
  }
}

main().catch(err => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
