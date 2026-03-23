#!/usr/bin/env tsx
/**
 * Scrape today's AAA metro gas prices and insert into database.
 *
 * Usage:
 *   npm run --workspace=@fuelripple/api fetch-metro-today
 */

import 'dotenv/config';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { fetchAllMetroPrices } from '../services/aaaMetroClient';
import {
  upsertMetroAggregates,
  closeConnection,
  getKnex,
} from '@fuelripple/db';
import type { AaaMetroAggregateRow } from '@fuelripple/db';
import { initializeCache, clearCache } from '../services/cache';

async function main(): Promise<void> {
  initializeCache();

  console.log('🔍 Scraping AAA metro gas prices...\n');

  // Use UTC midnight to match date convention
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const metroData = await fetchAllMetroPrices();

  if (metroData.length === 0) {
    console.warn('⚠️  No metro data fetched');
    await closeConnection();
    return;
  }

  // Transform to AaaMetroAggregateRow format
  const rows: AaaMetroAggregateRow[] = metroData
    .filter(m => m.regular !== null || m.diesel !== null)
    .map(m => ({
      time: today,
      metro_id: m.metroId,
      metro_name: m.metroName,
      state_abbr: m.stateAbbr,
      latitude: m.latitude,
      longitude: m.longitude,
      regular: m.regular,
      mid_grade: m.midGrade,
      premium: m.premium,
      diesel: m.diesel,
    }));

  // Deduplicate by metro_id to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
  const seen = new Set<string>();
  const deduped = rows.filter(r => {
    const key = `${r.time.toISOString()}|${r.metro_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`💾 Writing ${deduped.length} metro records (deduplicated from ${rows.length})...\n`);

  // Log first few records for debugging
  if (deduped.length > 0) {
    console.log('📍 Sample record:', JSON.stringify(deduped[0], null, 2));
  }

  try {
    await upsertMetroAggregates(deduped);
    console.log(`✅ Upserted ${deduped.length} metro aggregates`);
  } catch (upsertErr) {
    console.error('❌ Upsert error:', upsertErr);
    throw upsertErr;
  }

  // Clear metro caches
  await clearCache();
  console.log('🧹 Caches cleared');

  await closeConnection();
}

main().catch((err) => {
  console.error('❌ Metro scrape failed:', err);
  process.exit(1);
});
