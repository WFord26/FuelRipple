import type { Knex } from 'knex';

/**
 * Phase 2: Pre-computed price change snapshots.
 *
 * Stores the most recent week/month/3-month/year ago prices and percentage
 * changes for each (metric, region) combination. Updated by the job queue
 * after each EIA ingest so the /prices/changes endpoint is a simple PK lookup
 * rather than a multi-point hypertable scan.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('price_changes_cache', (t) => {
    t.string('metric', 50).notNullable();
    t.string('region', 10).notNullable();
    t.float('current_price').nullable();
    t.float('week_ago_price').nullable();
    t.float('week_change_pct').nullable();
    t.float('month_ago_price').nullable();
    t.float('month_change_pct').nullable();
    t.float('three_month_ago_price').nullable();
    t.float('three_month_change_pct').nullable();
    t.float('year_ago_price').nullable();
    t.float('year_change_pct').nullable();
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.primary(['metric', 'region']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('price_changes_cache');
}
