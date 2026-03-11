#!/usr/bin/env tsx
/**
 * Crude oil price download script
 *
 * Fetches daily WTI and Brent closing prices from Yahoo Finance
 * (tickers: CL=F and BZ=F) and upserts them into the GasTrack database.
 * Optionally writes a CSV file for offline analysis.
 *
 * Usage:
 *   npx tsx src/scripts/download-crude.ts [options]
 *
 * Options:
 *   --start <YYYY-MM-DD>   Start date (default: 1 year ago)
 *   --end   <YYYY-MM-DD>   End date   (default: today)
 *   --dry-run              Fetch and display, but skip DB inserts
 *   --csv   <path>         Also write results to a CSV file
 *   --help                 Show this help text
 *
 * Examples:
 *   # Last year into the DB
 *   npx tsx src/scripts/download-crude.ts
 *
 *   # Custom range, dry run with CSV output
 *   npx tsx src/scripts/download-crude.ts --start 2024-01-01 --dry-run --csv crude.csv
 *
 *   # Specific window
 *   npx tsx src/scripts/download-crude.ts --start 2025-01-01 --end 2025-06-30
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';

// Load .env from monorepo root (two levels up from apps/api)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { fetchCrudeHistory, CrudeDailyBar } from '../services/marketClient';
import { insertPrices, closeConnection } from '@fuelripple/db';
import { EnergyPrice } from '@fuelripple/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DownloadOptions {
  start: string;
  end: string;
  dryRun: boolean;
  csvPath: string | null;
}

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

function parseArgs(): DownloadOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Crude oil price download script

Usage:
  npx tsx src/scripts/download-crude.ts [options]

Options:
  --start <YYYY-MM-DD>   Start date (default: 1 year ago)
  --end   <YYYY-MM-DD>   End date   (default: today)
  --dry-run              Fetch but do not write to DB
  --csv   <path>         Also write results to a CSV file
  --help                 Show this help
`);
    process.exit(0);
  }

  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  // Default start: 1 year ago
  const defaultStart = new Date();
  defaultStart.setFullYear(defaultStart.getFullYear() - 1);
  const startStr = get('--start') ?? defaultStart.toISOString().slice(0, 10);

  // Default end: today
  const endStr = get('--end') ?? new Date().toISOString().slice(0, 10);

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

  return {
    start: startStr,
    end: endStr,
    dryRun: args.includes('--dry-run'),
    csvPath: get('--csv') ?? null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function separator(label: string): void {
  const line = '─'.repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}`);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Write WTI + Brent bars to CSV */
function writeCsv(
  csvPath: string,
  wti: CrudeDailyBar[],
  brent: CrudeDailyBar[]
): void {
  const rows: string[] = ['date,ticker,open,high,low,close,volume'];

  for (const bar of wti) {
    rows.push(
      `${formatDate(bar.date)},CL=F,${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`
    );
  }
  for (const bar of brent) {
    rows.push(
      `${formatDate(bar.date)},BZ=F,${bar.open},${bar.high},${bar.low},${bar.close},${bar.volume}`
    );
  }

  const absPath = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath);
  fs.writeFileSync(absPath, rows.join('\n') + '\n', 'utf-8');
  log(`📄 CSV written → ${absPath} (${rows.length - 1} data rows)`);
}

/** Convert bars to EnergyPrice rows for DB insert */
function barsToEnergyPrices(
  wti: CrudeDailyBar[],
  brent: CrudeDailyBar[]
): EnergyPrice[] {
  const prices: EnergyPrice[] = [];

  for (const bar of wti) {
    if (!isFinite(bar.close) || bar.close <= 0) continue;
    prices.push({
      time: bar.date,
      source: 'yahoo',
      metric: 'crude_wti',
      region: 'US',
      value: bar.close,
      unit: 'usd_per_barrel',
    });
  }

  for (const bar of brent) {
    if (!isFinite(bar.close) || bar.close <= 0) continue;
    prices.push({
      time: bar.date,
      source: 'yahoo',
      metric: 'crude_brent',
      region: 'US',
      value: bar.close,
      unit: 'usd_per_barrel',
    });
  }

  return prices;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs();

  separator('Crude Oil Price Download');
  log(`Source  : Yahoo Finance (CL=F / BZ=F)`);
  log(`Range   : ${opts.start} → ${opts.end}`);
  log(`Dry-run : ${opts.dryRun}`);
  if (opts.csvPath) log(`CSV out : ${opts.csvPath}`);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  log('\nFetching data from Yahoo Finance…');
  const { wti, brent } = await fetchCrudeHistory(new Date(opts.start), new Date(opts.end));

  log(`WTI   (CL=F): ${wti.length} daily bars`);
  log(`Brent (BZ=F): ${brent.length} daily bars`);

  if (wti.length === 0 && brent.length === 0) {
    log('⚠️  No data returned — check the date range and Yahoo Finance availability.');
    await closeConnection();
    return;
  }

  // Preview most-recent closes
  if (wti.length > 0) {
    const last = wti[wti.length - 1];
    log(`WTI   latest close : $${last.close.toFixed(2)}/bbl on ${formatDate(last.date)}`);
  }
  if (brent.length > 0) {
    const last = brent[brent.length - 1];
    log(`Brent latest close : $${last.close.toFixed(2)}/bbl on ${formatDate(last.date)}`);
  }

  // ── CSV ────────────────────────────────────────────────────────────────────
  if (opts.csvPath) {
    writeCsv(opts.csvPath, wti, brent);
  }

  // ── Database insert ────────────────────────────────────────────────────────
  const prices = barsToEnergyPrices(wti, brent);
  log(`\nPrepared ${prices.length} price rows for DB`);

  if (opts.dryRun) {
    log('[dry-run] Skipping DB insert.');
  } else {
    log('Inserting into energy_prices…');
    await insertPrices(prices);
    log(`✅ Inserted / skipped-duplicate ${prices.length} crude price records.`);
  }

  separator('Done');
  await closeConnection();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
