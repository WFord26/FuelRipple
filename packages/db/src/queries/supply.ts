import { getKnex } from '../index';

export interface RefineryOperationsRow {
  time: Date;
  region: string;
  utilization_pct: number | null;
  crude_inputs: number | null;
  gasoline_production: number | null;
  distillate_production: number | null;
  gasoline_stocks: number | null;
  distillate_stocks: number | null;
  operable_capacity: number | null;
  // Flow columns (migration 5)
  gasoline_imports: number | null;
  distillate_imports: number | null;
  crude_imports: number | null;
  total_exports: number | null;
  product_supplied_gas: number | null;
  product_supplied_dist: number | null;
}

export interface CapacityRow {
  year: number;
  region: string;
  operable_capacity: number | null;
  operating_capacity: number | null;
  idle_capacity: number | null;
  shutdown_capacity: number | null;
}

/**
 * Upsert refinery operations rows.
 * Uses ON CONFLICT on (time, region) to update all metric columns.
 * Chunks rows to stay under PostgreSQL's 65535-parameter bind limit.
 */
export async function upsertRefineryData(rows: RefineryOperationsRow[]): Promise<void> {
  if (rows.length === 0) return;
  const knex = getKnex();
  const CHUNK = 500; // 500 rows × 8 cols = 4000 params per batch

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await knex('refinery_operations')
      .insert(chunk)
      .onConflict(['time', 'region'])
      .merge([
        'utilization_pct',
        'crude_inputs',
        'gasoline_production',
        'distillate_production',
        'gasoline_stocks',
        'distillate_stocks',
        'operable_capacity',
        'gasoline_imports',
        'distillate_imports',
        'crude_imports',
        'total_exports',
        'product_supplied_gas',
        'product_supplied_dist',
      ]);
  }
}

/**
 * Latest utilization by region, plus a 52-week rolling average for context.
 */
export async function getUtilizationByRegion(region?: string): Promise<any[]> {
  const knex = getKnex();

  const result = await knex.raw(`
    WITH latest AS (
      SELECT DISTINCT ON (region)
        region,
        time,
        utilization_pct,
        crude_inputs,
        operable_capacity
      FROM refinery_operations
      WHERE utilization_pct IS NOT NULL
        ${region ? 'AND region = ?' : ''}
      ORDER BY region, time DESC
    ),
    avg_52w AS (
      SELECT
        region,
        AVG(utilization_pct) AS avg_utilization_52w,
        STDDEV(utilization_pct) AS stddev_utilization_52w
      FROM refinery_operations
      WHERE time >= NOW() - INTERVAL '52 weeks'
        AND utilization_pct IS NOT NULL
        ${region ? 'AND region = ?' : ''}
      GROUP BY region
    )
    SELECT
      l.region,
      l.time,
      l.utilization_pct,
      l.crude_inputs,
      l.operable_capacity,
      a.avg_utilization_52w,
      a.stddev_utilization_52w,
      CASE
        WHEN a.stddev_utilization_52w > 0
        THEN (l.utilization_pct - a.avg_utilization_52w) / a.stddev_utilization_52w
        ELSE 0
      END AS stress_z_score
    FROM latest l
    LEFT JOIN avg_52w a ON l.region = a.region
    ORDER BY l.region
  `, region ? [region, region] : []);

  return result.rows;
}

/**
 * Weekly gasoline + distillate production, with 4-week rolling average.
 */
export async function getProductionData(region: string = 'US', weeks: number = 52): Promise<any[]> {
  const knex = getKnex();

  const result = await knex.raw(`
    SELECT
      time,
      region,
      gasoline_production,
      distillate_production,
      AVG(gasoline_production) OVER (
        PARTITION BY region
        ORDER BY time
        ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
      ) AS gasoline_prod_4w_avg,
      AVG(distillate_production) OVER (
        PARTITION BY region
        ORDER BY time
        ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
      ) AS distillate_prod_4w_avg,
      LAG(gasoline_production, 52) OVER (PARTITION BY region ORDER BY time) AS gasoline_prod_year_ago
    FROM refinery_operations
    WHERE region = ?
      AND time >= NOW() - (? * INTERVAL '1 week')
      AND gasoline_production IS NOT NULL
    ORDER BY time DESC
  `, [region, weeks]);

  return result.rows;
}

