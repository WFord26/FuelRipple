import { getKnex } from '../index';
import { GeoEvent } from '@fuelripple/shared';

/**
 * Insert geopolitical events
 */
export async function insertEvents(events: Omit<GeoEvent, 'id'>[]): Promise<void> {
  const knex = getKnex();
  await knex('geo_events').insert(events).onConflict().ignore();
}

/**
 * Get events for a date range
 */
export async function getEvents(
  startDate?: Date,
  endDate?: Date,
  categories?: string[]
): Promise<GeoEvent[]> {
  const knex = getKnex();
  let query = knex('geo_events').select('*').orderBy('event_date', 'desc');
  
  if (startDate) query = query.where('event_date', '>=', startDate);
  if (endDate) query = query.where('event_date', '<=', endDate);
  if (categories && categories.length > 0) {
    query = query.whereIn('category', categories);
  }
  
  return query;
}
