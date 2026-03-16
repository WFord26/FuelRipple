#!/usr/bin/env tsx
/**
 * AAA state-level gas price history scraper
 *
 * Walks the git history of https://github.com/lykmapipo/US-Gas-Prices
 * (folder: data/state-daily-averages/) and downloads every daily CSV
 * snapshot committed since 2023. Produces a single combined CSV file.
 *
 * The upstream repo replaces the CSV file each day, so the only way to
 * recover historical data is to fetch the file at each commit SHA.
 *
 * Usage:
 *   npx tsx src/scripts/scrape-aaa-history.ts [options]
 *
 * Options:
 *   --out <path>          Output CSV path (default: aaa-state-daily-history.csv)
 *   --token <token>       GitHub PAT for higher rate limits (optional)
 *   --start <YYYY-MM-DD>  Only include dates on or after (optional)
 *   --end   <YYYY-MM-DD>  Only include dates on or before (optional)
 *   --help                Show this help
 *
 * Examples:
 *   npx tsx src/scripts/scrape-aaa-history.ts
 *   npx tsx src/scripts/scrape-aaa-history.ts --out data/aaa.csv --start 2024-01-01
 *   npx tsx src/scripts/scrape-aaa-history.ts --token ghp_xxxxx
 */

import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────

const OWNER = 'lykmapipo';
const REPO = 'US-Gas-Prices';
const FILE_PATH = 'data/state-daily-averages';
const PER_PAGE = 100; // max for GitHub API

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommitEntry {
  sha: string;
  date: string; // ISO date from commit
}

interface StateRow {
  date: string;
  state_name: string;
  state_abbr: string;
  regular: string;
  mid_grade: string;
  premium: string;
  diesel: string;
}

interface ScraperOptions {
  outPath: string;
  token: string | null;
  startDate: string | null;
  endDate: string | null;
}

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

function parseArgs(): ScraperOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
AAA state-level gas price history scraper

Walks the full git history of lykmapipo/US-Gas-Prices to recover
daily state-level gas price snapshots and combines them into one CSV.

Usage:
  npx tsx src/scripts/scrape-aaa-history.ts [options]

Options:
  --out <path>          Output CSV path (default: aaa-state-daily-history.csv)
  --token <token>       GitHub PAT (increases rate limit from 60 → 5000/hr)
  --start <YYYY-MM-DD>  Only include dates on or after
  --end   <YYYY-MM-DD>  Only include dates on or before
  --help                Show this help
