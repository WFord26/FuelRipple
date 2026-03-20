#!/usr/bin/env ts-node
/**
 * Enhanced AAA Client with improved reliability and higher fetch frequency
 *
 * Improvements over v1:
 * - Parallel batch requests with rate limiting (max 5 concurrent)
 * - Automatic retry with exponential backoff
 * - Multiple parsing strategies with fallback
 * - Detailed error logging and metrics
 * - Early termination detection (< 60% success rate)
 */

import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';

export interface AAAStatePrice {
  state: string;
  regular: number | null;
  midGrade: number | null;
  premium: number | null;
  diesel: number | null;
  fetchedAt: Date;
}

export interface AAAScrapeMetrics {
  totalStates: number;
  successCount: number;
  failureCount: number;
  totalTime: number;
  avgTimePerState: number;
  avgTimePerRequest: number;
}

/** All 50 states + DC */
const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
];

const AAA_BASE_URL = 'https://gasprices.aaa.com';
const MAX_CONCURRENT_REQUESTS = 5;
const REQUEST_TIMEOUT_MS = 15000;
const INITIAL_RETRY_DELAY_MS = 500;

/**
 * Parse price strings like "$3.456" into numbers
 */
function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) || num < 0.5 || num > 10 ? null : num;
}

/**
 * Strategy 1: Look for "Current Avg." label (most reliable)
 */
function parseCurrentAvgStrategy($: any): (number | null)[] | null {
  const prices: (number | null)[] = [];
  
  $('td').each((_: any, el: any) => {
    const text = $(el).text().trim();
    if (text === 'Current Avg.') {
      const row = $(el).closest('tr');
      const priceCells = row.find('td').filter((_: any, cell: any) => {
        return $(cell).text().trim() !== 'Current Avg.' && /\$[\d.]+/.test($(cell).text());
      });

      const parsed = priceCells.map((_: any, cell: any) => parsePrice($(cell).text())).get() as (number | null)[];
      
      if (parsed.length >= 4) {
        prices.push(...parsed.slice(0, 4));
        return false;
      }
    }
  });
  
  return prices.length === 4 ? (prices as (number | null)[]) : null;
}

/**
 * Strategy 2: Look for a table with multiple price columns (fallback)
 */
function parseTableStrategy($: any): (number | null)[] | null {
  const allPrices: number[] = [];
  
  $('td').each((_: any, el: any) => {
    const p = parsePrice($(el).text());
    if (p !== null) allPrices.push(p);
  });
  
  // Assume first 4 consecutive prices are statewide average
  if (allPrices.length >= 4) {
    return allPrices.slice(0, 4) as (number | null)[];
  }
  
  return null;
}

/**
 * Extract prices using multiple strategies with fallback
 */
function extractPrices($: any): { regular: number | null; midGrade: number | null; premium: number | null; diesel: number | null } {
  // Try primary strategy first
  const prices = parseCurrentAvgStrategy($) || parseTableStrategy($);
  
  if (prices && prices.length >= 4) {
    return {
      regular: prices[0],
      midGrade: prices[1],
      premium: prices[2],
      diesel: prices[3],
    };
  }
  
  return {
    regular: null,
    midGrade: null,
    premium: null,
    diesel: null,
  };
}

/**
 * Fetch with exponential backoff retry
 */
