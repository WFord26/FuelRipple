import { Knex } from 'knex';

/**
 * Migration: Clear AAA seeded/averaged data
 *
 * Removes all seeded synthetic AAA data and intermediate aggregates
 * to ensure clean data sourced only from Wayback Machine backfill.
 * Aggregate tables will be repopulated by backfill scripts.
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🧹 Clearing AAA seeded and aggregated data...');

  // Truncate aggregate tables (these will be repopulated from backfill)
  await knex('aaa_national_averages').del();
  await knex('aaa_state_aggregates').del();
  
  // Clear PADD aggregates if table exists
  const paddExists = await knex.schema.hasTable('aaa_padd_aggregates');
  if (paddExists) {
    await knex('aaa_padd_aggregates').del();
  }

  console.log('✅ Cleared aaa_national_averages, aaa_state_aggregates, and aaa_padd_aggregates');
}

export async function down(knex: Knex): Promise<void> {
  // No rollback needed for data deletion
  console.log('⏮️  No rollback for data deletion');
}
