#!/usr/bin/env tsx
/**
 * Historical data backfill script
 *
 * Pulls historical data from EIA, FRED, and optionally AAA,
 * then upserts it into the GasTrack database.
 *
 * Usage:
 *   npx tsx src/scripts/backfill.ts [options]
 *
 * Options:
 *   --start <date>       Start date in YYYY-MM-DD (default: 5 years ago)
 *   --end   <date>       End date in YYYY-MM-DD   (default: today)
 *   --sources <list>     Comma-separated subset of:
 *                          gas, crude, diesel, economic, refinery
 *                        (default: all)
 *   --dry-run            Fetch data but skip DB inserts
 *   --help               Show this help text
 *
 * Environment variables required (same as the API):
 *   EIA_API_KEY, FRED_API_KEY, DATABASE_URL (or defaults in packages/db/src/config.ts)
 *
 * Examples:
 *   # Full 5-year backfill
 *   npx tsx src/scripts/backfill.ts
 *
 *   # Gas + crude only, different date range
 *   npx tsx src/scripts/backfill.ts --start 2020-01-01 --sources gas,crude
 *
 *   # Dry run to see what would be inserted
 *   npx tsx src/scripts/backfill.ts --start 2024-01-01 --dry-run
 */

import 'dotenv/config';
import path from 'path';
import * as dotenv from 'dotenv';

// Load .env from monorepo root (two levels up from apps/api)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import {
  fetchAllGasPrices,
  fetchDieselPrices,
  fetchRefineryUtilization,
  fetchRefineryProduction,
  fetchPetroleumStocks,
} from '../services/eiaClient';

import { fetchCrudeHistory } from '../services/marketClient';

import {
  fetchEconomicIndicators,
} from '../services/fredClient';

import {
  insertPrices,
  insertIndicators,
  upsertRefineryData,
  refreshMaterializedViews,
  closeConnection,
} from '@fuelripple/db';

import type { RefineryOperationsRow } from '@fuelripple/db';
import { EnergyPrice, EconomicIndicator } from '@fuelripple/shared';

// ─── CLI argument parsing ─────────────────────────────────────────────────────

type Source = 'gas' | 'crude' | 'diesel' | 'economic' | 'refinery';
const ALL_SOURCES: Source[] = ['gas', 'crude', 'diesel', 'economic', 'refinery'];

interface BackfillOptions {
  start: string;
  end: string;
  sources: Source[];
  dryRun: boolean;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Historical data backfill script

Usage:
  npx tsx src/scripts/backfill.ts [options]

Options:
  --start <YYYY-MM-DD>   Start date (default: 5 years ago)
  --end   <YYYY-MM-DD>   End date   (default: today)
  --sources <list>       Comma-separated: gas,crude,diesel,economic,refinery
                         (default: all)
  --dry-run              Fetch but do not write to DB
  --help                 Show this help
`);
    process.exit(0);
  }

  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  // Default start: 5 years ago
  const defaultStart = new Date();
  defaultStart.setFullYear(defaultStart.getFullYear() - 5);
  const startStr = get('--start') ?? defaultStart.toISOString().slice(0, 10);

  // Default end: today
  const endStr = get('--end') ?? new Date().toISOString().slice(0, 10);

  // Validate dates
  if (isNaN(Date.parse(startStr))) {
    console.error(`Invalid --start date: ${startStr}`);
    process.exit(1);
  }
  if (isNaN(Date.parse(endStr))) {
    console.error(`Invalid --end date: ${endStr}`);
    process.exit(1);
  }
  if (new Date(startStr) > new Date(endStr)) {
    console.error(`--start (${startStr}) must be before --end (${endStr})`);
    process.exit(1);
  }

  // Parse sources
  const sourcesArg = get('--sources');
  let sources: Source[] = ALL_SOURCES;
  if (sourcesArg) {
    const requested = sourcesArg.split(',').map(s => s.trim()) as Source[];
    const invalid = requested.filter(s => !ALL_SOURCES.includes(s));
    if (invalid.length > 0) {
      console.error(`Unknown source(s): ${invalid.join(', ')}. Valid: ${ALL_SOURCES.join(', ')}`);
      process.exit(1);
    }
    sources = requested;
  }

  return {
    start: startStr,
    end: endStr,
    sources,
    dryRun: args.includes('--dry-run'),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function separator(label: string): void {
  const line = '─'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${label}`);
  console.log(`${line}`);
}

// ─── Source processors ────────────────────────────────────────────────────────

async function backfillGasPrices(start: string, end: string, dryRun: boolean): Promise<void> {
  separator('EIA  ▸  Retail Gas Prices (Regular)');
  log(`Date range: ${start} → ${end}`);

  const results = await fetchAllGasPrices(start, end);
  log(`Received ${results.length} regional datasets from EIA`);

  const prices: EnergyPrice[] = [];
  for (const { region, data } of results) {
    for (const point of data) {
      if (isNaN(point.value)) continue;
      prices.push({
        time: new Date(point.period),
        source: 'eia',
        metric: 'gas_regular',
        region,
        value: point.value,
        unit: 'usd_per_gallon',
      });
    }
  }

  log(`Prepared ${prices.length} gas price records`);
  if (!dryRun) {
    await insertPrices(prices);
    log(`✅ Inserted ${prices.length} gas price records`);
  } else {
    log(`[dry-run] Would insert ${prices.length} gas price records`);
  }
}

