import type { Knex } from 'knex';

/**
 * AAA State Changes Cache
 *
 * Stores pre-computed week/month/3-month/year ago prices and percentage changes
 * for each state and fuel grade combination. Enables fast lookups for state-level
 * price history without scanning the main tables.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('aaa_state_changes_cache', (t) => {
    t.string('state', 2).notNullable();
    t.enum('grade', ['regular', 'mid_grade', 'premium', 'diesel'], {
      useNative: true,
      enumName: 'fuel_grade',
    }).notNullable();
    t.float('current_price').nullable();
    t.float('week_ago_price').nullable();
    t.float('week_change_pct').nullable();
    t.float('month_ago_price').nullable();
    t.float('month_change_pct').nullable();
    t.float('three_month_ago_price').nullable();
    t.float('three_month_change_pct').nullable();
    t.float('year_ago_price').nullable();
    t.float('year_change_pct').nullable();
    t.timestamp('as_of').nullable();
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.primary(['state', 'grade']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('aaa_state_changes_cache');
}
