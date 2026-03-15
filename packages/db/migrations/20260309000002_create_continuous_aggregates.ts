import { Knex } from 'knex';

/**
 * Migration: Create continuous aggregates for pre-computed averages
 * Weekly, monthly, and daily aggregates with automatic refresh
 */
export async function up(knex: Knex): Promise<void> {
  // Note: timescaledb.continuous materialized views and add_continuous_aggregate_policy
  // require the Timescale License and are not available on Azure Database for PostgreSQL
  // (Apache-licensed build). Using standard PostgreSQL materialized views with time_bucket
  // instead — refresh manually or via a scheduled job (e.g. pg_cron or BullMQ cron).

  // Weekly averages
  await knex.raw(`
    CREATE MATERIALIZED VIEW weekly_prices AS
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
    GROUP BY bucket, metric, region;
  `);
  await knex.raw(`CREATE INDEX ON weekly_prices (metric, region, bucket DESC);`);

  // Monthly averages
  await knex.raw(`
    CREATE MATERIALIZED VIEW monthly_prices AS
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
    GROUP BY bucket, metric, region;
  `);
  await knex.raw(`CREATE INDEX ON monthly_prices (metric, region, bucket DESC);`);

  // Daily averages
  await knex.raw(`
    CREATE MATERIALIZED VIEW daily_prices AS
    SELECT
      time_bucket('1 day', time) AS bucket,
      metric,
      region,
      AVG(value) AS avg_price,
      MIN(value) AS min_price,
      MAX(value) AS max_price,
      COUNT(*) AS sample_count
    FROM energy_prices
    GROUP BY bucket, metric, region;
  `);
  await knex.raw(`CREATE INDEX ON daily_prices (metric, region, bucket DESC);`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS daily_prices CASCADE;');
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS monthly_prices CASCADE;');
  await knex.raw('DROP MATERIALIZED VIEW IF EXISTS weekly_prices CASCADE;');
}
