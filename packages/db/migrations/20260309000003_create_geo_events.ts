import { Knex } from 'knex';

/**
 * Migration: Create geo_events table for geopolitical event annotations
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('geo_events', (table) => {
    table.increments('id').primary();
    table.date('event_date').notNullable();
    table.text('category').notNullable();
    table.text('title').notNullable();
    table.text('description');
    table.text('impact');
    
    table.index('event_date', 'idx_geo_events_date');
    table.index('category', 'idx_geo_events_category');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('geo_events');
}
