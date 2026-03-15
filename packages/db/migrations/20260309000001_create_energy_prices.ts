import { Knex } from 'knex';

/**
 * Migration: Create energy_prices hypertable
 * Primary time-series table for gas, crude oil, and diesel prices
 */
export async function up(knex: Knex): Promise<void> {
  // Enable TimescaleDB extension (requires shared_preload_libraries = 'timescaledb' on the server)
  await knex.raw(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);

  // Create energy_prices table (guard against partial prior runs)
  const tableExists = await knex.schema.hasTable('energy_prices');
  if (!tableExists) {
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
  } // end if (!tableExists)

  // Convert to TimescaleDB hypertable
  await knex.raw(`
    SELECT create_hypertable(
      'energy_prices',
      'time',
      chunk_time_interval => INTERVAL '7 days',
      if_not_exists => TRUE
    );
  `);

  // Note: TimescaleDB native compression (timescaledb.compress) requires the
  // Timescale License and is not available on Azure Database for PostgreSQL
  // (Apache-licensed build). PostgreSQL table partitioning via hypertable
  // chunks provides equivalent storage efficiency for this workload.
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('energy_prices');
}
