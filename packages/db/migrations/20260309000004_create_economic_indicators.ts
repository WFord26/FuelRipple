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

  // Enable compression
  await knex.raw(`
    ALTER TABLE economic_indicators SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'indicator',
      timescaledb.compress_orderby = 'time DESC'
    );
  `);

  // Add compression policy
  await knex.raw(`
    SELECT add_compression_policy(
      'economic_indicators',
      INTERVAL '6 months',
      if_not_exists => TRUE
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('economic_indicators');
}
