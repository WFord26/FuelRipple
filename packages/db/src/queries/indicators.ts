import { getKnex } from '../index';
import { EconomicIndicator } from '@fuelripple/shared';

/**
 * Insert economic indicators with chunking.
 * Sorts by time to minimise hypertable partition locks per batch.
 */
export async function insertIndicators(indicators: EconomicIndicator[]): Promise<void> {
  if (indicators.length === 0) return;
  const knex = getKnex();
  const sorted = [...indicators].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );
  const CHUNK = 200;

  for (let i = 0; i < sorted.length; i += CHUNK) {
    const chunk = sorted.slice(i, i + CHUNK);
    await knex('economic_indicators')
      .insert(chunk)
      .onConflict(['time', 'indicator', 'source'])
      .ignore();
  }
}

/**
 * Get economic indicators for a date range
 */
export async function getIndicators(
  indicator: string,
  startDate?: Date,
  endDate?: Date
): Promise<EconomicIndicator[]> {
  const knex = getKnex();
  let query = knex('economic_indicators')
    .select('*')
    .where({ indicator })
    .orderBy('time', 'desc');
  
  if (startDate) query = query.where('time', '>=', startDate);
  if (endDate) query = query.where('time', '<=', endDate);
  
  return query;
}

/**
 * Get latest value for an indicator
 */
export async function getLatestIndicator(indicator: string): Promise<EconomicIndicator | null> {
  const knex = getKnex();
  
  return knex('economic_indicators')
    .select('*')
    .where({ indicator })
    .orderBy('time', 'desc')
    .first();
}
