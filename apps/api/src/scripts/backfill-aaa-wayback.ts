#!/usr/bin/env tsx
/**
 * AAA Gas Prices — Wayback Machine Historical Backfill
 *
 * Recovers historical state-level gas prices from archived snapshots of
 * https://gasprices.aaa.com/state-gas-price-averages/ stored in the
 * Internet Archive's Wayback Machine.
 *
 * Coverage: ~Nov 2017 → present, with near-daily frequency in many periods.
 * Each snapshot contains all 50 states + DC with Regular, Mid-Grade, Premium,
 * and Diesel prices embedded directly in the HTML table.
 *
 * Approach:
 *   1. Query the CDX API to get all archived snapshot timestamps
 *   2. Fetch each snapshot's HTML from the Wayback Machine
 *   3. Parse the price table with cheerio
 *   4. Upsert into energy_prices with source='aaa_wayback'
 *
 * Usage:
 *   npx tsx src/scripts/backfill-aaa-wayback.ts [options]
 *
 * Options:
 *   --start <YYYY-MM-DD>    Only fetch snapshots on or after this date (default: 2017-01-01)
 *   --end   <YYYY-MM-DD>    Only fetch snapshots on or before this date (default: today)
 *   --delay <ms>            Delay between Wayback requests in ms (default: 1500)
 *   --out <path>            Also write results to a CSV file (optional)
 *   --dry-run               Parse and log but do not write to DB
 *   --limit <n>             Stop after processing n snapshots (for testing)
 *   --help                  Show this help
 *
 * Examples:
 *   # Full backfill
 *   npx tsx src/scripts/backfill-aaa-wayback.ts
 *
 *   # Just 2020 data, dry run
 *   npx tsx src/scripts/backfill-aaa-wayback.ts --start 2020-01-01 --end 2020-12-31 --dry-run
 *
 *   # Quick test with 10 snapshots
 *   npx tsx src/scripts/backfill-aaa-wayback.ts --limit 10 --dry-run
 *
 *   # Export to CSV without DB writes
 *   npx tsx src/scripts/backfill-aaa-wayback.ts --out aaa-wayback.csv --dry-run
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import {
  insertPrices,
  refreshMaterializedViews,
  closeConnection,
} from '@fuelripple/db';

import type { EnergyPrice } from '@fuelripple/shared';
import { ABBR_TO_DUOAREA } from '../utils/regionMapper';

// ─── Constants ────────────────────────────────────────────────────────────────

const CDX_API = 'https://web.archive.org/cdx/search/cdx';
const WAYBACK_BASE = 'https://web.archive.org/web';
const TARGET_URL = 'https://gasprices.aaa.com/state-gas-price-averages/';

/** Map full state names → 2-letter abbreviations (AAA uses full names in the table) */
const STATE_NAME_TO_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface CDXEntry {
  timestamp: string; // e.g. '20191210091834'
  url: string;
  statusCode: string;
  mimeType: string;
}

interface ParsedSnapshot {
  /** Date derived from the Wayback timestamp */
  snapshotDate: Date;
  /** Timestamp string for constructing the Wayback URL */
  timestamp: string;
  /** Parsed state prices */
  prices: StatePriceRow[];
}

interface StatePriceRow {
  state: string;      // 2-letter abbreviation
  regular: number | null;
  midGrade: number | null;
  premium: number | null;
  diesel: number | null;
}

