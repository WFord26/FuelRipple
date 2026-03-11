import { getKnex } from '../index';
import { EconomicIndicator } from '@fuelripple/shared';

/**
 * Insert economic indicators
 */
export async function insertIndicators(indicators: EconomicIndicator[]): Promise<void> {
  const knex = getKnex();
  
  await knex('economic_indicators')
    .insert(indicators)
    .onConflict(['time', 'indicator', 'source'])
    .ignore();
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
