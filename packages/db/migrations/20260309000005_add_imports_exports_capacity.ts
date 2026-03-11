import { Knex } from 'knex';

/**
 * Migration: Add petroleum flow columns to refinery_operations
 * and create annual refinery capacity table (EIA-820).
 *
 * New refinery_operations columns (all in thousand bbl/day unless noted):
 *   gasoline_imports      — finished gasoline imports (process IM0, product EPM0)
 *   distillate_imports    — distillate imports        (process IM0, product EPD0)
 *   crude_imports         — crude oil imports         (process IM0, product EPC0)
 *   total_exports         — total petroleum exports   (process EXP)
 *   product_supplied_gas  — gasoline product supplied (process VPP, product EPM0) — implied demand
 *   product_supplied_dist — distillate prod. supplied (process VPP, product EPD0)
 *
 * import_dependency_pct is computed at query time:
 *   gasoline_imports / product_supplied_gas * 100
 *
 * refinery_capacity (EIA Form 820 — Annual Refinery Report):
 *   operable_capacity     — total operable capacity (k bbl/cd = k bbl per calendar day)
 *   operating_capacity    — operating (online) capacity
 *   idle_capacity         — idle (shutdown for maintenance etc.)
 *   shutdown_capacity     — permanently shut down
 */
export async function up(knex: Knex): Promise<void> {
  // ── 1. Extend refinery_operations with flow columns ─────────────────────
  await knex.schema.alterTable('refinery_operations', (table) => {
    table.float('gasoline_imports').nullable().comment('k bbl/day, EIA WPSR process IM0 product EPM0');
    table.float('distillate_imports').nullable().comment('k bbl/day, EIA WPSR process IM0 product EPD0');
    table.float('crude_imports').nullable().comment('k bbl/day, EIA WPSR process IM0 product EPC0');
    table.float('total_exports').nullable().comment('k bbl/day, EIA WPSR process EXP');
    table.float('product_supplied_gas').nullable().comment('k bbl/day, implied gasoline demand (VPP EPM0)');
    table.float('product_supplied_dist').nullable().comment('k bbl/day, implied distillate demand (VPP EPD0)');
  });

  // ── 2. Annual refinery capacity (EIA-820) ────────────────────────────────
  await knex.schema.createTable('refinery_capacity', (table) => {
    table.integer('year').notNullable();
    table.string('region', 10).notNullable();
    table.float('operable_capacity').nullable().comment('k bbl/calendar day — total operable');
    table.float('operating_capacity').nullable().comment('k bbl/calendar day — currently operating');
    table.float('idle_capacity').nullable().comment('k bbl/calendar day — idle');
    table.float('shutdown_capacity').nullable().comment('k bbl/calendar day — shutdown');
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.primary(['year', 'region']);
  });

  console.log('✅ Migration 5: flow columns + refinery_capacity table created');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('refinery_operations', (table) => {
    table.dropColumn('gasoline_imports');
    table.dropColumn('distillate_imports');
    table.dropColumn('crude_imports');
    table.dropColumn('total_exports');
    table.dropColumn('product_supplied_gas');
    table.dropColumn('product_supplied_dist');
  });

  await knex.schema.dropTableIfExists('refinery_capacity');
}
