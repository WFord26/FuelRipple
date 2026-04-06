import { Queue, Worker } from 'bullmq';
import { Cluster } from 'ioredis';
import { clearCache, redis } from './cache';
import { fetchAllGasPrices, fetchDieselPrices, fetchRefineryUtilization, fetchRefineryProduction, fetchPetroleumStocks, fetchPetroleumImports, fetchFlowBalance, fetchRefineryCapacity820 } from './eiaClient';
import { fetchCrudeQuotes } from './marketClient';
import { fetchEconomicIndicators } from './fredClient';
import { fetchAllStatePricesOptimized } from './aaaClientV2';
import { insertPrices, insertIndicators, upsertRefineryData, upsertCapacityData, refreshMaterializedViews, upsertNationalAverages, upsertLatestPrices, upsertStateAggregates, upsertPriceChangesCache, upsertPaddAggregates } from '@fuelripple/db';
import type { RefineryOperationsRow, CapacityRow, AaaNationalAverageRow, AaaStateAggregateRow, AaaPaddAggregateRow, PriceChangesRow } from '@fuelripple/db';
import { EnergyPrice, EconomicIndicator, PADD_REGIONS, STATE_POPULATIONS } from '@fuelripple/shared';
import { abbrToDuoarea } from '../utils/regionMapper';
import { trackApiEvent, trackApiException, trackMetric } from '../lib/appInsights';
import { assertAAAScrapeHealthy, summarizeAAAScrape } from './aaaIngestion';

export let dataQueue: Queue | null = null;
let redisCluster: Cluster | null = null;

/**
 * Initialize BullMQ job queue
 */
