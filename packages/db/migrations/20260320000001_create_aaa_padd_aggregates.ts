import { Knex } from 'knex';

// create_hypertable cannot run inside a transaction block.
export const config = { transaction: false };

/**
 * Migration: Create aaa_padd_aggregates hypertable
 *
 * Stores daily PADD-level (regional) gas price aggregates derived from AAA
 * per-state data. Two aggregation methods are stored for every grade:
 *
 *   *_mean  — simple arithmetic mean across all reporting states in the region
 *   *_wtd   — population-weighted mean (2020 Census weights) to account for the
 *             fact that large states (CA, TX, FL) dominate fuel consumption
 *
 * Updated daily immediately after aaa_state_aggregates is written. Queries
 * use this table instead of re-aggregating from state-level rows at runtime.
 *
 * PADD codes: R10 (East Coast), R20 (Midwest), R30 (Gulf Coast),
 *             R40 (Rocky Mountain), R50 (West Coast)
 */
export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('aaa_padd_aggregates');
  if (!tableExists) {
    await knex.schema.createTable('aaa_padd_aggregates', (table) => {
      table.timestamp('time', { useTz: true }).notNullable();
      table.string('padd', 3).notNullable();   // R10 – R50

      // Simple mean (equal weight per state)
      table.double('regular_mean').nullable();
      table.double('mid_grade_mean').nullable();
      table.double('premium_mean').nullable();
      table.double('diesel_mean').nullable();

      // Population-weighted mean (2020 Census)
      table.double('regular_wtd').nullable();
      table.double('mid_grade_wtd').nullable();
      table.double('premium_wtd').nullable();
      table.double('diesel_wtd').nullable();

      // How many states contributed a valid regular price that day
      table.integer('state_count').notNullable().defaultTo(0);

      table.primary(['time', 'padd']);
      table.index(['padd', 'time'], 'idx_aaa_padd_padd_time');
      table.index(['time'], 'idx_aaa_padd_time');
    });
  }

  await knex.raw(`
    SELECT create_hypertable(
      'aaa_padd_aggregates',
      'time',
      chunk_time_interval => INTERVAL '30 days',
      if_not_exists => TRUE
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('aaa_padd_aggregates');
}