interface ScriptOptions {
  start: string;
  end: string;
  delayMs: number;
  outPath: string | null;
  dryRun: boolean;
  limit: number | null;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
AAA Gas Prices — Wayback Machine Historical Backfill

Recovers state-level gas prices from archived Wayback Machine snapshots
of gasprices.aaa.com/state-gas-price-averages/ (Nov 2017 – present).

Options:
  --start <YYYY-MM-DD>    Start date (default: 2017-01-01)
  --end   <YYYY-MM-DD>    End date   (default: today)
  --delay <ms>            Request delay ms (default: 1500)
  --out   <path>          Write CSV output file (optional)
  --dry-run               No DB writes
  --limit <n>             Max snapshots to process
  --help                  Show this help
`);
    process.exit(0);
  }

  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  return {
    start: get('--start') ?? '2017-01-01',
    end: get('--end') ?? new Date().toISOString().slice(0, 10),
    delayMs: parseInt(get('--delay') ?? '1500', 10),
    outPath: get('--out') ?? null,
    dryRun: args.includes('--dry-run'),
    limit: get('--limit') ? parseInt(get('--limit')!, 10) : null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Parse a Wayback timestamp (YYYYMMDDHHmmss) into a Date.
 * We use midnight of the date portion as the canonical time.
 */
function timestampToDate(ts: string): Date {
  const year = ts.slice(0, 4);
  const month = ts.slice(4, 6);
  const day = ts.slice(6, 8);
  return new Date(`${year}-${month}-${day}T12:00:00Z`);
}

/**
 * Convert a date string (YYYY-MM-DD) to a Wayback-style timestamp prefix (YYYYMMDD).
 */
function dateToTimestampPrefix(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Parse a dollar price string like "$3.456" or "3.456" into a number.
 * Returns null if not a valid price.
 */
function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  // Sanity check: gas prices between $0.50 and $15.00
  return isNaN(num) || num < 0.5 || num > 15 ? null : num;
}

// ─── CDX API: Discover all archived snapshots ─────────────────────────────────

/**
 * Query the Wayback Machine CDX API to get all snapshot timestamps for the
 * AAA state-gas-price-averages page.
 *
 * We collapse by day (timestamp:8) to get at most one snapshot per day,
 * which is sufficient since AAA updates daily.
 */
async function fetchSnapshotTimestamps(start: string, end: string): Promise<CDXEntry[]> {
  const fromTs = dateToTimestampPrefix(start);
  const toTs = dateToTimestampPrefix(end);

  log(`Querying CDX API for snapshots from ${start} to ${end}...`);

  const resp = await axios.get(CDX_API, {
    params: {
      url: TARGET_URL,
      output: 'json',
      fl: 'timestamp,original,statuscode,mimetype',
      filter: 'statuscode:200',
      collapse: 'timestamp:8', // one per day
      from: fromTs,
      to: toTs,
    },
    timeout: 60_000,
  });

  const data = resp.data as string[][];

  // First row is the header: ['timestamp', 'original', 'statuscode', 'mimetype']
  if (!data || data.length <= 1) {
    return [];
  }

  return data.slice(1).map(row => ({
    timestamp: row[0],
    url: row[1],
    statusCode: row[2],
    mimeType: row[3],
  }));
}

// ─── HTML Parser: Extract prices from a Wayback snapshot ──────────────────────

/**
 * Fetch and parse a single Wayback Machine snapshot.
 *
 * The AAA state-gas-price-averages page contains a table with rows like:
 *   | California | $4.061 | $4.218 | $4.328 | $4.181 |
 *   (state name, regular, mid-grade, premium, diesel)
 */
async function fetchAndParse(timestamp: string): Promise<StatePriceRow[]> {
  const url = `${WAYBACK_BASE}/${timestamp}/${TARGET_URL}`;

  const resp = await axios.get(url, {
    timeout: 30_000,
    headers: {
      'User-Agent': 'FuelRipple-WaybackScraper/1.0 (+https://github.com/fuelripple)',
      'Accept': 'text/html',
    },
    // Follow redirects (Wayback sometimes redirects to nearest snapshot)
    maxRedirects: 5,
  });

  const html = resp.data as string;
  return parseStatePriceTable(html);
}

/**
 * Parse the state price table from the HTML.
 *
 * Handles two known AAA table layouts:
 *
 * Layout A (pre-2020): A single HTML table where each <tr> contains:
 *   <td>State Name</td> <td>$X.XXX</td> <td>$X.XXX</td> <td>$X.XXX</td> <td>$X.XXX</td>
 *
 * Layout B (2020+): Similar table structure, potentially with different CSS classes,
 *   but same column order: State, Regular, Mid-Grade, Premium, Diesel.
 */
function parseStatePriceTable(html: string): StatePriceRow[] {
  const $ = cheerio.load(html);
  const results: StatePriceRow[] = [];

  // Strategy 1: Look for table rows where the first cell matches a known state name
  $('table tr, tbody tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length < 5) return;

    const firstCell = $(cells[0]).text().trim();

    // Check if the first cell is a known state name
    const abbr = STATE_NAME_TO_ABBR[firstCell];
    if (!abbr) return;

    const regular = parsePrice($(cells[1]).text());
    const midGrade = parsePrice($(cells[2]).text());
    const premium = parsePrice($(cells[3]).text());
    const diesel = parsePrice($(cells[4]).text());

    // At least one price must be valid
    if (regular === null && midGrade === null && premium === null && diesel === null) return;

    results.push({ state: abbr, regular, midGrade, premium, diesel });
  });

  if (results.length > 0) return results;

  // Strategy 2: Some Wayback snapshots have the data in a <div> or list structure
  // rather than a proper <table>. Try to find price rows by pattern matching.
  // Look for sequences of: state name followed by 4 dollar amounts.
  const text = $('body').text();
  for (const [stateName, abbr] of Object.entries(STATE_NAME_TO_ABBR)) {
    // Match state name followed by up to 4 prices on the same "line"
    // Allow for various whitespace/separators
    const escaped = stateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `${escaped}\\s+\\$?([\\d.]+)\\s+\\$?([\\d.]+)\\s+\\$?([\\d.]+)\\s+\\$?([\\d.]+)`,
      'i',
    );
    const match = text.match(pattern);
    if (match) {
      const regular = parsePrice(match[1]);
      const midGrade = parsePrice(match[2]);
      const premium = parsePrice(match[3]);
      const diesel = parsePrice(match[4]);
      if (regular !== null || midGrade !== null || premium !== null || diesel !== null) {
        results.push({ state: abbr, regular, midGrade, premium, diesel });
      }
    }
  }

  return results;
}

// ─── DB Ingestion ─────────────────────────────────────────────────────────────

/**
 * Convert parsed state prices into EnergyPrice rows for the database.
 *
 * Maps each (state, grade) pair into a separate row in energy_prices:
 *   - source: 'aaa_wayback'  (distinguishable from live 'aaa' scrapes)
 *   - metric: 'gas_regular' | 'gas_midgrade' | 'gas_premium' | 'diesel'
 *   - region: EIA duoarea code (e.g. 'SCA' for California)
 *   - unit: 'usd_per_gallon'
 */
function toEnergyPrices(snapshot: ParsedSnapshot): EnergyPrice[] {
  const prices: EnergyPrice[] = [];

  for (const row of snapshot.prices) {
    const duoarea = ABBR_TO_DUOAREA[row.state];
    if (!duoarea) continue; // skip unknown states

    const grades: { metric: EnergyPrice['metric']; value: number | null }[] = [
      { metric: 'gas_regular', value: row.regular },
      { metric: 'gas_midgrade', value: row.midGrade },
      { metric: 'gas_premium', value: row.premium },
      { metric: 'diesel', value: row.diesel },
    ];

    for (const { metric, value } of grades) {
      if (value === null) continue;
      prices.push({
        time: snapshot.snapshotDate,
        source: 'aaa_wayback',
        metric,
        region: duoarea,
        value,
        unit: 'usd_per_gallon',
      });
    }
  }

  return prices;
}

// ─── CSV Output ───────────────────────────────────────────────────────────────

function initCsvFile(outPath: string): void {
  const header = 'date,state,regular,mid_grade,premium,diesel\n';
  fs.writeFileSync(outPath, header, 'utf8');
}

function appendCsvRows(outPath: string, snapshot: ParsedSnapshot): void {
  const dateStr = snapshot.snapshotDate.toISOString().slice(0, 10);
  const lines = snapshot.prices
    .map(r =>
      `${dateStr},${r.state},${r.regular ?? ''},${r.midGrade ?? ''},${r.premium ?? ''},${r.diesel ?? ''}`,
    )
    .join('\n');
  fs.appendFileSync(outPath, lines + '\n', 'utf8');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs();

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  AAA Gas Prices — Wayback Machine Historical Backfill       ║');
  console.log('║  Source: web.archive.org → gasprices.aaa.com                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Start:    ${opts.start}`);
  console.log(`  End:      ${opts.end}`);
  console.log(`  Delay:    ${opts.delayMs}ms between requests`);
  console.log(`  Dry-run:  ${opts.dryRun ? 'YES (no DB writes)' : 'no'}`);
  console.log(`  Limit:    ${opts.limit ?? 'none'}`);
  console.log(`  CSV out:  ${opts.outPath ?? 'none'}`);
  console.log();

  // ── Step 1: Discover all snapshot timestamps via CDX API ──
  const entries = await fetchSnapshotTimestamps(opts.start, opts.end);
  log(`CDX API returned ${entries.length} snapshot(s)`);

  if (entries.length === 0) {
    log('No snapshots found for the given date range. Exiting.');
    process.exit(0);
  }

  // Apply limit if requested
  const toProcess = opts.limit ? entries.slice(0, opts.limit) : entries;
  log(`Will process ${toProcess.length} snapshot(s)`);

  const firstDate = timestampToDate(toProcess[0].timestamp).toISOString().slice(0, 10);
  const lastDate = timestampToDate(toProcess[toProcess.length - 1].timestamp).toISOString().slice(0, 10);
  log(`Date range: ${firstDate} → ${lastDate}`);
  console.log();

  // ── Step 2: Init CSV if requested ──
  if (opts.outPath) {
    initCsvFile(path.resolve(opts.outPath));
    log(`CSV output: ${path.resolve(opts.outPath)}`);
  }

  // ── Step 3: Fetch and parse each snapshot ──
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let totalPriceRows = 0;
  let totalDbRows = 0;
  const seenDates = new Set<string>();
  const batchPrices: EnergyPrice[] = [];
  const BATCH_SIZE = 500; // flush to DB every N price rows

  for (const entry of toProcess) {
    processed++;
    const snapshotDate = timestampToDate(entry.timestamp);
    const dateStr = snapshotDate.toISOString().slice(0, 10);

    // Skip if we've already processed this date (CDX collapse=8 should prevent this,
    // but guard against edge cases)
    if (seenDates.has(dateStr)) {
      continue;
    }
    seenDates.add(dateStr);

    const progress = `[${processed}/${toProcess.length}]`;

    try {
      const rows = await fetchAndParse(entry.timestamp);

      if (rows.length === 0) {
        log(`${progress} ${dateStr} — no price data found, skipping`);
        failed++;
      } else {
        const snapshot: ParsedSnapshot = {
          snapshotDate,
          timestamp: entry.timestamp,
          prices: rows,
        };

        const dbRows = toEnergyPrices(snapshot);
        totalPriceRows += rows.length;
        totalDbRows += dbRows.length;

        // Append to CSV if requested
        if (opts.outPath) {
          appendCsvRows(path.resolve(opts.outPath), snapshot);
        }

        // Add to batch
        if (!opts.dryRun) {
          batchPrices.push(...dbRows);
        }

        // Flush batch to DB if large enough
        if (batchPrices.length >= BATCH_SIZE) {
          await insertPrices(batchPrices);
          log(`  → Flushed ${batchPrices.length} rows to DB`);
          batchPrices.length = 0;
        }

        succeeded++;
        log(`${progress} ${dateStr} — ${rows.length} states, ${dbRows.length} DB rows`);
      }
    } catch (err: any) {
      failed++;
      const code = err.response?.status ?? '';
      log(`${progress} ${dateStr} — ERROR ${code}: ${err.message}`);

      // If rate-limited (429 or 503+Retry-After), wait and retry once
      if (err.response?.status === 429 || err.response?.status === 503) {
        const retryAfter = parseInt(err.response?.headers?.['retry-after'] ?? '30', 10);
        log(`  ⏳ Rate-limited. Waiting ${retryAfter}s before retry...`);
        await sleep(retryAfter * 1000);

        try {
          const rows = await fetchAndParse(entry.timestamp);
          if (rows.length > 0) {
            const snapshot: ParsedSnapshot = { snapshotDate, timestamp: entry.timestamp, prices: rows };
            const dbRows = toEnergyPrices(snapshot);
            totalPriceRows += rows.length;
            totalDbRows += dbRows.length;
            if (opts.outPath) appendCsvRows(path.resolve(opts.outPath), snapshot);
            if (!opts.dryRun) batchPrices.push(...dbRows);
            succeeded++;
            failed--;
            log(`  ✓ Retry succeeded: ${rows.length} states`);
          }
        } catch {
          // give up on this snapshot
        }
      }
    }

    // Polite delay between requests
    await sleep(opts.delayMs);
  }

  // ── Step 4: Flush remaining batch ──
  if (batchPrices.length > 0 && !opts.dryRun) {
    await insertPrices(batchPrices);
    log(`→ Flushed final ${batchPrices.length} rows to DB`);
  }

  // ── Step 5: Refresh materialized views ──
  if (!opts.dryRun && succeeded > 0) {
    log('Refreshing materialized views...');
    await refreshMaterializedViews();
  }

  // ── Summary ──
  const elapsed = process.uptime();
  console.log('\n' + '─'.repeat(60));
  console.log('  AAA Wayback Backfill — Summary');
  console.log('─'.repeat(60));
  console.log(`  Snapshots processed:  ${processed}`);
  console.log(`  Succeeded:            ${succeeded}`);
  console.log(`  Failed/empty:         ${failed}`);
  console.log(`  Unique dates:         ${seenDates.size}`);
  console.log(`  State-price rows:     ${totalPriceRows.toLocaleString()}`);
  console.log(`  DB rows generated:    ${totalDbRows.toLocaleString()}`);
  if (opts.outPath) {
    console.log(`  CSV output:           ${path.resolve(opts.outPath)}`);
  }
  console.log(`  Elapsed:              ${elapsed.toFixed(1)}s`);
  console.log(`  Dry-run:              ${opts.dryRun ? 'YES' : 'no'}`);
  console.log();

  await closeConnection();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
