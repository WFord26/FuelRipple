import { Knex } from 'knex';

// create_hypertable cannot run inside a transaction block.
export const config = { transaction: false };

/**
 * Migration: Create aaa_metro_aggregates table
 *
 * Pre-aggregates AAA prices at the metro area level (one row per day per metro).
 * Enables fast metro-level price queries and heatmap visualizations on state maps.
 *
 * Metro ID format: standardized identifier (e.g., "Los Angeles-Long Beach-Anaheim, CA")
 * Updated daily after AAA metro scrape.
 */
export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('aaa_metro_aggregates');
  if (!tableExists) {
    await knex.schema.createTable('aaa_metro_aggregates', (table) => {
      table.timestamp('time', { useTz: true }).notNullable();
      table.text('metro_id').notNullable(); // e.g. "Los Angeles-Long Beach-Anaheim, CA"
      table.text('metro_name').notNullable(); // Display name
      table.text('state_abbr', 2).notNullable(); // 2-letter state code for mapping
      table.double('latitude'); // Center point for map visualization
      table.double('longitude');
      table.double('regular');
      table.double('mid_grade');
      table.double('premium');
      table.double('diesel');

      table.primary(['time', 'metro_id']);
      table.index(['state_abbr', 'time'], 'idx_aaa_metro_state_time');
      table.index(['time'], 'idx_aaa_metro_time');
      table.index(['metro_id'], 'idx_aaa_metro_id');
    });
  }

  // Create TimescaleDB hypertable partition on time
  await knex.raw(`
    SELECT create_hypertable(
      'aaa_metro_aggregates',
      'time',
      chunk_time_interval => INTERVAL '30 days',
      if_not_exists => TRUE
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('aaa_metro_aggregates');
}
