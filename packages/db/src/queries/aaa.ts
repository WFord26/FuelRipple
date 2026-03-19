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
