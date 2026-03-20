#!/usr/bin/env tsx
/**
 * Scrape today's AAA gas prices for all 51 states and write them to the DB.
 *
 * Usage:
 *   npm run --workspace=@fuelripple/api fetch-aaa-today
 */

import 'dotenv/config';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { fetchAllStatePrices } from '../services/aaaClient';
import {
  insertPrices,
  upsertNationalAverages,
  upsertStateAggregates,
  upsertLatestPrices,
  getKnex,
  closeConnection,
} from '@fuelripple/db';
import type { AaaNationalAverageRow, AaaStateAggregateRow } from '@fuelripple/db';
import type { EnergyPrice } from '@fuelripple/shared';
import { abbrToDuoarea } from '../utils/regionMapper';
import { initializeCache, clearCache } from '../services/cache';

const avg = (vals: number[]) =>
  vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

async function main(): Promise<void> {
  // Initialize Redis so clearCache actually flushes L2
  initializeCache();

  console.log('🔍 Scraping AAA gas prices for all states...\n');

  // Use UTC midnight to match the seed/backfill date convention
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const stateData = await fetchAllStatePrices();

  // --- energy_prices rows ---
  const prices: EnergyPrice[] = [];
  for (const sp of stateData) {
    const duoarea = abbrToDuoarea(sp.state);
    if (!duoarea) continue;
    if (sp.regular  !== null) prices.push({ time: today, source: 'aaa', metric: 'gas_regular',  region: duoarea, value: sp.regular,   unit: 'usd_per_gallon' });
    if (sp.midGrade !== null) prices.push({ time: today, source: 'aaa', metric: 'gas_midgrade', region: duoarea, value: sp.midGrade,  unit: 'usd_per_gallon' });
    if (sp.premium  !== null) prices.push({ time: today, source: 'aaa', metric: 'gas_premium',  region: duoarea, value: sp.premium,   unit: 'usd_per_gallon' });
    if (sp.diesel   !== null) prices.push({ time: today, source: 'aaa', metric: 'diesel',       region: duoarea, value: sp.diesel,    unit: 'usd_per_gallon' });
  }

  // Remove any existing records for today stored at a different timestamp
  // (e.g. local-midnight vs UTC-midnight) to prevent duplicate-day confusion
  const knex = getKnex();
  await knex('aaa_state_aggregates')
    .whereRaw(`time::date = ?::date`, [today.toISOString()])
    .delete();
  console.log('🗑️  Cleared today\'s stale aaa_state_aggregates rows');

  console.log(`\n💾 Writing ${prices.length} price records to energy_prices...`);
  await insertPrices(prices);
  await upsertLatestPrices(prices);

  // --- national average ---
  const regulars  = stateData.map(s => s.regular).filter((v): v is number => v !== null);
  const midGrades = stateData.map(s => s.midGrade).filter((v): v is number => v !== null);
  const premiums  = stateData.map(s => s.premium).filter((v): v is number => v !== null);
  const diesels   = stateData.map(s => s.diesel).filter((v): v is number => v !== null);

  const nationalAvg: AaaNationalAverageRow = {
    time: today,
    regular:     avg(regulars),
    mid_grade:   avg(midGrades),
    premium:     avg(premiums),
    diesel:      avg(diesels),
    state_count: regulars.length,
  };
  await upsertNationalAverages([nationalAvg]);
  console.log(
    `✅ National avg: regular=$${nationalAvg.regular?.toFixed(3)} ` +
    `mid=$${nationalAvg.mid_grade?.toFixed(3)} ` +
    `premium=$${nationalAvg.premium?.toFixed(3)} ` +
    `diesel=$${nationalAvg.diesel?.toFixed(3)} ` +
    `(${nationalAvg.state_count} states)`
  );

  // --- per-state aggregates (powers /state/:abbr pages) ---
  const stateAggs: AaaStateAggregateRow[] = stateData
    .filter(s => s.regular !== null || s.midGrade !== null || s.premium !== null || s.diesel !== null)
    .map(s => ({
      time:      today,
      state:     s.state,
      regular:   s.regular,
      mid_grade: s.midGrade,
      premium:   s.premium,
      diesel:    s.diesel,
    }));

  await upsertStateAggregates(stateAggs);
  console.log(`✅ Upserted ${stateAggs.length} state aggregates`);

  // --- clear caches so pages show fresh data ---
  console.log('\n🧹 Clearing AAA caches...');
  await clearCache('aaa:*');
  console.log('✅ Cache cleared');
}

main()
  .catch(err => { console.error('❌ Error:', err); process.exit(1); })
  .finally(() => closeConnection());
