import { Knex } from 'knex';
import { getKnex } from '../index';
import { EnergyPrice, SOURCE_PRIORITY } from '@fuelripple/shared';

/**
 * Insert energy prices with deduplication.
 * Sorts by time then chunks into small batches so each batch touches
 * few TimescaleDB hypertable partitions, staying within Azure PG's
 * max_locks_per_transaction limit.
 */
export async function insertPrices(prices: EnergyPrice[]): Promise<void> {
  if (prices.length === 0) {
    console.warn('⚠️  No prices to insert');
    return;
  }
  
  const knex = getKnex();
  // Sort by time so consecutive rows land in the same hypertable chunk,
  // minimising predicate-lock count per batch.
  const sorted = [...prices].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
  const CHUNK = 50; // 50 rows × 6 cols = 300 params — small enough for Azure PG lock limits with TimescaleDB

  for (let i = 0; i < sorted.length; i += CHUNK) {
    const chunk = sorted.slice(i, i + CHUNK);
    await knex('energy_prices')
      .insert(chunk)
      .onConflict(['time', 'source', 'metric', 'region'])
      .ignore();
  }
}

/**
 * Refresh the pre-computed aggregate materialized views after new price data
 * is loaded.  Called by the BullMQ workers after each successful insertPrices.
 * Uses CONCURRENTLY to reduce lock pressure on TimescaleDB hypertables.
 * Refreshes each view independently so one failure doesn't block the rest.
 */