export function initializeJobQueue(): void {
  if (!redis) {
    console.warn('⚠️  Redis not available, job queue disabled');
    return;
  }

  // For Azure Redis cluster mode, create a Cluster client that follows MOVED redirects
  // BullMQ requires a cluster client (not regular Redis with enableCluster flag)
  redisCluster = new Cluster(
    [{ host: redis.options.host!, port: redis.options.port! }],
    {
      redisOptions: {
        password: redis.options.password,
        username: redis.options.username,
        tls: redis.options.tls,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      dnsLookup: (address: string, callback: any) => require('dns').lookup(address, 4, callback),
      enableOfflineQueue: false,
    }
  );

  dataQueue = new Queue('data-ingestion', { connection: redisCluster, prefix: '{bull}' });

  console.log('✅ Job queue initialized with Redis cluster mode');

  // Schedule jobs
  scheduleJobs();

  // Create workers
  createWorkers();
}

/**
 * Schedule recurring jobs
 */
async function scheduleJobs(): Promise<void> {
  if (!dataQueue) return;

  // EIA gas prices - Monday 6PM ET (after EIA release ~5PM)
  await dataQueue.upsertJobScheduler('eia-gas-weekly', {
    pattern: '0 18 * * 1',
  }, {
    name: 'fetch-eia-gas',
    data: { type: 'gas' },
    opts: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  // Market crude prices — every 2 hours during NYSE trading hours (weekdays 9AM-5PM ET)
  // Uses Yahoo Finance CL=F (WTI) and BZ=F (Brent) — no API key, 15-min delayed
  await dataQueue.upsertJobScheduler('market-crude-intraday', {
    pattern: '0 9-17/2 * * 1-5',
  }, {
    name: 'fetch-market-crude',
    data: { type: 'crude' },
    opts: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  // After-hours close capture — 6PM ET weekdays (picks up the official daily close)
  await dataQueue.upsertJobScheduler('market-crude-close', {
    pattern: '0 18 * * 1-5',
  }, {
    name: 'fetch-market-crude',
    data: { type: 'crude' },
    opts: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  // EIA diesel weekly
  await dataQueue.upsertJobScheduler('eia-diesel-weekly', {
    pattern: '0 18 * * 1',
  }, {
    name: 'fetch-eia-diesel',
    data: { type: 'diesel' },
    opts: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  // FRED economic indicators - 15th of each month at 10AM
  await dataQueue.upsertJobScheduler('fred-economic-monthly', {
    pattern: '0 10 15 * *',
  }, {
    name: 'fetch-fred-indicators',
    data: { type: 'economic' },
    opts: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
    },
  });

  // AAA state prices - 9AM ET (morning update - published each morning)
  await dataQueue.upsertJobScheduler('aaa-state-morning', {
    pattern: '0 9 * * *',
  }, {
    name: 'fetch-aaa-prices',
    data: { type: 'aaa' },
    opts: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
    },
  });

  // AAA state prices - 4PM ET (intraday update for real-time tracking)
  // NOTE: Can be enabled/disabled via AAA_INTRADAY_ENABLED env var
  if (process.env.AAA_INTRADAY_ENABLED === 'true') {
    await dataQueue.upsertJobScheduler('aaa-state-intraday', {
      pattern: '0 16 * * 1-5', // Weekdays only, 4PM ET
    }, {
      name: 'fetch-aaa-prices',
      data: { type: 'aaa', priority: 'intraday' },
      opts: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 8000,
        },
      },
    });
    console.log('ℹ️  AAA intraday scraping enabled (4PM ET)');
  }

  // EIA refinery/supply data - Monday 6PM ET (same WPSR release as gas prices)
  await dataQueue.upsertJobScheduler('eia-refinery-weekly', {
    pattern: '0 18 * * 1',
  }, {
    name: 'fetch-eia-refinery',
    data: { type: 'refinery' },
    opts: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  });

  // EIA-820 annual refinery capacity - 1st of February each year (EIA typically publishes in Jan/Feb)
  await dataQueue.upsertJobScheduler('eia-capacity-annual', {
    pattern: '0 10 1 2 *',
  }, {
    name: 'fetch-eia-capacity',
    data: { type: 'capacity' },
    opts: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 10000,
      },
    },
  });

  console.log('✅ Jobs scheduled');
}

/**
 * Create workers to process jobs
 */
function createWorkers(): void {
  if (!redisCluster) return;

  const worker = new Worker(
    'data-ingestion',
    async (job) => {
      console.log(`Processing job: ${job.name}`, job.data);

      try {
        switch (job.name) {
          case 'fetch-eia-gas':
            await processGasPrices();
            break;
          case 'fetch-market-crude':
            await processCrudePrices();
            break;
          case 'fetch-eia-diesel':
            await processDieselPrices();
            break;
          case 'fetch-fred-indicators':
            await processEconomicIndicators();
            break;
          case 'fetch-aaa-prices':
            await processAAAPrices();
            break;
          case 'fetch-eia-refinery':
            await processRefineryData();
            break;
          case 'fetch-eia-capacity':
            await processCapacityData();
            break;
          default:
            console.warn(`Unknown job type: ${job.name}`);
        }

        return { success: true, timestamp: new Date().toISOString() };
      } catch (error) {
        console.error(`Job ${job.name} failed:`, error);
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(typeof error === 'string' ? error : 'Unknown job error');
        trackApiException(normalizedError, { jobName: job.name, jobId: job.id ?? 'unknown' });
        throw error;
      }
    },
    {
      connection: redisCluster,
      prefix: '{bull}',
      concurrency: 3,
      maxStalledCount: 3,
      stalledInterval: 60000,
    }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.name} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.name} failed:`, err);
    trackApiException(err, { 
      jobName: job?.name ?? 'unknown', 
      jobId: job?.id ?? 'unknown',
      attemptsMade: job?.attemptsMade?.toString() ?? 'unknown'
    });
  });

  console.log('✅ Worker started');
}

/**
 * Process gas prices from EIA
 */
/**
 * Build price_changes_cache rows for a given metric after new prices are
 * inserted. Pulls the unique regions from the provided prices, then for each
 * region queries the most recent price plus the price from 7/30/90/365 days ago
 * and upserts the computed deltas.
 */
async function buildPriceChangesCache(metric: string, prices: EnergyPrice[]): Promise<void> {
  try {
    const { getKnex } = await import('@fuelripple/db');
    const knex = getKnex();
    const regions = [...new Set(prices.map(p => p.region))];
    const rows: PriceChangesRow[] = [];

    for (const region of regions) {
      const result = await knex.raw<{ rows: any[] }>(`
        WITH
          latest AS (
            SELECT value FROM energy_prices
            WHERE metric = ? AND region = ?
            ORDER BY time DESC LIMIT 1
          ),
          w7   AS (SELECT value FROM energy_prices WHERE metric = ? AND region = ?
                    AND time >= NOW() - INTERVAL '8 days' AND time <= NOW() - INTERVAL '6 days'
                    ORDER BY time DESC LIMIT 1),
          w30  AS (SELECT value FROM energy_prices WHERE metric = ? AND region = ?
                    AND time >= NOW() - INTERVAL '31 days' AND time <= NOW() - INTERVAL '29 days'
                    ORDER BY time DESC LIMIT 1),
          w90  AS (SELECT value FROM energy_prices WHERE metric = ? AND region = ?
                    AND time >= NOW() - INTERVAL '91 days' AND time <= NOW() - INTERVAL '89 days'
                    ORDER BY time DESC LIMIT 1),
          w365 AS (SELECT value FROM energy_prices WHERE metric = ? AND region = ?
                    AND time >= NOW() - INTERVAL '366 days' AND time <= NOW() - INTERVAL '364 days'
                    ORDER BY time DESC LIMIT 1)
        SELECT
          (SELECT value FROM latest)  AS cur,
          (SELECT value FROM w7)      AS p7,
          (SELECT value FROM w30)     AS p30,
          (SELECT value FROM w90)     AS p90,
          (SELECT value FROM w365)    AS p365
      `, [metric, region, metric, region, metric, region, metric, region, metric, region]);

      const row = result.rows[0];
      if (!row || row.cur == null) continue;

      const pct = (cur: number, old: number | null) =>
        old != null && old > 0 ? parseFloat(((cur - old) / old * 100).toFixed(4)) : null;

      rows.push({
        metric,
        region,
        current_price: row.cur,
        week_ago_price: row.p7,
        week_change_pct: pct(row.cur, row.p7),
        month_ago_price: row.p30,
        month_change_pct: pct(row.cur, row.p30),
        three_month_ago_price: row.p90,
        three_month_change_pct: pct(row.cur, row.p90),
        year_ago_price: row.p365,
        year_change_pct: pct(row.cur, row.p365),
      });
    }

    if (rows.length > 0) {
      await upsertPriceChangesCache(rows);
      console.log(`  ✅ price_changes_cache updated for ${rows.length} ${metric} regions`);
    }
  } catch (err: any) {
    console.warn(`  ⚠️  buildPriceChangesCache(${metric}) failed: ${err.message ?? err}`);
  }
}

async function processGasPrices(): Promise<void> {
  console.log('Fetching gas prices from EIA...');
  
  const results = await fetchAllGasPrices();
  console.log(`Received ${results.length} regional datasets from EIA`);
  
  const prices: EnergyPrice[] = [];

  for (const { region, data } of results) {
    console.log(`Processing ${data.length} data points for region ${region}`);
    for (const point of data) {
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

  console.log(`Prepared ${prices.length} price records for insertion`);
  await insertPrices(prices);
  console.log(`✅ Inserted ${prices.length} gas price records`);
  await upsertLatestPrices(prices);
  await buildPriceChangesCache('gas_regular', prices);
  await refreshMaterializedViews();
}

/**
 * Process crude oil prices from Yahoo Finance market data.
 * WTI = CL=F (NYMEX front-month), Brent = BZ=F (ICE front-month).
 * Prices are 15-min delayed during trading hours; reflects true market price.
 */
async function processCrudePrices(): Promise<void> {
  console.log('Fetching crude prices from market (Yahoo Finance)...');

  const { wti, brent } = await fetchCrudeQuotes();
  const prices: EnergyPrice[] = [];

  // Round timestamp to the nearest hour to avoid micro-duplicate entries
  const now = new Date();
  now.setMinutes(0, 0, 0);

  if (wti.price > 0) {
    prices.push({
      time: now,
      source: 'yahoo',
      metric: 'crude_wti',
      region: 'US',
      value: wti.price,
      unit: 'usd_per_barrel',
    });
  }

  if (brent.price > 0) {
    prices.push({
      time: now,
      source: 'yahoo',
      metric: 'crude_brent',
      region: 'US',
      value: brent.price,
      unit: 'usd_per_barrel',
    });
  }

  if (prices.length > 0) {
    await insertPrices(prices);
    console.log(`✅ Inserted ${prices.length} crude market price records (WTI: $${wti.price.toFixed(2)}, Brent: $${brent.price.toFixed(2)})`);    await upsertLatestPrices(prices);  } else {
    console.warn('⚠️  No valid crude market prices received');
  }
}

/**
 * Process diesel prices from EIA (all regions)
 */
async function processDieselPrices(): Promise<void> {
  console.log('Fetching diesel prices from EIA...');
  
  const results = await fetchDieselPrices();
  console.log(`Received ${results.length} regional diesel datasets from EIA`);

  const prices: EnergyPrice[] = [];
  for (const { region, data } of results) {
    for (const point of data) {
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

  console.log(`Prepared ${prices.length} diesel price records for insertion`);
  await insertPrices(prices);
  console.log(`✅ Inserted ${prices.length} diesel price records`);
  await upsertLatestPrices(prices);
  await buildPriceChangesCache('diesel', prices);
  await refreshMaterializedViews();
}

/**
 * Process economic indicators from FRED
 */
async function processEconomicIndicators(): Promise<void> {
  console.log('Fetching economic indicators from FRED...');
  
  const { cpi, cpiFoodAtHome, ppiTrucking, ppiFreightCommodity } = await fetchEconomicIndicators();
  const indicators: EconomicIndicator[] = [];

  for (const point of cpi) {
    if (point.value) {
      indicators.push({
        time: new Date(point.date),
        indicator: 'cpi',
        value: parseFloat(point.value),
        source: 'fred',
      });
    }
  }

  for (const point of cpiFoodAtHome) {
    if (point.value) {
      indicators.push({
        time: new Date(point.date),
        indicator: 'cpi',
        value: parseFloat(point.value),
        source: 'fred',
      });
    }
  }

  for (const point of ppiTrucking) {
    if (point.value) {
      indicators.push({
        time: new Date(point.date),
        indicator: 'ppi_trucking',
        value: parseFloat(point.value),
        source: 'fred',
      });
    }
  }

  for (const point of ppiFreightCommodity) {
    if (point.value) {
      indicators.push({
        time: new Date(point.date),
        indicator: 'freight_rate',
        value: parseFloat(point.value),
        source: 'fred',
      });
    }
  }

  await insertIndicators(indicators);
  console.log(`✅ Inserted ${indicators.length} indicator records`);
}

/**
 * Process AAA state-level gas prices
 */
async function processAAAPrices(): Promise<void> {
  console.log('Fetching AAA state gas prices...');

  const { results: stateData, metrics } = await fetchAllStatePricesOptimized({ verbose: true });
  const scrapeSummary = summarizeAAAScrape(stateData);
  trackMetric('aaa_scrape_total_states', scrapeSummary.totalStates);
  trackMetric('aaa_scrape_populated_states', scrapeSummary.populatedStates);
  trackApiEvent('aaa_scrape_finished', {
    totalStates: scrapeSummary.totalStates.toString(),
    populatedStates: scrapeSummary.populatedStates.toString(),
    emptyStates: scrapeSummary.emptyStates.length.toString(),
    requestSuccessCount: metrics.successCount.toString(),
    requestFailureCount: metrics.failureCount.toString(),
  });
  console.log(
    `AAA scrape summary: ${scrapeSummary.populatedStates}/${scrapeSummary.totalStates} states populated; ` +
    `${scrapeSummary.emptyStates.length} empty`
  );
  assertAAAScrapeHealthy(stateData);

  const prices: EnergyPrice[] = [];
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Clear any stale same-day records only after a healthy scrape so we do not
  // wipe out an earlier successful run with an empty or partial result set.
  const { getKnex } = await import('@fuelripple/db');
  const knex = getKnex();
  await knex('aaa_state_aggregates')
    .whereRaw(`time::date = ?::date`, [today.toISOString()])
    .delete();

  for (const sp of stateData) {
    const duoarea = abbrToDuoarea(sp.state);
    if (!duoarea) {
      console.warn(`No duoarea mapping for state: ${sp.state}`);
      continue;
    }

    // Only insert metrics that EIA doesn't already cover for this state
    if (sp.regular !== null) {
      prices.push({
        time: today,
        source: 'aaa',
        metric: 'gas_regular',
        region: duoarea,
        value: sp.regular,
        unit: 'usd_per_gallon',
      });
    }
    if (sp.midGrade !== null) {
      prices.push({
        time: today,
        source: 'aaa',
        metric: 'gas_midgrade',
        region: duoarea,
        value: sp.midGrade,
        unit: 'usd_per_gallon',
      });
    }
    if (sp.premium !== null) {
      prices.push({
        time: today,
        source: 'aaa',
        metric: 'gas_premium',
        region: duoarea,
        value: sp.premium,
        unit: 'usd_per_gallon',
      });
    }
    if (sp.diesel !== null) {
      prices.push({
        time: today,
        source: 'aaa',
        metric: 'diesel',
        region: duoarea,
        value: sp.diesel,
        unit: 'usd_per_gallon',
      });
    }
  }

  console.log(`Prepared ${prices.length} AAA price records for insertion`);
  await insertPrices(prices);
  console.log(`✅ Inserted ${prices.length} AAA price records`);
  await upsertLatestPrices(prices);

  // Compute and store the daily US nationwide average across all scraped states
  const avg = (vals: number[]) =>
    vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

  const regulars  = stateData.map(s => s.regular).filter((v): v is number => v !== null);
  const midGrades = stateData.map(s => s.midGrade).filter((v): v is number => v !== null);
  const premiums  = stateData.map(s => s.premium).filter((v): v is number => v !== null);
  const diesels   = stateData.map(s => s.diesel).filter((v): v is number => v !== null);

  const nationalAvg: AaaNationalAverageRow = {
    time: today,
    regular:   avg(regulars),
    mid_grade: avg(midGrades),
    premium:   avg(premiums),
    diesel:    avg(diesels),
    state_count: regulars.length,
  };

  await upsertNationalAverages([nationalAvg]);
  console.log(
    `✅ National average upserted for ${today.toISOString().split('T')[0]}: ` +
    `regular=$${nationalAvg.regular?.toFixed(3) ?? 'N/A'} ` +
    `mid=$${nationalAvg.mid_grade?.toFixed(3) ?? 'N/A'} ` +
    `premium=$${nationalAvg.premium?.toFixed(3) ?? 'N/A'} ` +
    `diesel=$${nationalAvg.diesel?.toFixed(3) ?? 'N/A'} ` +
    `(${nationalAvg.state_count} states)`
  );

  // Store per-state aggregates for fast state-level queries
  const stateAggs: AaaStateAggregateRow[] = stateData
    .filter(s => s.regular !== null || s.midGrade !== null || s.premium !== null || s.diesel !== null)
    .map(s => ({
      time: today,
      state: s.state,
      regular: s.regular,
      mid_grade: s.midGrade,
      premium: s.premium,
      diesel: s.diesel,
    }));

  await upsertStateAggregates(stateAggs);
  console.log(`✅ Upserted ${stateAggs.length} state aggregates`);

  // Compute PADD regional aggregates (simple mean + population-weighted mean)
  const PADD_CODE_TO_REGION = {
    R10: PADD_REGIONS.PADD1,
    R20: PADD_REGIONS.PADD2,
    R30: PADD_REGIONS.PADD3,
    R40: PADD_REGIONS.PADD4,
    R50: PADD_REGIONS.PADD5,
  } as const;

  const paddAggs: AaaPaddAggregateRow[] = [];
  for (const [paddCode, region] of Object.entries(PADD_CODE_TO_REGION)) {
    const statesInPadd = stateAggs.filter(s => (region.states as readonly string[]).includes(s.state));
    const grades = ['regular', 'mid_grade', 'premium', 'diesel'] as const;
    type GradeKey = typeof grades[number];

    const agg: AaaPaddAggregateRow = {
      time: today,
      padd: paddCode,
      regular_mean:   null,
      mid_grade_mean: null,
      premium_mean:   null,
      diesel_mean:    null,
      regular_wtd:    null,
      mid_grade_wtd:  null,
      premium_wtd:    null,
      diesel_wtd:     null,
      state_count: statesInPadd.length,
    };

    for (const grade of grades) {
      const withPrices = statesInPadd.filter(s => s[grade as GradeKey] !== null);
      if (withPrices.length === 0) continue;

      const prices = withPrices.map(s => s[grade as GradeKey] as number);
      (agg as any)[`${grade}_mean`] = prices.reduce((a, b) => a + b, 0) / prices.length;

      let weightedSum = 0;
      let totalWeight = 0;
      for (const s of withPrices) {
        const pop = STATE_POPULATIONS[s.state] ?? 0;
        weightedSum += (s[grade as GradeKey] as number) * pop;
        totalWeight += pop;
      }
      if (totalWeight > 0) (agg as any)[`${grade}_wtd`] = weightedSum / totalWeight;
    }

    paddAggs.push(agg);
  }

  await upsertPaddAggregates(paddAggs);
  console.log(`✅ Upserted ${paddAggs.length} PADD aggregates`);

  await refreshMaterializedViews();
  await clearCache('aaa:*');
  console.log('✅ Cleared AAA caches');
}

/**
 * Process EIA Weekly Petroleum Status Report (WPSR) refinery + supply data.
 * Fetches utilization %, crude inputs, production volumes, and stock levels,
 * then merges them by (period, region) before upserting into refinery_operations.
 */
async function processRefineryData(): Promise<void> {
  console.log('Fetching EIA WPSR refinery/supply data...');

  // Fetch sequentially to avoid concurrent rate-limit pressure on the EIA API
  const utilRows = await fetchRefineryUtilization();
  const prodRows = await fetchRefineryProduction();
  const stockRows = await fetchPetroleumStocks();
  const importRows = await fetchPetroleumImports();
  const flowRows   = await fetchFlowBalance();

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
    if (r.crude_inputs     !== undefined) row.crude_inputs     = r.crude_inputs;
  }
  for (const r of prodRows) {
    const row = ensureRow(r.period, r.region);
    if (r.gasoline_production    !== undefined) row.gasoline_production    = r.gasoline_production;
    if (r.distillate_production  !== undefined) row.distillate_production  = r.distillate_production;
  }
  for (const r of stockRows) {
    const row = ensureRow(r.period, r.region);
    if (r.gasoline_stocks   !== undefined) row.gasoline_stocks   = r.gasoline_stocks;
    if (r.distillate_stocks !== undefined) row.distillate_stocks = r.distillate_stocks;
  }
  for (const r of importRows) {
    const row = ensureRow(r.period, r.region);
    if (r.gasoline_imports   !== undefined) row.gasoline_imports   = r.gasoline_imports;
    if (r.distillate_imports !== undefined) row.distillate_imports = r.distillate_imports;
    if (r.crude_imports      !== undefined) row.crude_imports      = r.crude_imports;
  }
  for (const r of flowRows) {
    const row = ensureRow(r.period, r.region);
    if (r.total_exports          !== undefined) row.total_exports          = r.total_exports;
    if (r.product_supplied_gas   !== undefined) row.product_supplied_gas   = r.product_supplied_gas;
    if (r.product_supplied_dist  !== undefined) row.product_supplied_dist  = r.product_supplied_dist;
  }

  const rows = Array.from(merged.values());
  console.log(`Prepared ${rows.length} refinery/supply rows for upsert`);
  await upsertRefineryData(rows);
  console.log(`✅ Upserted ${rows.length} refinery_operations records`);
}

/**
 * Process EIA Form 820 annual refinery capacity data.
 * Runs once a year (February) when EIA publishes the prior-year survey.
 * Non-fatal — if the endpoint returns no data, logs a warning and continues.
 */
async function processCapacityData(): Promise<void> {
  console.log('Fetching EIA-820 annual refinery capacity...');

  const capacityRows = await fetchRefineryCapacity820();

  if (capacityRows.length === 0) {
    console.warn('⚠️  EIA-820 returned 0 rows — endpoint may need facet adjustment');
    return;
  }

  const rows: CapacityRow[] = capacityRows.map(r => ({
    year: r.year,
    region: r.region,
    operable_capacity: r.operable_capacity ?? null,
    operating_capacity: r.operating_capacity ?? null,
    idle_capacity: r.idle_capacity ?? null,
    shutdown_capacity: r.shutdown_capacity ?? null,
  }));

  await upsertCapacityData(rows);
  console.log(`✅ Upserted ${rows.length} refinery_capacity records (EIA-820)`);
}

/**
 * Manually trigger a job (for testing or backfill)
 */
export async function triggerJob(jobName: string, data?: any): Promise<void> {
  if (!dataQueue) {
    throw new Error('Job queue not initialized');
  }

  await dataQueue.add(jobName, data || {});
  console.log(`✅ Job ${jobName} triggered`);
}
