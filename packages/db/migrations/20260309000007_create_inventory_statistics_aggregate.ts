import { Knex } from 'knex';

// CREATE MATERIALIZED VIEW ... WITH DATA cannot run inside a transaction block.
export const config = { transaction: false };

/**
 * Migration: Create materialized view for inventory statistics
 *
 * Pre-computes 52-week rolling averages and standard deviations for
 * gasoline/distillate stocks using a standard PostgreSQL materialized view.
 *
 * NOTE: timescaledb.continuous aggregates require the Timescale commercial
 * license and are not available on the Apache-licensed build (Azure PG).
 * This view is refreshed via REFRESH MATERIALIZED VIEW CONCURRENTLY in
 * refreshMaterializedViews(), called by the BullMQ workers on each data load.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS inventory_statistics_52w AS
    SELECT
      time,
      region,
      gasoline_stocks,
      distillate_stocks,
      product_supplied_gas,
      product_supplied_dist,
      gasoline_production,
      distillate_production,
      AVG(gasoline_stocks) OVER (
        PARTITION BY region
        ORDER BY time
        ROWS BETWEEN 51 PRECEDING AND CURRENT ROW
      ) AS gasoline_stocks_52w_avg,
      STDDEV(gasoline_stocks) OVER (
        PARTITION BY region
        ORDER BY time
        ROWS BETWEEN 51 PRECEDING AND CURRENT ROW
      ) AS gasoline_stocks_52w_stddev,
      AVG(distillate_stocks) OVER (
        PARTITION BY region
        ORDER BY time
        ROWS BETWEEN 51 PRECEDING AND CURRENT ROW
      ) AS distillate_stocks_52w_avg,
      STDDEV(distillate_stocks) OVER (
        PARTITION BY region
        ORDER BY time
        ROWS BETWEEN 51 PRECEDING AND CURRENT ROW
      ) AS distillate_stocks_52w_stddev
    FROM refinery_operations
    WHERE
      gasoline_stocks IS NOT NULL
      AND distillate_stocks IS NOT NULL
    WITH DATA;
  `);

  // Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_stats_region_time
    ON inventory_statistics_52w (region, time);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS inventory_statistics_52w CASCADE;`);
}
