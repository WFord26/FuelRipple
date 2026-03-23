#!/usr/bin/env tsx
/**
 * Backfill AAA metro gas price aggregates from Wayback Machine.
 * 
 * Fetches historical metro data from Internet Archive snapshots 
 * and upserts into aaa_metro_aggregates for historical analysis.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-metro-wayback.ts [options]
 *
 * Options:
 *   --start <YYYY-MM-DD>    Start date (default: 1 year ago)
 *   --end   <YYYY-MM-DD>    End date (default: today)
 *   --dry-run               Parse but don't write
 *   --help                  Show this help
 *
 * Examples:
 *   npx tsx src/scripts/backfill-metro-wayback.ts
 *   npx tsx src/scripts/backfill-metro-wayback.ts --start 2023-01-01 --end 2023-12-31
 *   npx tsx src/scripts/backfill-metro-wayback.ts --dry-run
 */

import 'dotenv/config';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import axios from 'axios';
import * as cheerio from 'cheerio';
import { upsertMetroAggregates, closeConnection } from '@fuelripple/db';
import type { AaaMetroAggregateRow } from '@fuelripple/db';
import { clearCache } from '../services/cache';

interface BackfillOptions {
  startDate: Date;
  endDate: Date;
  dryRun: boolean;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Backfill AAA metro prices from Wayback Machine

Usage:
  npx tsx src/scripts/backfill-metro-wayback.ts [options]

Options:
  --start <YYYY-MM-DD>   Start date (default: 1 year ago)
  --end   <YYYY-MM-DD>   End date (default: today)
  --dry-run              Parse but don't write
  --help                 Show this help
`);
    process.exit(0);
  }

  const getDateArg = (flag: string, defaultDays: number): Date => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) {
      const parts = args[idx + 1].split('-');
      return new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    }
    const d = new Date();
    d.setDate(d.getDate() - defaultDays);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  };

  return {
    startDate: getDateArg('--start', 365),
    endDate: getDateArg('--end', 0),
    dryRun: args.includes('--dry-run'),
  };
}

/**
 * Parse price from Wayback snapshot
 */function parseMetroPrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0.5 || num > 10 ? null : num;
}

/**
 * Fetch a single date from Wayback Machine and parse metros
 */
async function fetchMetrosFromWayback(date: Date): Promise<AaaMetroAggregateRow[]> {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const url = `https://web.archive.org/web/${dateStr}*/gasprices.aaa.com`;
  const snapshotUrl = `https://web.archive.org/web/${dateStr}000000/gasprices.aaa.com`;

  try {
    const response = await axios.get(snapshotUrl, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GasTrack/1.0)',
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data as string);
    const rows: AaaMetroAggregateRow[] = [];

    // Parse metros from page — this is approximate since Wayback format varies
    // In production, would need more robust parsing per Wayback era
    const metros = new Map<string, Partial<AaaMetroAggregateRow>>();

    // Naive extraction: look for patterns like "CityName, ST" table rows
    $('table tr').each((_, tr) => {
      const cells = $(tr).find('td');
      if (cells.length >= 5) {
        const nameCell = cells.eq(0).text().trim();
        const match = nameCell.match(/^(.+?),\s*([A-Z]{2})$/);
        if (match) {
          const [, metro, state] = match;
          const regular = parseMetroPrice(cells.eq(1).text());
          const midGrade = parseMetroPrice(cells.eq(2).text());
          const premium = parseMetroPrice(cells.eq(3).text());
          const diesel = parseMetroPrice(cells.eq(4).text());

          if (regular || diesel) {
            metros.set(nameCell, {
              metro_id: nameCell,
              metro_name: nameCell,
              state_abbr: state,
              regular,
              mid_grade: midGrade,
              premium,
              diesel,
            });
          }
        }
      }
    });

    // Convert to full rows
    metros.forEach((m) => {
      rows.push({
        time: date,
        metro_id: m.metro_id || '',
        metro_name: m.metro_name || '',
        state_abbr: m.state_abbr || '',
        regular: m.regular ?? null,
        mid_grade: m.mid_grade ?? null,
        premium: m.premium ?? null,
        diesel: m.diesel ?? null,
      });
    });

    return rows;
  } catch (err: any) {
    console.warn(`  Wayback fetch failed for ${date.toISOString().split('T')[0]}: ${err.message}`);
    return [];
  }
}

/**
 * Run backfill
 */
async function backfill(opts: BackfillOptions): Promise<void> {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║ AAA Metro Prices — Wayback Machine Backfill               ║
╚════════════════════════════════════════════════════════════╝

→ Date range: ${opts.startDate.toISOString().split('T')[0]} → ${opts.endDate.toISOString().split('T')[0]}
→ Mode: ${opts.dryRun ? 'DRY RUN (no DB writes)' : 'LIVE (will write to DB)'}
`);

  const allRows: AaaMetroAggregateRow[] = [];
  const current = new Date(opts.startDate);
  let daysProcessed = 0;
  let rowsCollected = 0;

  while (current <= opts.endDate) {
    const dateStr = current.toISOString().split('T')[0];
    process.stdout.write(`→ Fetching ${dateStr}...`);

    const rows = await fetchMetrosFromWayback(current);
    
    if (rows.length > 0) {
      allRows.push(...rows);
      rowsCollected += rows.length;
      console.log(` ✓ ${rows.length} metros`);
    } else {
      console.log(' ✗ no data');
    }

    daysProcessed++;
    current.setDate(current.getDate() + 1);

    // Polite delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`
→ Summary
  Processing complete:
    Days processed: ${daysProcessed}
    Metro records collected: ${rowsCollected}
    Metros per day avg: ${(rowsCollected / daysProcessed).toFixed(1)}
`);

  if (allRows.length > 0 && !opts.dryRun) {
    console.log('→ Upserting to database...');
    await upsertMetroAggregates(allRows);
    await clearCache();
    console.log(`✅ Backfill complete: ${allRows.length} records written`);
  } else if (allRows.length === 0) {
    console.warn('⚠️  No data to write');
  } else {
    console.log('✓ Dry run complete (no writes)');
  }

  await closeConnection();
}

const opts = parseArgs();
backfill(opts).catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
