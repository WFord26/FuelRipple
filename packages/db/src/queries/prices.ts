import { Knex } from 'knex';
import { getKnex } from '../index';
import { EnergyPrice } from '@fuelripple/shared';

/**
 * Insert energy prices with deduplication.
 * Chunks rows to stay under PostgreSQL's 65535-parameter bind limit.
 */
export async function insertPrices(prices: EnergyPrice[]): Promise<void> {
  if (prices.length === 0) {
    console.warn('⚠️  No prices to insert');
    return;
  }
  
  const knex = getKnex();
  const CHUNK = 1000; // 1000 rows × ~6 cols = 6000 params per batch

  for (let i = 0; i < prices.length; i += CHUNK) {
    const chunk = prices.slice(i, i + CHUNK);
    await knex('energy_prices')
      .insert(chunk)
      .onConflict(['time', 'source', 'metric', 'region'])
      .ignore();
  }
}

/**
 * Get current prices for all regions
 */
export async function getCurrentPrices(metric: string): Promise<any[]> {
  const knex = getKnex();
  
  return knex.raw(`
    SELECT DISTINCT ON (region) region, value, time
    FROM energy_prices
    WHERE metric = ?
    ORDER BY region, time DESC
  `, [metric]).then(result => result.rows);
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
 * Calculate week-over-week price changes
 */
export async function getWeeklyChanges(
  metric: string,
  region: string,
  weeks: number = 52
): Promise<any[]> {
  const knex = getKnex();
  
  return knex.raw(`
    WITH weekly_data AS (
      SELECT
        time_bucket('7 days', time) as week,
        AVG(value) as avg_price
      FROM energy_prices
      WHERE metric = ? AND region = ?
      GROUP BY week
      ORDER BY week DESC
      LIMIT ?
    )
    SELECT
      week,
      avg_price,
      LAG(avg_price) OVER (ORDER BY week) as prev_price,
      (avg_price - LAG(avg_price) OVER (ORDER BY week)) / LAG(avg_price) OVER (ORDER BY week) as pct_change
    FROM weekly_data
    ORDER BY week DESC
  `, [metric, region, weeks]).then(result => result.rows);
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