/**
 * Weekly gasoline + distillate stock levels with days-of-supply calculation.
 * days_of_supply = stocks / 4-week avg daily demand (approx from production proxy)
 */
export async function getInventoryData(region: string = 'US', weeks: number = 104): Promise<any[]> {
  const knex = getKnex();

  const result = await knex.raw(`
    WITH stock_data AS (
      SELECT
        time,
        region,
        gasoline_stocks,
        distillate_stocks,
        gasoline_production,
        -- Rough days-of-supply: stocks / (daily avg production as demand proxy)
        CASE
          WHEN gasoline_production > 0
          THEN (gasoline_stocks / (gasoline_production / 7.0))
          ELSE NULL
        END AS gasoline_days_supply,
        AVG(gasoline_stocks) OVER (
          PARTITION BY region
          ORDER BY time
          ROWS BETWEEN 51 PRECEDING AND CURRENT ROW
        ) AS gasoline_stocks_52w_avg,
        STDDEV(gasoline_stocks) OVER (
          PARTITION BY region
          ORDER BY time
          ROWS BETWEEN 51 PRECEDING AND CURRENT ROW
        ) AS gasoline_stocks_52w_stddev
      FROM refinery_operations
      WHERE region = ?
        AND gasoline_stocks IS NOT NULL
    )
    SELECT
      time,
      region,
      gasoline_stocks,
      distillate_stocks,
      gasoline_days_supply,
      gasoline_stocks_52w_avg,
      gasoline_stocks_52w_stddev,
      CASE
        WHEN gasoline_stocks_52w_stddev > 0
        THEN (gasoline_stocks - gasoline_stocks_52w_avg) / gasoline_stocks_52w_stddev
        ELSE 0
      END AS inventory_z_score
    FROM stock_data
    WHERE time >= NOW() - (? * INTERVAL '1 week')
    ORDER BY time DESC
  `, [region, weeks]);

  return result.rows;
}

/**
 * Composite supply health score combining utilization stress + inventory health.
 * Returns one row per region with current scores and an overall classification.
 */
export async function getSupplyHealth(): Promise<any[]> {
  const knex = getKnex();

  const result = await knex.raw(`
    WITH current AS (
      SELECT DISTINCT ON (region)
        region,
        time,
        utilization_pct,
        gasoline_stocks,
        gasoline_production,
        distillate_stocks
      FROM refinery_operations
      WHERE utilization_pct IS NOT NULL
      ORDER BY region, time DESC
    ),
    stats_52w AS (
      SELECT
        region,
        AVG(utilization_pct)    AS avg_util,
        STDDEV(utilization_pct) AS std_util,
        AVG(gasoline_stocks)    AS avg_stocks,
        STDDEV(gasoline_stocks) AS std_stocks
      FROM refinery_operations
      WHERE time >= NOW() - INTERVAL '52 weeks'
      GROUP BY region
    )
    SELECT
      c.region,
      c.time        AS latest_data_time,
      c.utilization_pct,
      c.gasoline_stocks,
      c.distillate_stocks,
      -- Z-scores (negative = worse than average)
      CASE WHEN s.std_util   > 0 THEN (c.utilization_pct - s.avg_util)   / s.std_util   ELSE 0 END AS util_z,
      CASE WHEN s.std_stocks > 0 THEN (c.gasoline_stocks  - s.avg_stocks) / s.std_stocks ELSE 0 END AS inventory_z,
      -- Simple composite: average of the two z-scores (positive = healthy, negative = stressed)
      CASE
        WHEN s.std_util > 0 AND s.std_stocks > 0
        THEN ((c.utilization_pct - s.avg_util) / s.std_util +
              (c.gasoline_stocks  - s.avg_stocks) / s.std_stocks) / 2.0
        ELSE 0
      END AS composite_z,
      -- Human-readable classification
      CASE
        WHEN (c.utilization_pct - s.avg_util) / NULLIF(s.std_util, 0) > -0.5
          AND (c.gasoline_stocks - s.avg_stocks) / NULLIF(s.std_stocks, 0) > -0.5
        THEN 'normal'
        WHEN (c.utilization_pct - s.avg_util) / NULLIF(s.std_util, 0) > -1.5
        THEN 'elevated_risk'
        WHEN (c.utilization_pct - s.avg_util) / NULLIF(s.std_util, 0) > -2.5
        THEN 'supply_stress'
        ELSE 'critical'
      END AS classification
    FROM current c
    LEFT JOIN stats_52w s ON c.region = s.region
    ORDER BY c.region
  `);

  return result.rows;
}

