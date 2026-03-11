import { Queue, Worker } from 'bullmq';
import { redis } from './cache';
import { fetchAllGasPrices, fetchDieselPrices, fetchRefineryUtilization, fetchRefineryProduction, fetchPetroleumStocks, fetchPetroleumImports, fetchFlowBalance, fetchRefineryCapacity820 } from './eiaClient';
import { fetchCrudeQuotes } from './marketClient';
import { fetchEconomicIndicators } from './fredClient';
import { fetchAllStatePrices } from './aaaClient';
import { insertPrices, insertIndicators, upsertRefineryData, upsertCapacityData } from '@fuelripple/db';
import type { RefineryOperationsRow, CapacityRow } from '@fuelripple/db';
import { EnergyPrice, EconomicIndicator } from '@fuelripple/shared';
import { abbrToDuoarea } from '../utils/regionMapper';

export let dataQueue: Queue | null = null;

/**
 * Initialize BullMQ job queue
 */
export function initializeJobQueue(): void {
  if (!redis) {
    console.warn('⚠️  Redis not available, job queue disabled');
    return;
  }

  // Create queue with redis connection
  dataQueue = new Queue('data-ingestion', { 
    connection: {
      host: redis.options.host,
      port: redis.options.port,
    }
  });

  console.log('✅ Job queue initialized');

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

  // AAA state prices - daily at 9AM ET (published each morning)
  await dataQueue.upsertJobScheduler('aaa-state-daily', {
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
  if (!redis) return;

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
        throw error;
      }
    },
    {
      connection: {
        host: redis.options.host,
        port: redis.options.port,
      },
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
  });

  console.log('✅ Worker started');
}

/**
 * Process gas prices from EIA
 */
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
    console.log(`✅ Inserted ${prices.length} crude market price records (WTI: $${wti.price.toFixed(2)}, Brent: $${brent.price.toFixed(2)})`);
  } else {
    console.warn('⚠️  No valid crude market prices received');
  }
}

/**
 * Process diesel prices from EIA
 */
async function processDieselPrices(): Promise<void> {
  console.log('Fetching diesel prices from EIA...');
  
  const { data } = await fetchDieselPrices();
  const prices: EnergyPrice[] = data.map(point => ({
    time: new Date(point.period),
    source: 'eia',
    metric: 'diesel',
    region: 'US',
    value: point.value,
    unit: 'usd_per_gallon',
  }));

  await insertPrices(prices);
  console.log(`✅ Inserted ${prices.length} diesel price records`);
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

  const stateData = await fetchAllStatePrices();
  const prices: EnergyPrice[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
