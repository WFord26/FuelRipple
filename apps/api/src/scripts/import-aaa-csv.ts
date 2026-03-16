#!/usr/bin/env tsx
/**
 * Import AAA state-level gas price history CSV into the FuelRipple database.
 *
 * Reads the combined CSV produced by scrape-aaa-history.ts and upserts
 * each row as four energy_prices records (regular, midgrade, premium, diesel),
 * matching the same format the live AAA scraper uses in jobQueue.ts.
 *
 * Usage:
 *   npx tsx src/scripts/import-aaa-csv.ts [options]
 *
 * Options:
 *   --csv <path>          Path to the combined CSV (default: aaa-state-daily-history.csv)
 *   --dry-run             Parse and show stats but skip DB writes
 *   --help                Show this help
 *
 * Examples:
 *   npx tsx src/scripts/import-aaa-csv.ts
 *   npx tsx src/scripts/import-aaa-csv.ts --csv /path/to/file.csv --dry-run
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';

// Load .env from monorepo root (two levels up from apps/api)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { insertPrices, refreshMaterializedViews, closeConnection } from '@fuelripple/db';
import { EnergyPrice } from '@fuelripple/shared';
import { abbrToDuoarea } from '../utils/regionMapper';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportOptions {
  csvPath: string;
  dryRun: boolean;
}

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Import AAA state-level gas price history into the FuelRipple database.

Usage:
  npx tsx src/scripts/import-aaa-csv.ts [options]

Options:
  --csv <path>   Path to combined CSV (default: aaa-state-daily-history.csv)
  --dry-run      Parse and show stats, skip DB writes
  --help         Show this help
`);
    process.exit(0);
  }

  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  return {
    csvPath: get('--csv') ?? 'aaa-state-daily-history.csv',
    dryRun: args.includes('--dry-run'),
  };
}

// ─── CSV → EnergyPrice[] ─────────────────────────────────────────────────────

function parseCsvToEnergyPrices(csvPath: string): {
  prices: EnergyPrice[];
  dates: Set<string>;
  states: Set<string>;
  skipped: number;
} {
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);

  const prices: EnergyPrice[] = [];
  const dates = new Set<string>();
  const states = new Set<string>();
  let skipped = 0;

  // Skip header: Date,State,Abbreviation,Regular,Mid-Grade,Premium,Diesel
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 7) {
      skipped++;
      continue;
    }

    const date = cols[0].trim();
    const abbr = cols[2].trim();
    const regular = parseFloat(cols[3]);
    const midGrade = parseFloat(cols[4]);
    const premium = parseFloat(cols[5]);
    const diesel = parseFloat(cols[6]);

    // Validate
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skipped++;
      continue;
    }

    const duoarea = abbrToDuoarea(abbr);
    if (!duoarea) {
      skipped++;
      continue;
    }

    const time = new Date(`${date}T00:00:00Z`);
    dates.add(date);
    states.add(abbr);

    // Create 4 records per row, matching the live AAA ingestion in jobQueue.ts
    if (!isNaN(regular)) {
      prices.push({ time, source: 'aaa', metric: 'gas_regular', region: duoarea, value: regular, unit: 'usd_per_gallon' });
    }
    if (!isNaN(midGrade)) {
      prices.push({ time, source: 'aaa', metric: 'gas_midgrade', region: duoarea, value: midGrade, unit: 'usd_per_gallon' });
    }
    if (!isNaN(premium)) {
      prices.push({ time, source: 'aaa', metric: 'gas_premium', region: duoarea, value: premium, unit: 'usd_per_gallon' });
    }
    if (!isNaN(diesel)) {
      prices.push({ time, source: 'aaa', metric: 'diesel', region: duoarea, value: diesel, unit: 'usd_per_gallon' });
    }
  }

  return { prices, dates, states, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const csvPath = path.resolve(opts.csvPath);

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  AAA State Gas Prices — CSV → Database Importer        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  if (!fs.existsSync(csvPath)) {
    console.error(`✗ CSV file not found: ${csvPath}`);
    console.error('  Run scrape-aaa-history.ts first to generate it.');
    process.exit(1);
  }

  console.log(`→ Reading ${csvPath} ...`);
  const { prices, dates, states, skipped } = parseCsvToEnergyPrices(csvPath);

  const sortedDates = [...dates].sort();
  console.log();
  console.log(`  CSV rows parsed:    ${(prices.length / 4).toLocaleString()} state-days`);
  console.log(`  Energy price rows:  ${prices.length.toLocaleString()} (4 metrics × state-day)`);
  console.log(`  Unique dates:       ${dates.size}`);
  console.log(`  Date range:         ${sortedDates[0]} → ${sortedDates[sortedDates.length - 1]}`);
  console.log(`  States:             ${states.size}`);
  console.log(`  Skipped rows:       ${skipped}`);
  console.log();

  if (opts.dryRun) {
    console.log('🏁 Dry run — no data written to DB.');

    // Show a sample
    console.log('\nSample records:');
    for (const p of prices.slice(0, 8)) {
      console.log(`  ${(p.time as Date).toISOString().slice(0, 10)}  ${p.region}  ${p.metric.padEnd(12)}  $${p.value}`);
    }
    process.exit(0);
  }

  // Insert in date-based batches for progress visibility
  const BATCH_SIZE = 5000;
  const total = prices.length;
  let inserted = 0;

  console.log(`→ Inserting ${total.toLocaleString()} records into energy_prices ...`);
  console.log(`  (using ON CONFLICT IGNORE — safe to re-run)\n`);

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = prices.slice(i, i + BATCH_SIZE);
    await insertPrices(batch);
    inserted += batch.length;
    const pct = ((inserted / total) * 100).toFixed(1);
    process.stdout.write(`\r  Progress: ${inserted.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`);
  }

  console.log('\n');
  console.log('→ Refreshing materialized views ...');
  await refreshMaterializedViews();

  console.log();
  console.log('✓ Import complete!');
  console.log(`  ${inserted.toLocaleString()} records written (duplicates auto-skipped).`);

  await closeConnection();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  try { await closeConnection(); } catch {}
  process.exit(1);
});
