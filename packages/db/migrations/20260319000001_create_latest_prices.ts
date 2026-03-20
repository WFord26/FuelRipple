import { Knex } from 'knex';

/**
 * Migration: Create latest_prices snapshot table
 *
 * Stores the most recent price for each (region, metric) combination.
 * Acts as a denormalized cache layer for fast O(1) current price lookups,
 * eliminating hypertable scans for the /api/v1/prices/current endpoint.
 *
 * Updated on every price ingestion; queried frequently for dashboards.
 */
export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('latest_prices');
  if (!tableExists) {
    await knex.schema.createTable('latest_prices', (table) => {
      table.text('region').notNullable();
      table.text('metric').notNullable();
      table.double('value').notNullable();
      table.timestamp('time', { useTz: true }).notNullable();
      table.text('source').notNullable();

      table.primary(['region', 'metric']);
      table.index(['time'], 'idx_latest_prices_time');
      table.index(['source'], 'idx_latest_prices_source');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('latest_prices');
}