/**
 * Weekly petroleum flow balance: imports, exports, product-supplied (implied demand),
 * and computed import-dependency % per region.
 *
 * import_dependency_pct = gasoline_imports / product_supplied_gas * 100
 * A high value (East Coast ~50%+) signals greater vulnerability to import disruptions.
 */
export async function getFlowData(region: string = 'US', weeks: number = 52): Promise<any[]> {
  const knex = getKnex();

  const result = await knex.raw(`
    SELECT
      time,
      region,
      gasoline_imports,
      distillate_imports,
      crude_imports,
      total_exports,
      product_supplied_gas,
      product_supplied_dist,
      -- Import dependency: what fraction of gasoline demand is met by imports
      CASE
        WHEN product_supplied_gas > 0
        THEN ROUND((gasoline_imports / product_supplied_gas) * 100, 1)
        ELSE NULL
      END AS import_dependency_pct,
      -- 4-week rolling averages for smoothing
      AVG(gasoline_imports) OVER (
        PARTITION BY region ORDER BY time
        ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
      ) AS gasoline_imports_4w_avg,
      AVG(product_supplied_gas) OVER (
        PARTITION BY region ORDER BY time
        ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
      ) AS product_supplied_gas_4w_avg,
      -- Year-ago comparison
      LAG(gasoline_imports, 52) OVER (PARTITION BY region ORDER BY time) AS gasoline_imports_year_ago,
      LAG(product_supplied_gas, 52) OVER (PARTITION BY region ORDER BY time) AS product_supplied_gas_year_ago
    FROM refinery_operations
    WHERE region = ?
      AND time >= NOW() - (? * INTERVAL '1 week')
      AND (gasoline_imports IS NOT NULL OR product_supplied_gas IS NOT NULL)
    ORDER BY time DESC
  `, [region, weeks]);

  return result.rows;
}

/**
 * Annual refinery capacity from EIA Form 820.
 * Returns the most recent year available or a specific year if requested.
 */
export async function getCapacityData(year?: number): Promise<any[]> {
  const knex = getKnex();

  if (year) {
    return knex('refinery_capacity')
      .where({ year })
      .orderBy('region');
  }

  // Return most recent year available per region
  const result = await knex.raw(`
    SELECT DISTINCT ON (region)
      year,
      region,
      operable_capacity,
      operating_capacity,
      idle_capacity,
      shutdown_capacity,
      updated_at,
      -- Utilization of operable capacity (operating / operable)
      CASE
        WHEN operable_capacity > 0
        THEN ROUND((operating_capacity / operable_capacity) * 100, 1)
        ELSE NULL
      END AS capacity_utilization_pct,
      -- Idle as % of operable
      CASE
        WHEN operable_capacity > 0
        THEN ROUND((idle_capacity / operable_capacity) * 100, 1)
        ELSE NULL
      END AS idle_pct
    FROM refinery_capacity
    ORDER BY region, year DESC
  `);

  return result.rows;
}

/**
 * Upsert annual EIA-820 refinery capacity rows.
 */
export async function upsertCapacityData(rows: CapacityRow[]): Promise<void> {
  if (rows.length === 0) return;
  const knex = getKnex();

  // Add updated_at timestamp
  const rowsWithTs = rows.map(r => ({ ...r, updated_at: new Date() }));

  await knex('refinery_capacity')
    .insert(rowsWithTs)
    .onConflict(['year', 'region'])
    .merge(['operable_capacity', 'operating_capacity', 'idle_capacity', 'shutdown_capacity', 'updated_at']);
}
