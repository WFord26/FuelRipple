#!/usr/bin/env tsx
/**
 * Compute US national averages from AAA state-level data
 *
 * Reads aaa_state_aggregates table and computes nationwide averages,
 * then upserts into aaa_national_averages table.
 *
 * Usage:
 *   npx tsx src/scripts/compute-aaa-national.ts [options]
 *
 * Options:
 *   --start <date>  Start date (YYYY-MM-DD) - default: 30 days ago
 *   --end <date>    End date (YYYY-MM-DD) - default: today
 *   --dry-run       Show what would be computed but don't write to DB
 */

import 'dotenv/config';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { getKnex, upsertNationalAverages, insertPrices } from '@fuelripple/db';
import type { AaaNationalAverageRow } from '@fuelripple/db';
import { EnergyPrice } from '@fuelripple/shared';

interface ComputeOptions {
  start: string;
  end: string;
  dryRun: boolean;
}

function parseArgs(): ComputeOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Compute US national averages from AAA state-level data.

Usage:
  npx tsx src/scripts/compute-aaa-national.ts [options]

Options:
  --start <date>  Start date (YYYY-MM-DD) - default: 30 days ago
  --end <date>    End date (YYYY-MM-DD) - default: today
  --dry-run       Show what would be computed without writing to DB
`);
    process.exit(0);
  }

  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 30);

  return {
    start: get('--start') ?? defaultStart.toISOString().split('T')[0],
    end: get('--end') ?? today.toISOString().split('T')[0],
    dryRun: args.includes('--dry-run'),
  };
}

async function main() {
  const opts = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  AAA National Averages — Compute from State Data       ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`  Start:   ${opts.start}`);
  console.log(`  End:     ${opts.end}`);
  console.log(`  Dry-run: ${opts.dryRun}`);
  console.log();

  const knex = getKnex();

  // Fetch all state rows for the date range once, then group by time in memory
  const allStateData = await knex('aaa_state_aggregates')
    .select('*')
    .whereBetween('time', [opts.start, opts.end])
    .orderBy('time', 'asc');

  if (allStateData.length === 0) {
    console.log('⚠️  No state-level AAA data found in date range.');
    process.exit(0);
  }

  const groupedStateData = new Map<string, typeof allStateData>();

  for (const row of allStateData) {
    const key = row.time instanceof Date ? row.time.toISOString() : String(row.time);
    const rowsForTime = groupedStateData.get(key);

    if (rowsForTime) {
      rowsForTime.push(row);
    } else {
      groupedStateData.set(key, [row]);
    }
  }

  console.log(`→ Found ${groupedStateData.size} dates with state data\n`);

  const nationalAverages: AaaNationalAverageRow[] = [];
  const energyPrices: EnergyPrice[] = [];

  for (const stateData of groupedStateData.values()) {
    if (stateData.length === 0) continue;

    const { time } = stateData[0];
    const avg = (vals: (number | null)[]) => {
      const filtered = vals.filter((v): v is number => v !== null);
      return filtered.length > 0 ? filtered.reduce((a, b) => a + b, 0) / filtered.length : null;
    };

    const regulars = stateData.map(s => s.regular);
    const midGrades = stateData.map(s => s.mid_grade);
    const premiums = stateData.map(s => s.premium);
    const diesels = stateData.map(s => s.diesel);

    const regular = avg(regulars);
    const midGrade = avg(midGrades);
    const premium = avg(premiums);
    const diesel = avg(diesels);

    const nationalAvg: AaaNationalAverageRow = {
      time: new Date(time),
      regular,
      mid_grade: midGrade,
      premium,
      diesel,
      state_count: stateData.length,
    };

    nationalAverages.push(nationalAvg);

    // Also insert into energy_prices for time-series queries & disruption score
    if (regular !== null) {
      energyPrices.push({
        time: new Date(time),
        source: 'aaa',
        metric: 'gas_regular',
        region: 'US',
        value: regular,
        unit: 'usd_per_gallon',
      });
    }
    if (midGrade !== null) {
      energyPrices.push({
        time: new Date(time),
        source: 'aaa',
        metric: 'gas_midgrade',
        region: 'US',
        value: midGrade,
        unit: 'usd_per_gallon',
      });
    }
    if (premium !== null) {
      energyPrices.push({
        time: new Date(time),
        source: 'aaa',
        metric: 'gas_premium',
        region: 'US',
        value: premium,
        unit: 'usd_per_gallon',
      });
    }
    if (diesel !== null) {
      energyPrices.push({
        time: new Date(time),
        source: 'aaa',
        metric: 'diesel',
        region: 'US',
        value: diesel,
        unit: 'usd_per_gallon',
      });
    }

    const dateStr = time.toISOString().split('T')[0];
    console.log(
      `  ${dateStr}  regular=$${nationalAvg.regular?.toFixed(3) ?? 'N/A'}  ` +
      `mid=$${nationalAvg.mid_grade?.toFixed(3) ?? 'N/A'}  ` +
      `premium=$${nationalAvg.premium?.toFixed(3) ?? 'N/A'}  ` +
      `diesel=$${nationalAvg.diesel?.toFixed(3) ?? 'N/A'}  ` +
      `(${nationalAvg.state_count} states)`
    );
  }

  console.log();

  if (opts.dryRun) {
    console.log('🏁 Dry run — no data written to DB.');
  } else {
    await upsertNationalAverages(nationalAverages);
    await insertPrices(energyPrices);
    console.log(`✅ Upserted ${nationalAverages.length} national average records`);
    console.log(`✅ Inserted ${energyPrices.length} energy_prices rows (for time-series queries)`);
  }

  await knex.destroy();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  const knex = getKnex();
  try { await knex.destroy(); } catch {}
  process.exit(1);
});
