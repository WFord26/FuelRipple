import { Knex } from 'knex';

// create_hypertable cannot run inside a transaction block.
export const config = { transaction: false };

/**
 * Migration: Create aaa_state_aggregates table
 *
 * Pre-aggregates AAA prices at the state level (one row per day per state).
 * Eliminates the need to scan raw energy_prices for state-level queries.
 * Enables fast region/PADD-level aggregation on top of this table.
 *
 * Updated daily after AAA import; queries use this instead of raw energy_prices.
 */
export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('aaa_state_aggregates');
  if (!tableExists) {
    await knex.schema.createTable('aaa_state_aggregates', (table) => {
      table.timestamp('time', { useTz: true }).notNullable();
      table.text('state', 2).notNullable();
      table.double('regular');
      table.double('mid_grade');
      table.double('premium');
      table.double('diesel');

      table.primary(['time', 'state']);
      table.index(['state', 'time'], 'idx_aaa_state_state_time');
      table.index(['time'], 'idx_aaa_state_time');
    });
  }

  // Create TimescaleDB hypertable partition on time
  await knex.raw(`
    SELECT create_hypertable(
      'aaa_state_aggregates',
      'time',
      chunk_time_interval => INTERVAL '30 days',
      if_not_exists => TRUE
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('aaa_state_aggregates');
}
