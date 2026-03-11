import { Knex } from 'knex';

/**
 * Migration: Create refinery_operations hypertable
 * Tracks weekly EIA WPSR (Weekly Petroleum Status Report) supply-side data:
 * refinery utilization %, crude inputs, gasoline/distillate production,
 * and total petroleum stock levels by PADD region and national (US).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('refinery_operations', (table) => {
    table.timestamp('time', { useTz: true }).notNullable();
    // 'US' for national, 'R10'–'R50' for PADD regions
    table.text('region').notNullable();
    // Percent of operable capacity (e.g. 91.5)
    table.double('utilization_pct').nullable();
    // Thousand barrels per day
    table.double('crude_inputs').nullable();
    // Thousand barrels per day
    table.double('gasoline_production').nullable();
    // Thousand barrels per day
    table.double('distillate_production').nullable();
    // Thousand barrels
    table.double('gasoline_stocks').nullable();
    // Thousand barrels
    table.double('distillate_stocks').nullable();
    // Thousand barrels per day (updated monthly)
    table.double('operable_capacity').nullable();

    table.index(['region', 'time'], 'idx_refinery_region_time');
    table.unique(['time', 'region'], { indexName: 'uq_refinery_operations' });
  });

  // Convert to TimescaleDB hypertable partitioned by week
  await knex.raw(`
    SELECT create_hypertable(
      'refinery_operations',
      'time',
      chunk_time_interval => INTERVAL '30 days',
      if_not_exists => TRUE
    );
  `);

  // Enable compression (compress data older than 6 months)
  await knex.raw(`
    ALTER TABLE refinery_operations SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'region',
      timescaledb.compress_orderby = 'time DESC'
    );
  `);

  await knex.raw(`
    SELECT add_compression_policy(
      'refinery_operations',
      INTERVAL '6 months',
      if_not_exists => TRUE
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('refinery_operations');
}
