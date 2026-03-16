import { Knex } from 'knex';

/**
 * Migration: Create TimescaleDB continuous aggregate for inventory statistics
 * 
 * Pre-computes 52-week rolling averages and standard deviations for gasoline/distillate stocks.
 * This eliminates the expensive window function computation on every query, freeing up locks
 * and shared memory on the `refinery_operations` hypertable.
 * 
 * The continuous aggregate automatically refreshes on a background policy.
 */
export async function up(knex: Knex): Promise<void> {
  // Create the continuous aggregate view
  await knex.raw(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS inventory_statistics_52w
    WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
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
  `);

  // Set up continuous aggregate refresh policy (refresh hourly)
  await knex.raw(`
    SELECT add_continuous_aggregate_policy(
      'inventory_statistics_52w',
      start_offset => INTERVAL '5 days',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    );
  `);

  // Create indexes for efficient queries
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_inventory_stats_region_time
    ON inventory_statistics_52w (region, time DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Remove the continuous aggregate policy first
  await knex.raw(`
    SELECT remove_continuous_aggregate_policy(
      'inventory_statistics_52w',
      if_exists => TRUE,
      cascade => FALSE
    );
  `).catch(() => {
    // Policy may not exist; ignore error
  });

  // Drop the materialized view
  await knex.raw(`DROP MATERIALIZED VIEW IF EXISTS inventory_statistics_52w CASCADE`);
}
