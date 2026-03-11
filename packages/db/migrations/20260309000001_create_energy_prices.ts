import { Knex } from 'knex';

/**
 * Migration: Create energy_prices hypertable
 * Primary time-series table for gas, crude oil, and diesel prices
 */
export async function up(knex: Knex): Promise<void> {
  // Create energy_prices table
  await knex.schema.createTable('energy_prices', (table) => {
    table.timestamp('time', { useTz: true }).notNullable();
    table.text('source').notNullable();
    table.text('metric').notNullable();
    table.text('region').defaultTo('US');
    table.double('value').notNullable();
    table.text('unit').notNullable();
    
    // Composite index for efficient queries
    table.index(['metric', 'region', 'time'], 'idx_prices_metric_region');
    table.index(['source', 'time'], 'idx_prices_source');
    
    // Unique constraint to prevent duplicate entries
    table.unique(['time', 'source', 'metric', 'region'], {
      indexName: 'uq_energy_prices',
    });
  });

  // Convert to TimescaleDB hypertable
  await knex.raw(`
    SELECT create_hypertable(
      'energy_prices',
      'time',
      chunk_time_interval => INTERVAL '7 days',
      if_not_exists => TRUE
    );
  `);

  // Enable compression
  await knex.raw(`
    ALTER TABLE energy_prices SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'metric, region',
      timescaledb.compress_orderby = 'time DESC'
    );
  `);

  // Add compression policy for data older than 6 months
  await knex.raw(`
    SELECT add_compression_policy(
      'energy_prices',
      INTERVAL '6 months',
      if_not_exists => TRUE
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('energy_prices');
}