`);
    process.exit(0);
  }

  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  return {
    outPath: get('--out') ?? 'aaa-state-daily-history.csv',
    token: get('--token') ?? process.env.GITHUB_TOKEN ?? null,
    startDate: get('--start') ?? null,
    endDate: get('--end') ?? null,
  };
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

function createGitHubClient(token: string | null): AxiosInstance {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'FuelRipple-Scraper/1.0',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return axios.create({
    baseURL: 'https://api.github.com',
    headers,
    timeout: 30_000,
  });
}

/**
 * Fetch all commits that touched the state-daily-averages folder.
 * Pages through the entire history.
 */
async function fetchAllCommits(
  gh: AxiosInstance,
  startDate: string | null,
  endDate: string | null,
): Promise<CommitEntry[]> {
  const commits: CommitEntry[] = [];
  let page = 1;
  let hasMore = true;

  const params: Record<string, string | number> = {
    path: FILE_PATH,
    per_page: PER_PAGE,
  };
  if (startDate) params.since = `${startDate}T00:00:00Z`;
  if (endDate) params.until = `${endDate}T23:59:59Z`;

  while (hasMore) {
    const url = `/repos/${OWNER}/${REPO}/commits`;
    const resp = await gh.get(url, { params: { ...params, page } });

    if (!resp.data || resp.data.length === 0) {
      hasMore = false;
      break;
    }

    for (const c of resp.data) {
      commits.push({
        sha: c.sha,
        date: c.commit.committer.date.slice(0, 10), // YYYY-MM-DD
      });
    }

    if (resp.data.length < PER_PAGE) {
      hasMore = false;
    } else {
      page++;
    }

    // Be polite — small delay between pages
    await sleep(300);
  }

  return commits;
}

/**
 * Given a commit SHA, list the CSV filename(s) in the state-daily-averages
 * directory at that point in time, then fetch and return the raw CSV text.
 */
async function fetchCsvAtCommit(
  gh: AxiosInstance,
  sha: string,
): Promise<string | null> {
  try {
    // List the directory contents at that SHA
    const treeResp = await gh.get(
      `/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`,
      { params: { ref: sha } },
    );

    // Find the CSV file (ignore .gitkeep etc.)
    const csvFile = (treeResp.data as any[]).find(
      (f: any) => f.name.endsWith('.csv'),
    );

    if (!csvFile) return null;

    // Fetch the raw content
    const rawResp = await axios.get(csvFile.download_url, {
      timeout: 15_000,
      responseType: 'text',
    });

    return rawResp.data as string;
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

/**
 * Parse the upstream CSV into normalised rows.
 * Handles the known format:
 *   State-Name,State-Abbreviation,Regular,Mid-Grade,Premium,Diesel,Currency,Unit,Date
 */
function parseCsv(raw: string): StateRow[] {
  const rows: StateRow[] = [];
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);

  // Skip header
  const header = lines[0];
  if (!header.includes('State-Name')) return rows;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    // The CSV has 9 columns; some state names contain spaces but no commas
    // Format: State-Name,State-Abbreviation,Regular,Mid-Grade,Premium,Diesel,Currency,Unit,Date
    if (cols.length < 9) continue;

    // Handle potential extra commas in Currency field ("U.S Dollar" is fine)
    // We know the last column is a date (YYYY-MM-DD), work backwards
    const date = cols[cols.length - 1].trim();
    const unit = cols[cols.length - 2].trim();
    const currency = cols[cols.length - 3].trim();
    const diesel = cols[cols.length - 4].trim();
    const premium = cols[cols.length - 5].trim();
    const midGrade = cols[cols.length - 6].trim();
    const regular = cols[cols.length - 7].trim();
    const stateAbbr = cols[cols.length - 8].trim();
    // Everything before the abbreviation is the state name
    const stateNameParts = cols.slice(0, cols.length - 8);
    const stateName = stateNameParts.join(',').trim();

    // Validate — skip malformed rows
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (stateAbbr.length !== 2) continue;

    rows.push({
      date,
      state_name: stateName,
      state_abbr: stateAbbr,
      regular,
      mid_grade: midGrade,
      premium,
      diesel,
    });
  }

  return rows;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function formatRateLimit(headers: Record<string, any>) {
  const remaining = headers['x-ratelimit-remaining'];
  const limit = headers['x-ratelimit-limit'];
  const resetEpoch = headers['x-ratelimit-reset'];
  if (!remaining) return '';
  const resetAt = new Date(Number(resetEpoch) * 1000).toLocaleTimeString();
  return `  [rate limit: ${remaining}/${limit}, resets ${resetAt}]`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  AAA State Gas Prices — Historical Scraper              ║');
  console.log('║  Source: github.com/lykmapipo/US-Gas-Prices             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  const gh = createGitHubClient(opts.token);

  // Check rate limit first
  try {
    const rl = await gh.get('/rate_limit');
    const core = rl.data.resources.core;
    console.log(
      `GitHub API rate limit: ${core.remaining}/${core.limit}` +
        ` (resets ${new Date(core.reset * 1000).toLocaleTimeString()})`,
    );
    if (!opts.token && core.remaining < 100) {
      console.warn(
        '\n⚠  Low rate limit! Pass --token <PAT> for 5000 req/hr.\n',
      );
    }
    console.log();
  } catch {
    // non-fatal
  }

  // Step 1: Collect all commits
  console.log('→ Fetching commit history for data/state-daily-averages ...');
  const commits = await fetchAllCommits(gh, opts.startDate, opts.endDate);
  console.log(`  Found ${commits.length} commits.\n`);

  if (commits.length === 0) {
    console.log('No commits found. Exiting.');
    process.exit(0);
  }

  // De-duplicate by date (keep earliest commit per date in case of re-runs)
  const byDate = new Map<string, string>(); // date → sha
  for (const c of commits) {
    if (!byDate.has(c.date)) {
      byDate.set(c.date, c.sha);
    }
  }

  const uniqueDates = [...byDate.keys()].sort();
  console.log(
    `  ${uniqueDates.length} unique dates ` +
      `(${uniqueDates[0]} → ${uniqueDates[uniqueDates.length - 1]})\n`,
  );

  // Step 2: Fetch each CSV
  const allRows: StateRow[] = [];
  const seenDates = new Set<string>();
  let fetched = 0;
  let errors = 0;

  for (const date of uniqueDates) {
    const sha = byDate.get(date)!;
    fetched++;

    process.stdout.write(
      `\r  Fetching ${fetched}/${uniqueDates.length}: ${date} ...`,
    );

    try {
      const csv = await fetchCsvAtCommit(gh, sha);
      if (csv) {
        const rows = parseCsv(csv);
        if (rows.length > 0) {
          // Use the date from the CSV rows (more reliable than commit date)
          const csvDate = rows[0].date;
          if (!seenDates.has(csvDate)) {
            seenDates.add(csvDate);
            allRows.push(...rows);
          }
        }
      }
    } catch (err: any) {
      errors++;
      // If rate limited, wait and retry once
      if (err.response?.status === 403 || err.response?.status === 429) {
        const resetEpoch = err.response?.headers?.['x-ratelimit-reset'];
        if (resetEpoch) {
          const waitMs =
            Math.max(0, Number(resetEpoch) * 1000 - Date.now()) + 2000;
          console.log(
            `\n  ⏳ Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s ...`,
          );
          await sleep(waitMs);
          // Retry this one
          try {
            const csv = await fetchCsvAtCommit(gh, sha);
            if (csv) {
              const rows = parseCsv(csv);
              if (rows.length > 0 && !seenDates.has(rows[0].date)) {
                seenDates.add(rows[0].date);
                allRows.push(...rows);
                errors--;
              }
            }
          } catch {
            // give up on this one
          }
        }
      } else {
        console.error(`\n  ✗ Error on ${date}: ${err.message}`);
      }
    }

    // Throttle: 2 requests per commit (directory listing + raw file)
    // Stay well within 5000/hr authenticated or 60/hr unauthenticated
    await sleep(opts.token ? 200 : 1500);
  }

  console.log('\n');

  // Step 3: Sort and write CSV
  allRows.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.state_name.localeCompare(b.state_name);
  });

  const outPath = path.resolve(opts.outPath);

  const csvHeader =
    'Date,State,Abbreviation,Regular,Mid-Grade,Premium,Diesel';
  const csvLines = allRows.map(
    (r) =>
      `${r.date},${r.state_name},${r.state_abbr},${r.regular},${r.mid_grade},${r.premium},${r.diesel}`,
  );

  fs.writeFileSync(outPath, [csvHeader, ...csvLines].join('\n') + '\n', 'utf8');

  const dateRange = seenDates.size > 0
    ? `${[...seenDates].sort()[0]} → ${[...seenDates].sort().pop()}`
    : 'none';

  console.log('✓ Done!');
  console.log(`  Rows:   ${allRows.length.toLocaleString()}`);
  console.log(`  Dates:  ${seenDates.size}`);
  console.log(`  Range:  ${dateRange}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Output: ${outPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