async function backfillCrudePrices(start: string, end: string, dryRun: boolean): Promise<void> {
  separator('Yahoo Finance  ▸  Crude Oil Daily Close Prices (WTI + Brent)');
  log(`Date range: ${start} → ${end}`);
  log('Tickers: CL=F (NYMEX WTI) and BZ=F (ICE Brent) — daily closing price');

  const { wti, brent } = await fetchCrudeHistory(new Date(start), new Date(end));
  const prices: EnergyPrice[] = [];

  for (const bar of wti) {
    if (isNaN(bar.close) || bar.close <= 0) continue;
    prices.push({
      time: bar.date,
      source: 'yahoo',
      metric: 'crude_wti',
      region: 'US',
      value: bar.close,
      unit: 'usd_per_barrel',
    });
  }
  log(`WTI: ${wti.length} daily bars (${prices.filter(p => p.metric === 'crude_wti').length} valid)`);

  for (const bar of brent) {
    if (isNaN(bar.close) || bar.close <= 0) continue;
    prices.push({
      time: bar.date,
      source: 'yahoo',
      metric: 'crude_brent',
      region: 'US',
      value: bar.close,
      unit: 'usd_per_barrel',
    });
  }
  log(`Brent: ${brent.length} daily bars (${prices.filter(p => p.metric === 'crude_brent').length} valid)`);

  log(`Prepared ${prices.length} crude price records`);
  if (!dryRun) {
    await insertPrices(prices);
    log(`✅ Inserted ${prices.length} crude price records`);
  } else {
    log(`[dry-run] Would insert ${prices.length} crude price records`);
  }
}

async function backfillDieselPrices(start: string, end: string, dryRun: boolean): Promise<void> {
  separator('EIA  ▸  Diesel Retail Prices (All Regions)');
  log(`Date range: ${start} → ${end}`);

  const results = await fetchDieselPrices(start, end);
  log(`Received ${results.length} regional diesel datasets from EIA`);

  const prices: EnergyPrice[] = [];
  for (const { region, data } of results) {
    for (const point of data) {
      if (isNaN(point.value)) continue;
      prices.push({
        time: new Date(point.period),
        source: 'eia',
        metric: 'diesel',
        region,
        value: point.value,
        unit: 'usd_per_gallon',
      });
    }
  }

  log(`Prepared ${prices.length} diesel price records`);
  if (!dryRun) {
    await insertPrices(prices);
    log(`✅ Inserted ${prices.length} diesel price records`);
  } else {
    log(`[dry-run] Would insert ${prices.length} diesel price records`);
  }
}

async function backfillEconomicIndicators(start: string, end: string, dryRun: boolean): Promise<void> {
  separator('FRED  ▸  Economic Indicators (CPI, PPI)');
  log(`Date range: ${start} → ${end}`);

  // Economic indicators (CPI, PPI)
  const { cpi, cpiFoodAtHome, ppiTrucking, ppiFreightCommodity } = await fetchEconomicIndicators(start, end);
  const indicators: EconomicIndicator[] = [];

  for (const point of cpi) {
    const val = parseFloat(point.value);
    if (isNaN(val)) continue;
    indicators.push({ time: new Date(point.date), indicator: 'cpi', value: val, source: 'fred' });
  }
  log(`CPI: ${cpi.length} points`);

  for (const point of cpiFoodAtHome) {
    const val = parseFloat(point.value);
    if (isNaN(val)) continue;
    indicators.push({ time: new Date(point.date), indicator: 'cpi', value: val, source: 'fred' });
  }
  log(`CPI Food at Home: ${cpiFoodAtHome.length} points`);

  for (const point of ppiTrucking) {
    const val = parseFloat(point.value);
    if (isNaN(val)) continue;
    indicators.push({ time: new Date(point.date), indicator: 'ppi_trucking', value: val, source: 'fred' });
  }
  log(`PPI (Trucking): ${ppiTrucking.length} points`);

  for (const point of ppiFreightCommodity) {
    const val = parseFloat(point.value);
    if (isNaN(val)) continue;
    indicators.push({ time: new Date(point.date), indicator: 'freight_rate', value: val, source: 'fred' });
  }
  log(`PPI (Freight Commodity): ${ppiFreightCommodity.length} points`);

  log(`Prepared ${indicators.length} economic indicator records`);
  if (!dryRun) {
    await insertIndicators(indicators);
    log(`✅ Inserted ${indicators.length} economic indicator records`);
  } else {
    log(`[dry-run] Would insert ${indicators.length} economic indicator records`);
  }
}

