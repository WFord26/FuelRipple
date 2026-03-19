import { getKnex } from '../index';

export interface AaaNationalAverageRow {
  time: Date;
  regular: number | null;
  mid_grade: number | null;
  premium: number | null;
  diesel: number | null;
  /** Number of states that contributed a valid regular price that day */
  state_count: number;
}

/**
 * Upsert one or more daily nationwide average rows.
 * ON CONFLICT on `time` (the primary key) updates all price columns
 * so a re-run of the daily job is always idempotent.
 */
export async function upsertNationalAverages(
  rows: AaaNationalAverageRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const knex = getKnex();

  for (const row of rows) {
    await knex('aaa_national_averages')
      .insert(row)
      .onConflict(['time'])
      .merge(['regular', 'mid_grade', 'premium', 'diesel', 'state_count']);
  }
}

/**
 * Retrieve recent national average rows, newest first.
 */
export async function getRecentNationalAverages(
  limit = 90
): Promise<AaaNationalAverageRow[]> {
  const knex = getKnex();
  return knex('aaa_national_averages')
    .orderBy('time', 'desc')
    .limit(limit)
    .select<AaaNationalAverageRow[]>('*');
}

/**
 * Row type for AAA state-level aggregates
 */
export interface AaaStateAggregateRow {
  time: Date;
  state: string;
  regular: number | null;
  mid_grade: number | null;
  premium: number | null;
  diesel: number | null;
}

/**
 * Upsert state-level AAA price aggregates.
 * Replaces raw per-region energy_prices queries for faster state-level access.
 */
export async function upsertStateAggregates(
  rows: AaaStateAggregateRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const knex = getKnex();

  const sorted = [...rows].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
  const CHUNK = 100;

  for (let i = 0; i < sorted.length; i += CHUNK) {
    const chunk = sorted.slice(i, i + CHUNK);
    await knex('aaa_state_aggregates')
      .insert(chunk)
      .onConflict(['time', 'state'])
      .merge(['regular', 'mid_grade', 'premium', 'diesel']);
  }
}

/**
 * Get state aggregates for a specific date.
 * Used to build regional PADD aggregates and for state-level exports.
 */
export async function getStateAggregatesForDate(date: Date): Promise<AaaStateAggregateRow[]> {
  const knex = getKnex();
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return knex('aaa_state_aggregates')
    .where('time', '>=', dayStart)
    .andWhere('time', '<', dayEnd)
    .select<AaaStateAggregateRow[]>('*')
    .orderBy('state', 'asc');
}