export async function refreshMaterializedViews(): Promise<void> {
  const knex = getKnex();
  for (const view of ['daily_prices', 'weekly_prices', 'monthly_prices', 'inventory_statistics_52w']) {
    try {
      await knex.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view};`);
      console.log(`  ✅ ${view} refreshed`);
    } catch (err: any) {
      // CONCURRENTLY requires a unique index; fall back to non-concurrent
      if (err.message?.includes('CONCURRENTLY') || err.code === '55000') {
        try {
          await knex.raw(`REFRESH MATERIALIZED VIEW ${view};`);
          console.log(`  ✅ ${view} refreshed (non-concurrent fallback)`);
        } catch (err2: any) {
          console.warn(`  ⚠️  ${view} refresh failed: ${err2.message ?? err2}`);
        }
      } else {
        console.warn(`  ⚠️  ${view} refresh failed: ${err.message ?? err}`);
      }
    }
  }
  console.log('Materialized view refresh complete');
}

/**
 * Get current prices for all regions
 */
export async function getCurrentPrices(metric: string): Promise<any[]> {
  const knex = getKnex();
  
  // Limit scan to recent 4 weeks to avoid locking every hypertable chunk.
  // energy_prices is partitioned on `time`; an unbounded scan exhausts
  // max_locks_per_transaction on Azure PG Flexible Server.
  // Prioritizes AAA over EIA for gas prices.
  const result = await knex.raw(`
    SELECT DISTINCT ON (region) region, metric, value, time, source
    FROM energy_prices
    WHERE metric = ?
      AND time >= NOW() - INTERVAL '4 weeks'
    ORDER BY region,
      CASE source
        WHEN 'aaa' THEN 100
        WHEN 'aaa_wayback' THEN 95
        WHEN 'eia' THEN 50
        WHEN 'fred' THEN 40
        WHEN 'market' THEN 30
        ELSE 0
      END DESC,
      time DESC
  `, [metric]);
  
  return Array.isArray(result) ? result : (result.rows ?? []);
}

/**
 * Upsert into latest_prices snapshot table.
 * Maintains current price for each (region, metric) pair in O(1) lookup table.
 * Called after each price ingestion to keep snapshot up-to-date.
 * 
 * IMPORTANT: Respects SOURCE_PRIORITY to avoid lower-priority sources overwriting
 * higher-priority ones. AAA (priority 100) will never be overwritten by EIA (priority 50).
 */
export async function upsertLatestPrices(prices: EnergyPrice[]): Promise<void> {
  if (prices.length === 0) return;
  const knex = getKnex();

  for (const p of prices) {
    // Get current row to check priority
    const existing = await knex('latest_prices')
      .where('region', p.region)
      .where('metric', p.metric)
      .first();
    
    // Get priority for incoming vs existing source
    const incomingPriority = SOURCE_PRIORITY[p.source as keyof typeof SOURCE_PRIORITY] ?? 0;
    const existingPriority = existing ? (SOURCE_PRIORITY[(existing.source as keyof typeof SOURCE_PRIORITY)] ?? 0) : 0;
    
    // Only update if incoming source has higher priority, or no existing data
    if (!existing || incomingPriority >= existingPriority) {
      await knex('latest_prices')
        .insert({
          region: p.region,
          metric: p.metric,
          value: p.value,
          time: p.time,
          source: p.source,
        })
        .onConflict(['region', 'metric'])
        .merge(['value', 'time', 'source']);
    }
  }
}

export interface PriceChangesRow {
  metric: string;
  region: string;
  current_price: number | null;
  week_ago_price: number | null;
  week_change_pct: number | null;
  month_ago_price: number | null;
  month_change_pct: number | null;
  three_month_ago_price: number | null;
  three_month_change_pct: number | null;
  year_ago_price: number | null;
  year_change_pct: number | null;
  updated_at?: Date;
}

/**
 * Upsert pre-computed price change snapshots into price_changes_cache.
 * Called by the job queue after each EIA ingest so /prices/changes is O(1).
 */
export async function upsertPriceChangesCache(rows: PriceChangesRow[]): Promise<void> {
  if (rows.length === 0) return;
  const knex = getKnex();
  const MERGE_COLS = [
    'current_price', 'week_ago_price', 'week_change_pct',
    'month_ago_price', 'month_change_pct',
    'three_month_ago_price', 'three_month_change_pct',
    'year_ago_price', 'year_change_pct', 'updated_at',
  ] as const;

  for (const row of rows) {
    await knex('price_changes_cache')
      .insert({ ...row, updated_at: new Date() })
      .onConflict(['metric', 'region'])
      .merge(MERGE_COLS);
  }
}

/**
 * Retrieve pre-computed price changes for a given metric + region.
 * Returns null if the cache has not been populated yet.
 */
export async function getPriceChangesFromCache(
  metric: string,
  region: string
): Promise<PriceChangesRow | null> {
  const knex = getKnex();
  const row = await knex('price_changes_cache')
    .where({ metric, region })
    .first();
  return row ?? null;
}

/**
 * Get latest prices for all regions for a given metric.
 * Fast O(1) lookup from snapshot table (alternative to hypertable scan).
 * Prefers AAA over EIA by weight source priority in the query.
 */
export async function getLatestPricesSnapshot(metric?: string): Promise<any[]> {
  const knex = getKnex();
  
  let query = `
    SELECT DISTINCT ON (region, metric) 
      region, metric, value, time, source
    FROM latest_prices
    ${metric ? 'WHERE metric = ?' : ''}
    ORDER BY region, metric,
      CASE source
        WHEN 'aaa' THEN 100
        WHEN 'aaa_wayback' THEN 95
        WHEN 'eia' THEN 50
        WHEN 'fred' THEN 40
        WHEN 'market' THEN 30
        ELSE 0
      END DESC,
      time DESC
  `;
  
  const results = metric 
    ? await knex.raw(query, [metric])
    : await knex.raw(query);
  
  // Handle both { rows: [] } and [] depending on driver
  return Array.isArray(results) ? results : (results.rows ?? []);
}

/**
 * Get historical prices with optional filters
 */
export async function getHistoricalPrices(options: {
  metric?: string;
  region?: string;
  start?: Date;
  end?: Date;
  granularity?: 'daily' | 'weekly' | 'monthly';
}): Promise<any[]> {
  const knex = getKnex();
  const { metric, region, start, end, granularity = 'weekly' } = options;
  
  // Use continuous aggregates for better performance
  const tableName = granularity === 'daily' ? 'daily_prices' :
                    granularity === 'monthly' ? 'monthly_prices' :
                    'weekly_prices';
  
  let query = knex(tableName)
    .select('bucket as time', 'metric', 'region', 'avg_price as value', 'min_price', 'max_price')
    .orderBy('bucket', 'desc');
  
  if (metric) query = query.where({ metric });
  if (region) query = query.where({ region });
  if (start) query = query.where('bucket', '>=', start);
  if (end) query = query.where('bucket', '<=', end);
  
  return query;
}

/**
 * Get price statistics for a given period
 */
export async function getPriceStats(
  metric: string,
  region: string,
  days: number
): Promise<any> {
  const knex = getKnex();
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  return knex('energy_prices')
    .select(
      knex.raw('AVG(value) as avg_price'),
      knex.raw('MIN(value) as min_price'),
      knex.raw('MAX(value) as max_price'),
      knex.raw('STDDEV(value) as stddev_price'),
      knex.raw('COUNT(*) as sample_count')
    )
    .where({ metric, region })
    .where('time', '>=', since)
    .first();
}

/**
 * Calculate week-over-week price changes.
 *
 * Uses a source-preference strategy to avoid mixing EIA weekly data with
 * AAA daily scrapes inside the same time bucket (which produces artificial
 * jumps). For each week we take the EIA value if available, otherwise AAA,
 * otherwise any source.
 */
export async function getWeeklyChanges(
  metric: string,
  region: string,
  weeks: number = 52
): Promise<any[]> {
  const knex = getKnex();

  return knex.raw(`
    WITH ranked AS (
      SELECT
        time_bucket('7 days', time)     AS week,
        value,
        source,
        -- Prefer EIA > AAA > everything else within the same week
        ROW_NUMBER() OVER (
          PARTITION BY time_bucket('7 days', time)
          ORDER BY
            CASE source
              WHEN 'eia'  THEN 1
              WHEN 'aaa'  THEN 2
              ELSE             3
            END,
            time DESC
        ) AS rn
      FROM energy_prices
      WHERE metric = ? AND region = ?
    ),
    weekly_data AS (
      SELECT week, value AS avg_price
      FROM   ranked
      WHERE  rn = 1
      ORDER  BY week DESC
      LIMIT  ?
    )
    SELECT
      week,
      avg_price,
      LAG(avg_price) OVER (ORDER BY week) as prev_price,
      (avg_price - LAG(avg_price) OVER (ORDER BY week))
        / NULLIF(LAG(avg_price) OVER (ORDER BY week), 0) as pct_change
    FROM weekly_data
    ORDER BY week DESC
  `, [metric, region, weeks]).then(result => result.rows);
}

/**
 * Get the latest daily price for every state across all fuel metrics.
 * Returns one row per state with regular, midgrade, premium, and diesel prices.
 */
export async function getAllStatePrices(): Promise<any[]> {
  const knex = getKnex();

  return knex.raw(`
    WITH latest AS (
      SELECT DISTINCT ON (metric, region)
        metric, region, value, time
      FROM energy_prices
      WHERE metric IN ('gas_regular', 'gas_midgrade', 'gas_premium', 'diesel')
        AND region ~ '^S[A-Z]{2}$'
      ORDER BY metric, region, time DESC
    )
    SELECT
      region,
      MAX(CASE WHEN metric = 'gas_regular'  THEN value END) AS regular,
      MAX(CASE WHEN metric = 'gas_midgrade' THEN value END) AS mid_grade,
      MAX(CASE WHEN metric = 'gas_premium'  THEN value END) AS premium,
      MAX(CASE WHEN metric = 'diesel'       THEN value END) AS diesel,
      MAX(time) AS time
    FROM latest
    GROUP BY region
    ORDER BY region
  `).then((r: any) => r.rows);
}

/**
 * Get data freshness information — latest timestamp per source × metric × region class.
 * Region class is one of: national (NUS/US), PADD (R**), or state (S**).
 */
export async function getDataStatus(): Promise<any[]> {
  const knex = getKnex();

  return knex.raw(`
    SELECT
      source,
      metric,
      CASE
        WHEN region IN ('US', 'NUS') THEN 'National'
        WHEN region ~ '^R[0-9]+$'    THEN 'PADD'
        WHEN region ~ '^S[A-Z]{2}$'  THEN 'State'
        ELSE 'Other'
      END AS region_class,
      COUNT(DISTINCT region) AS region_count,
      MAX(time)              AS latest_time,
      MIN(time)              AS earliest_time,
      COUNT(*)               AS total_rows
    FROM energy_prices
    GROUP BY source, metric, region_class
    ORDER BY source, metric, region_class
  `).then((r: any) => r.rows);
}

/**
 * Get price changes vs 1 week, 1 month, and 1 year ago for a metric/region
 */
export async function getPriceChanges(metric: string, region: string): Promise<any> {
  const knex = getKnex();

  return knex.raw(`
    WITH current_price AS (
      SELECT value, time
      FROM energy_prices
      WHERE metric = ? AND region = ?
      ORDER BY time DESC
      LIMIT 1
    ),
    week_ago AS (
      SELECT value, time
      FROM energy_prices
      WHERE metric = ? AND region = ?
        AND time <= NOW() - INTERVAL '7 days'
      ORDER BY time DESC
      LIMIT 1
    ),
    month_ago AS (
      SELECT value, time
      FROM energy_prices
      WHERE metric = ? AND region = ?
        AND time <= NOW() - INTERVAL '30 days'
      ORDER BY time DESC
      LIMIT 1
    ),
    three_month_ago AS (
      SELECT value, time
      FROM energy_prices
      WHERE metric = ? AND region = ?
        AND time <= NOW() - INTERVAL '90 days'
      ORDER BY time DESC
      LIMIT 1
    ),
    year_ago AS (
      SELECT value, time
      FROM energy_prices
      WHERE metric = ? AND region = ?
        AND time <= NOW() - INTERVAL '365 days'
      ORDER BY time DESC
      LIMIT 1
    )
    SELECT
      c.value  AS current_price,
      c.time   AS current_time,
      w.value  AS week_ago_price,
      w.time   AS week_ago_time,
      m.value  AS month_ago_price,
      m.time   AS month_ago_time,
      t.value  AS three_month_ago_price,
      t.time   AS three_month_ago_time,
      y.value  AS year_ago_price,
      y.time   AS year_ago_time,
      CASE WHEN w.value IS NOT NULL AND w.value > 0
        THEN ROUND(((c.value - w.value) / w.value * 100)::numeric, 2)
      END AS week_change_pct,
      CASE WHEN m.value IS NOT NULL AND m.value > 0
        THEN ROUND(((c.value - m.value) / m.value * 100)::numeric, 2)
      END AS month_change_pct,
      CASE WHEN t.value IS NOT NULL AND t.value > 0
        THEN ROUND(((c.value - t.value) / t.value * 100)::numeric, 2)
      END AS three_month_change_pct,
      CASE WHEN y.value IS NOT NULL AND y.value > 0
        THEN ROUND(((c.value - y.value) / y.value * 100)::numeric, 2)
      END AS year_change_pct
    FROM current_price c
    LEFT JOIN week_ago        w ON true
    LEFT JOIN month_ago       m ON true
    LEFT JOIN three_month_ago t ON true
    LEFT JOIN year_ago        y ON true
  `, [metric, region, metric, region, metric, region, metric, region, metric, region])
    .then(r => r.rows[0] || null);
}

/**
 * Get weekly-averaged price series joined by ISO week number for correlation analysis.
 * Queries energy_prices directly (bypasses the continuous aggregate) to get full
 * coverage immediately after data inserts, and aligns gas / crude by ISO week even
 * when EIA stores them on different days of the week.
 *
 * Returns rows sorted oldest → newest with matched gas and crude values.
 */
export async function getCorrelationSeries(options: {
  gasRegion: string;
  startDate?: string;
  endDate?: string;
  weeks?: number;
}): Promise<{ week: string; gas_value: number; crude_value: number }[]> {
  const knex = getKnex();
  const { gasRegion, startDate, endDate, weeks = 200 } = options;

  const start = startDate ?? (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 4);
    return d.toISOString().slice(0, 10);
  })();
  const end = endDate ?? new Date().toISOString().slice(0, 10);

  return knex.raw(`
    WITH
      gas_weekly AS (
        SELECT
          DATE_TRUNC('week', time) AS week,
          AVG(value)               AS gas_value
        FROM   energy_prices
        WHERE  metric = 'gas_regular'
          AND  region = ?
          AND  time BETWEEN ?::timestamptz AND ?::timestamptz
        GROUP BY 1
      ),
      crude_weekly AS (
        SELECT
          DATE_TRUNC('week', time) AS week,
          AVG(value)               AS crude_value
        FROM   energy_prices
        WHERE  metric = 'crude_wti'
          AND  region = 'US'
          AND  time BETWEEN ?::timestamptz AND ?::timestamptz
        GROUP BY 1
      )
    SELECT
      g.week::text,
      g.gas_value,
      c.crude_value
    FROM   gas_weekly   g
    JOIN   crude_weekly c USING (week)
    ORDER BY 1
    LIMIT  ?
  `, [gasRegion, start, end, start, end, weeks])
    .then((r: any) => r.rows);
}

/**
 * Get a seasonal comparison: current price vs the average price for the same
 * ISO week across the prior `years` years.  For example, if today is week 11
 * of 2026 and years = 5, the baseline is the average of week-11 prices from
 * 2021–2025.  Returns current price, seasonal average, delta, and percent
 * above/below seasonal norm.
 */
export async function getSeasonalComparison(
  metric: string,
  region: string,
  years: number = 5,
): Promise<{
  currentPrice: number;
  seasonalAvg: number;
  delta: number;
  deltaPct: number;
  isoWeek: number;
  yearsIncluded: number;
} | null> {
  const knex = getKnex();

  const result = await knex.raw(`
    WITH current_price AS (
      SELECT value, time, EXTRACT(WEEK FROM time)::int AS iso_week
      FROM energy_prices
      WHERE metric = ? AND region = ?
      ORDER BY time DESC
      LIMIT 1
    ),
    seasonal AS (
      SELECT
        AVG(ep.value) AS avg_price,
        COUNT(DISTINCT EXTRACT(YEAR FROM ep.time))::int AS years_included
      FROM energy_prices ep, current_price cp
      WHERE ep.metric = ?
        AND ep.region = ?
        AND EXTRACT(WEEK FROM ep.time) = cp.iso_week
        AND ep.time < DATE_TRUNC('year', cp.time)
        AND ep.time >= DATE_TRUNC('year', cp.time) - INTERVAL '1 year' * ?
    )
    SELECT
      cp.value       AS current_price,
      cp.iso_week,
      s.avg_price    AS seasonal_avg,
      s.years_included
    FROM current_price cp, seasonal s
  `, [metric, region, metric, region, years]);

  const row = result.rows[0];
  if (!row || row.current_price == null || row.seasonal_avg == null) return null;

  const current = parseFloat(row.current_price);
  const avg = parseFloat(row.seasonal_avg);
  const delta = current - avg;
  const deltaPct = avg > 0 ? (delta / avg) * 100 : 0;

  return {
    currentPrice: current,
    seasonalAvg: avg,
    delta,
    deltaPct,
    isoWeek: row.iso_week,
    yearsIncluded: row.years_included,
  };
}

/**
 * Detect gaps in data collection
 */
export async function detectDataGaps(
  metric: string,
  region: string,
  expectedFrequency: 'daily' | 'weekly'
): Promise<any[]> {
  const knex = getKnex();
  const interval = expectedFrequency === 'daily' ? '1 day' : '7 days';
  
  return knex.raw(`
    SELECT
      time + INTERVAL '${interval}' as expected_time,
      LEAD(time) OVER (ORDER BY time) as actual_next_time
    FROM energy_prices
    WHERE metric = ? AND region = ?
    ORDER BY time
  `, [metric, region]).then(result => 
    result.rows.filter((row: any) => 
      row.actual_next_time && row.expected_time < row.actual_next_time
    )
  );
}