async function fetchWithRetry(
  client: AxiosInstance,
  url: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await client.get(url);
      return response.data as string;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

/**
 * Fetch a single state with full retry logic
 */
async function fetchStatePrice(
  client: AxiosInstance,
  stateAbbr: string
): Promise<AAAStatePrice> {
  const url = `${AAA_BASE_URL}/?state=${stateAbbr}`;
  
  const html = await fetchWithRetry(client, url);
  const $ = cheerio.load(html);
  const prices = extractPrices($);
  
  return {
    state: stateAbbr,
    ...prices,
    fetchedAt: new Date(),
  };
}

/**
 * Batch-fetch with concurrency limiting and metrics
 */
export async function fetchAllStatePricesOptimized(
  options?: {
    maxConcurrent?: number;
    verbose?: boolean;
  }
): Promise<{ results: AAAStatePrice[]; metrics: AAAScrapeMetrics }> {
  const maxConcurrent = options?.maxConcurrent || MAX_CONCURRENT_REQUESTS;
  const verbose = options?.verbose ?? false;
  
  const client = axios.create({
    timeout: REQUEST_TIMEOUT_MS,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; FuelRipple/2.0; +https://github.com/fuelripple)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  });
  
  const results: AAAStatePrice[] = [];
  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;
  const requestTimes: number[] = [];
  
  // Process in batches
  for (let i = 0; i < ALL_STATES.length; i += maxConcurrent) {
    const batch = ALL_STATES.slice(i, i + maxConcurrent);
    const batchStartTime = Date.now();
    
    const promises = batch.map(state => 
      (async () => {
        const stateStartTime = Date.now();
        try {
          const data = await fetchStatePrice(client, state);
          results.push(data);
          successCount++;
          
          if (verbose) {
            const elapsed = Date.now() - stateStartTime;
            requestTimes.push(elapsed);
            console.log(
              `✓ AAA [${state}] regular=$${data.regular?.toFixed(3) ?? 'N/A'} ` +
              `mid=$${data.midGrade?.toFixed(3) ?? 'N/A'} ` +
              `premium=$${data.premium?.toFixed(3) ?? 'N/A'} ` +
              `diesel=$${data.diesel?.toFixed(3) ?? 'N/A'} (${elapsed}ms)`
            );
          }
        } catch (err: any) {
          failureCount++;
          if (verbose) {
            console.error(`✗ AAA [${state}] failed: ${err.message}`);
          }
        }
      })()
    );
    
    await Promise.all(promises);
    
    // Log batch completion
    if (verbose) {
      const batchTime = Date.now() - batchStartTime;
      console.log(`Batch processed in ${batchTime}ms (${batch.length} states)`);
    }
    
    // Early termination if success rate drops below 60%
    const totalProcessed = successCount + failureCount;
    if (totalProcessed >= 10 && successCount / totalProcessed < 0.6) {
      const failureRate = ((1 - successCount / totalProcessed) * 100).toFixed(1);
      console.warn(`⚠️  AAA scrape failure rate ${failureRate}% — aborting to prevent rate limiting`);
      break;
    }
  }
  
  const totalTime = Date.now() - startTime;
  const totalProcessed = successCount + failureCount;
  
  const metrics: AAAScrapeMetrics = {
    totalStates: ALL_STATES.length,
    successCount,
    failureCount,
    totalTime,
    avgTimePerState: totalProcessed > 0 ? totalTime / totalProcessed : 0,
    avgTimePerRequest: requestTimes.length > 0 
      ? requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length 
      : 0,
  };
  
  if (verbose) {
    console.log(`\n📊 AAA Scrape Metrics:`);
    console.log(`   Total States: ${metrics.totalStates}`);
    console.log(`   Success: ${metrics.successCount}, Failed: ${metrics.failureCount} (${((metrics.successCount / metrics.totalStates) * 100).toFixed(1)}% success rate)`);
    console.log(`   Total Time: ${metrics.totalTime}ms`);
    console.log(`   Avg Time/State: ${metrics.avgTimePerState.toFixed(0)}ms`);
    if (metrics.avgTimePerRequest > 0) {
      console.log(`   Avg Time/Request: ${metrics.avgTimePerRequest.toFixed(0)}ms`);
    }
  }
  
  return { results, metrics };
}

/**
 * Legacy API for backward compatibility
 */
export async function fetchAllStatePrices(): Promise<AAAStatePrice[]> {
  const { results } = await fetchAllStatePricesOptimized({ verbose: true });
  return results;
}
