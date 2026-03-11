import axios from 'axios';
import * as cheerio from 'cheerio';

export interface AAAStatePrice {
  state: string; // 2-letter abbreviation e.g. 'CA'
  regular: number | null;
  midGrade: number | null;
  premium: number | null;
  diesel: number | null;
  fetchedAt: Date;
}

/** All 50 states + DC that AAA publishes data for */
const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

const AAA_BASE_URL = 'https://gasprices.aaa.com';
const REQUEST_DELAY_MS = 500; // be polite — 500ms between requests

/**
 * Parse a price string like "$3.456" into a number, or null if not parseable
 */
function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0.5 || num > 10 ? null : num;
}

/**
 * Fetch and parse current gas prices for a single state from AAA.
 * AAA page structure: the "Current Avg." row contains 4 <td> price cells:
 *   [Regular, Mid-Grade, Premium, Diesel]
 */
export async function fetchStatePrice(stateAbbr: string): Promise<AAAStatePrice> {
  const url = `${AAA_BASE_URL}/?state=${stateAbbr}`;

  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GasTrack/1.0; +https://github.com/fuelripple)',
      'Accept': 'text/html',
    },
  });

  const $ = cheerio.load(response.data as string);
  let regular: number | null = null;
  let midGrade: number | null = null;
  let premium: number | null = null;
  let diesel: number | null = null;

  // Find the row or cell labeled "Current Avg."
  $('td').each((_, el) => {
    const text = $(el).text().trim();
    if (text === 'Current Avg.') {
      // Prices are in the subsequent sibling <td> elements in the same <tr>
      const row = $(el).closest('tr');
      const priceCells = row.find('td').filter((_, cell) => {
        return $(cell).text().trim() !== 'Current Avg.' && /\$[\d.]+/.test($(cell).text());
      });

      const prices = priceCells.map((_, cell) => parsePrice($(cell).text())).get() as (number | null)[];

      // If we don't find in same row, try the next rows (some AAA tables use separate <tr>s per grade)
      if (prices.length === 0) {
        let sibling = row.next('tr');
        while (sibling.length && prices.length < 4) {
          const cell = sibling.find('td').first();
          const p = parsePrice(cell.text());
          if (p !== null) prices.push(p);
          else break;
          sibling = sibling.next('tr');
        }
      }

      [regular, midGrade, premium, diesel] = [
        prices[0] ?? null,
        prices[1] ?? null,
        prices[2] ?? null,
        prices[3] ?? null,
      ];
      return false; // stop iterating once found
    }
  });

  // Fallback: If the table uses the first occurrence of 4 consecutive price cells
  if (regular === null) {
    const allPrices: number[] = [];
    $('td').each((_, el) => {
      const p = parsePrice($(el).text());
      if (p !== null) allPrices.push(p);
    });
    // In AAA's layout, the statewide "Current Avg." prices are the first 4 numeric tds
    if (allPrices.length >= 4) {
      [regular, midGrade, premium, diesel] = allPrices.slice(0, 4);
    }
  }

  return {
    state: stateAbbr,
    regular,
    midGrade,
    premium,
    diesel,
    fetchedAt: new Date(),
  };
}

/**
 * Fetch all 50-state + DC gas prices from AAA.
 * Fetches sequentially with a polite delay to avoid rate limiting.
 */
export async function fetchAllStatePrices(): Promise<AAAStatePrice[]> {
  const results: AAAStatePrice[] = [];
  let success = 0;
  let failure = 0;

  for (const state of ALL_STATES) {
    try {
      const data = await fetchStatePrice(state);
      results.push(data);
      success++;
      console.log(
        `AAA [${state}] regular=$${data.regular ?? 'N/A'} mid=$${data.midGrade ?? 'N/A'} ` +
        `premium=$${data.premium ?? 'N/A'} diesel=$${data.diesel ?? 'N/A'}`
      );
    } catch (err: any) {
      failure++;
      console.error(`AAA fetch failed for ${state}: ${err.message}`);
    }

    // Polite delay between requests
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  console.log(`✅ AAA scrape complete: ${success} succeeded, ${failure} failed`);
  return results;
}
