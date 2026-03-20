import { Knex } from 'knex';

// create_hypertable cannot run inside a transaction block.
export const config = { transaction: false };

/**
 * Migration: Create aaa_national_averages hypertable
 *
 * Stores the daily US nationwide average gas prices derived from AAA's
 * per-state data.  One row per day covering unleaded (regular),
 * mid-grade, premium, and diesel.  state_count records how many states
 * contributed that day so data-quality checks are straightforward.
 */
export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('aaa_national_averages');
  if (!tableExists) {
    await knex.schema.createTable('aaa_national_averages', (table) => {
      table.timestamp('time', { useTz: true }).notNullable();
      table.double('regular');
      table.double('mid_grade');
      table.double('premium');
      table.double('diesel');
      // Number of states that returned a valid regular price that day
      table.integer('state_count').notNullable().defaultTo(0);

      table.primary(['time']);
      table.index(['time'], 'idx_aaa_national_time');
    });
  }

  // Convert to TimescaleDB hypertable — daily data so 30-day chunks are plenty
  await knex.raw(`
    SELECT create_hypertable(
      'aaa_national_averages',
      'time',
      chunk_time_interval => INTERVAL '30 days',
      if_not_exists => TRUE
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('aaa_national_averages');
}
