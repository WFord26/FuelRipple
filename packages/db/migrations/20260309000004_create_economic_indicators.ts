import { Knex } from 'knex';

/**
 * Migration: Create economic_indicators hypertable
 * For CPI, PPI trucking, freight rates, etc.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('economic_indicators', (table) => {
    table.timestamp('time', { useTz: true }).notNullable();
    table.text('indicator').notNullable();
    table.double('value').notNullable();
    table.text('source').notNullable();
    
    table.index(['indicator', 'time'], 'idx_indicators_indicator_time');
    table.unique(['time', 'indicator', 'source'], {
      indexName: 'uq_economic_indicators',
    });
  });

  // Convert to TimescaleDB hypertable
  await knex.raw(`
    SELECT create_hypertable(
      'economic_indicators',
      'time',
      chunk_time_interval => INTERVAL '30 days',
      if_not_exists => TRUE
    );
  `);

  // Note: timescaledb.compress requires the Timescale License and is not
  // available on Azure Database for PostgreSQL (Apache-licensed build).
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('economic_indicators');
}
