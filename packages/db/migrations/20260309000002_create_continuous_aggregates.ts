import { Knex } from 'knex';

/**
 * Migration: Create continuous aggregates for pre-computed averages
 * Weekly, monthly, and daily aggregates with automatic refresh
 */
export async function up(knex: Knex): Promise<void> {
  // Weekly averages continuous aggregate
  await knex.raw(`
    CREATE MATERIALIZED VIEW weekly_prices
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('7 days', time) AS bucket,
      metric,
      region,
      AVG(value) AS avg_price,
      MIN(value) AS min_price,
      MAX(value) AS max_price,
      STDDEV(value) AS stddev_price,
      COUNT(*) AS sample_count
    FROM energy_prices
    GROUP BY bucket, metric, region
    WITH NO DATA;
  `);

  // Add refresh policy for weekly aggregate (refresh every 24 hours)
  // start_offset covers the full backfill window so historical loads are picked up
  await knex.raw(`
    SELECT add_continuous_aggregate_policy(
      'weekly_prices',
      start_offset => INTERVAL '10 years',
      end_offset => INTERVAL '1 day',
      schedule_interval => INTERVAL '24 hours',
      if_not_exists => TRUE
    );
  `);

  // Monthly averages continuous aggregate
  await knex.raw(`
    CREATE MATERIALIZED VIEW monthly_prices
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('30 days', time) AS bucket,
      metric,
      region,
      AVG(value) AS avg_price,
      MIN(value) AS min_price,
      MAX(value) AS max_price,
      STDDEV(value) AS stddev_price,
      COUNT(*) AS sample_count
    FROM energy_prices
    GROUP BY bucket, metric, region
    WITH NO DATA;
  `);

  // Add refresh policy for monthly aggregate
  await knex.raw(`
    SELECT add_continuous_aggregate_policy(
      'monthly_prices',
      start_offset => INTERVAL '10 years',
      end_offset => INTERVAL '1 day',
      schedule_interval => INTERVAL '24 hours',
      if_not_exists => TRUE
    );
  `);

  // Daily averages continuous aggregate
  await knex.raw(`
    CREATE MATERIALIZED VIEW daily_prices
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 day', time) AS bucket,
      metric,
      region,
      AVG(value) AS avg_price,
      MIN(value) AS min_price,
      MAX(value) AS max_price,
      COUNT(*) AS sample_count
    FROM energy_prices
    GROUP BY bucket, metric, region
    WITH NO DATA;
  `);

  // Add refresh policy for daily aggregate
  await knex.raw(`
    SELECT add_continuous_aggregate_policy(
      'daily_prices',
      start_offset => INTERVAL '10 years',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '6 hours',
      if_not_exists => TRUE
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS daily_prices CASCADE;');
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS monthly_prices CASCADE;');
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS weekly_prices CASCADE;');
}