async function backfillRefineryData(start: string, end: string, dryRun: boolean): Promise<void> {
  separator('EIA  ▸  WPSR Refinery + Supply Data');
  log(`Date range: ${start} → ${end}`);

  const [utilRows, prodRows, stockRows] = await Promise.all([
    fetchRefineryUtilization(start, end),
    fetchRefineryProduction(start, end),
    fetchPetroleumStocks(start, end),
  ]);

  log(`Utilization: ${utilRows.length} rows`);
  log(`Production:  ${prodRows.length} rows`);
  log(`Stocks:      ${stockRows.length} rows`);

  // Merge all series into a single map keyed by (period, region)
  const merged = new Map<string, RefineryOperationsRow>();

  const ensureRow = (period: string, region: string): RefineryOperationsRow => {
    const key = `${period}|${region}`;
    if (!merged.has(key)) {
      merged.set(key, {
        time: new Date(period),
        region,
        utilization_pct: null,
        crude_inputs: null,
        gasoline_production: null,
        distillate_production: null,
        gasoline_stocks: null,
        distillate_stocks: null,
        operable_capacity: null,
        gasoline_imports: null,
        distillate_imports: null,
        crude_imports: null,
        total_exports: null,
        product_supplied_gas: null,
        product_supplied_dist: null,
      });
    }
    return merged.get(key)!;
  };

  for (const r of utilRows) {
    const row = ensureRow(r.period, r.region);
    if (r.utilization_pct !== undefined) row.utilization_pct = r.utilization_pct;
    if (r.crude_inputs     !== undefined) row.crude_inputs    = r.crude_inputs;
  }
  for (const r of prodRows) {
    const row = ensureRow(r.period, r.region);
    if (r.gasoline_production   !== undefined) row.gasoline_production   = r.gasoline_production;
    if (r.distillate_production !== undefined) row.distillate_production = r.distillate_production;
  }
  for (const r of stockRows) {
    const row = ensureRow(r.period, r.region);
    if (r.gasoline_stocks   !== undefined) row.gasoline_stocks   = r.gasoline_stocks;
    if (r.distillate_stocks !== undefined) row.distillate_stocks = r.distillate_stocks;
  }

  const rows = Array.from(merged.values());
  log(`Prepared ${rows.length} merged refinery/supply rows`);

  if (!dryRun) {
    await upsertRefineryData(rows);
    log(`✅ Upserted ${rows.length} refinery_operations records`);
  } else {
    log(`[dry-run] Would upsert ${rows.length} refinery_operations records`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs();

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║            GasTrack  ▸  Historical Data Backfill             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Start:   ${opts.start}`);
  console.log(`  End:     ${opts.end}`);
  console.log(`  Sources: ${opts.sources.join(', ')}`);
  console.log(`  Dry-run: ${opts.dryRun ? 'YES (no DB writes)' : 'no'}`);
  console.log();

  // Check API keys early
  const missing: string[] = [];
  if (opts.sources.some(s => ['gas', 'crude', 'diesel', 'refinery'].includes(s)) && !process.env.EIA_API_KEY) {
    missing.push('EIA_API_KEY');
  }
  if (opts.sources.includes('economic') && !process.env.FRED_API_KEY) {
    missing.push('FRED_API_KEY');
  }
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('   Add them to your .env file or set them in the shell before running.');
    process.exit(1);
  }

  const t0 = Date.now();
  const results: { source: string; status: 'ok' | 'error'; error?: string }[] = [];

  const run = async (source: Source, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push({ source, status: 'ok' });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`\n❌ Error processing "${source}": ${msg}`);
      results.push({ source, status: 'error', error: msg });
    }
  };

  // Run sources sequentially to stay well within EIA rate limits
  for (const source of opts.sources) {
    switch (source) {
      case 'gas':
        await run(source, () => backfillGasPrices(opts.start, opts.end, opts.dryRun));
        break;
      case 'crude':
        await run(source, () => backfillCrudePrices(opts.start, opts.end, opts.dryRun));
        break;
      case 'diesel':
        await run(source, () => backfillDieselPrices(opts.start, opts.end, opts.dryRun));
        break;
      case 'economic':
        await run(source, () => backfillEconomicIndicators(opts.start, opts.end, opts.dryRun));
        break;
      case 'refinery':
        await run(source, () => backfillRefineryData(opts.start, opts.end, opts.dryRun));
        break;
    }
  }

  // Refresh materialized views so history queries see the new data
  if (!opts.dryRun && results.some(r => r.status === 'ok')) {
    log('Refreshing materialized views (daily, weekly, monthly)...');
    await refreshMaterializedViews();
  }

  // Summary
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  separator(`Backfill complete  (${elapsed}s)`);
  for (const r of results) {
    const icon = r.status === 'ok' ? '✅' : '❌';
    const detail = r.error ? `  → ${r.error}` : '';
    console.log(`  ${icon}  ${r.source}${detail}`);
  }
  console.log();

  await closeConnection();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
