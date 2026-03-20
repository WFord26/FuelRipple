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
export interface AaaNationalChangesRow {
  grade: 'regular' | 'mid_grade' | 'premium' | 'diesel';
  current_price: number | null;
  week_ago_price: number | null;
  week_change_pct: number | null;
  month_ago_price: number | null;
  month_change_pct: number | null;
  three_month_ago_price: number | null;
  three_month_change_pct: number | null;
  year_ago_price: number | null;
  year_change_pct: number | null;
  as_of: Date;
}

/**
 * Compute price changes for all 4 AAA grades by comparing today's national
 * average against snapshots from 7, 30, 90, and 365 days ago.
 * Runs a single SQL query and does the math in-database.
 */
export async function getAaaNationalChanges(): Promise<AaaNationalChangesRow[]> {
  const knex = getKnex();

  const result = await knex.raw(`
    WITH
      latest AS (
        SELECT * FROM aaa_national_averages ORDER BY time DESC LIMIT 1
      ),
      w7   AS (SELECT * FROM aaa_national_averages
                WHERE time >= (SELECT time FROM latest) - INTERVAL '7 days'
                  AND time <= (SELECT time FROM latest) - INTERVAL '6 days'
                ORDER BY time DESC LIMIT 1),
      w30  AS (SELECT * FROM aaa_national_averages
                WHERE time >= (SELECT time FROM latest) - INTERVAL '30 days'
                  AND time <= (SELECT time FROM latest) - INTERVAL '29 days'
                ORDER BY time DESC LIMIT 1),
      w90  AS (SELECT * FROM aaa_national_averages
                WHERE time >= (SELECT time FROM latest) - INTERVAL '90 days'
                  AND time <= (SELECT time FROM latest) - INTERVAL '89 days'
                ORDER BY time DESC LIMIT 1),
      w365 AS (SELECT * FROM aaa_national_averages
                WHERE time >= (SELECT time FROM latest) - INTERVAL '365 days'
                  AND time <= (SELECT time FROM latest) - INTERVAL '364 days'
                ORDER BY time DESC LIMIT 1)
    SELECT
      grade,
      latest_price                                                    AS current_price,
      p7                                                              AS week_ago_price,
      CASE WHEN p7   > 0 THEN ROUND(((latest_price - p7)   / p7   * 100)::numeric, 4) END AS week_change_pct,
      p30                                                             AS month_ago_price,
      CASE WHEN p30  > 0 THEN ROUND(((latest_price - p30)  / p30  * 100)::numeric, 4) END AS month_change_pct,
      p90                                                             AS three_month_ago_price,
      CASE WHEN p90  > 0 THEN ROUND(((latest_price - p90)  / p90  * 100)::numeric, 4) END AS three_month_change_pct,
      p365                                                            AS year_ago_price,
      CASE WHEN p365 > 0 THEN ROUND(((latest_price - p365) / p365 * 100)::numeric, 4) END AS year_change_pct,
      (SELECT time FROM latest)                                       AS as_of
    FROM (
      VALUES
        ('regular',   (SELECT regular  FROM latest), (SELECT regular  FROM w7),   (SELECT regular  FROM w30),  (SELECT regular  FROM w90),  (SELECT regular  FROM w365)),
        ('mid_grade', (SELECT mid_grade FROM latest), (SELECT mid_grade FROM w7),  (SELECT mid_grade FROM w30), (SELECT mid_grade FROM w90), (SELECT mid_grade FROM w365)),
        ('premium',   (SELECT premium  FROM latest), (SELECT premium  FROM w7),   (SELECT premium  FROM w30),  (SELECT premium  FROM w90),  (SELECT premium  FROM w365)),
        ('diesel',    (SELECT diesel   FROM latest), (SELECT diesel   FROM w7),   (SELECT diesel   FROM w30),  (SELECT diesel   FROM w90),  (SELECT diesel   FROM w365))
    ) AS t(grade, latest_price, p7, p30, p90, p365)
  `);

  return result.rows as AaaNationalChangesRow[];
}

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

/**
 * Get the most recent AAA state aggregate (single row, all grades).
 * Used for state detail page current prices.
 */
export async function getAaaStateLatest(state: string): Promise<AaaStateAggregateRow | null> {
  const knex = getKnex();
  const row = await knex('aaa_state_aggregates')
    .where('state', state.toUpperCase())
    .orderBy('time', 'desc')
    .first<AaaStateAggregateRow>();
  return row ?? null;
}

/**
 * Get recent AAA state price history, newest first.
 * Used for state detail page historical charts and comparisons.
 */
export async function getAaaStateHistory(
  state: string,
  limit = 90
): Promise<AaaStateAggregateRow[]> {
  const knex = getKnex();
  const upperState = state.toUpperCase();
  
  const result = await knex('aaa_state_aggregates')
    .where('state', upperState)
    .orderBy('time', 'desc')
    .limit(limit)
    .select<AaaStateAggregateRow[]>('*');

  return result;
}

/**
 * Row type for AAA state-level price changes (like national changes but scoped to state).
 */
export interface AaaStateChangesRow {
  grade: 'regular' | 'mid_grade' | 'premium' | 'diesel';
  current_price: number | null;
  week_ago_price: number | null;
  week_change_pct: number | null;
  month_ago_price: number | null;
  month_change_pct: number | null;
  three_month_ago_price: number | null;
  three_month_change_pct: number | null;
  year_ago_price: number | null;
  year_change_pct: number | null;
  as_of: Date;
}

/**
 * Compute price changes for all 4 AAA grades in a specific state by comparing
 * today's price against snapshots from 7, 30, 90, and 365 days ago.
 * Returns at most 4 rows (one per grade), with price deltas computed server-side.
 */
export async function getAaaStateChanges(state: string): Promise<AaaStateChangesRow[]> {
  const knex = getKnex();
  const upperState = state.toUpperCase();

  // Query the pre-computed cache table
  const result = await knex('aaa_state_changes_cache')
    .select(
      'grade',
      'current_price',
      'week_ago_price',
      'week_change_pct',
      'month_ago_price',
      'month_change_pct',
      'three_month_ago_price as three_month_ago_price',
      'three_month_change_pct',
      'year_ago_price',
      'year_change_pct',
      'as_of'
    )
    .where('state', upperState)
    .orderBy('grade');

  return result as AaaStateChangesRow[];
}

/**
 * Get the most recent AAA prices for all states (one row per state, all grades).
 * Used for the state prices comparison page.
 */
export async function getAllAaaStatesLatest(): Promise<AaaStateAggregateRow[]> {
  const knex = getKnex();

  return knex.raw(`
    SELECT DISTINCT ON (state)
      state, time, regular, mid_grade, premium, diesel
    FROM aaa_state_aggregates
    ORDER BY state, time DESC
  `).then((r: any) => r.rows);
}
