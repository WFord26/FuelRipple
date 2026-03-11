import { Knex } from 'knex';
import { config } from './config';

let knexInstance: Knex | null = null;

export function getKnex(): Knex {
  if (!knexInstance) {
    const environment = process.env.NODE_ENV || 'development';
    knexInstance = require('knex')(config[environment]);
  }
  return knexInstance!;
}

export async function closeConnection(): Promise<void> {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
  }
}

export * from './queries/prices';
export * from './queries/events';
export * from './queries/indicators';
export * from './queries/supply';
