import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function buildConnection(url: string): object {
  const cleanUrl = url.split('?')[0];
  const isRemote = !cleanUrl.includes('localhost') && !cleanUrl.includes('127.0.0.1');
  return {
    connectionString: cleanUrl,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  };
}

const localFallback = {
  host: 'localhost',
  port: 5432,
  database: 'gastracker',
  user: 'dev_user',
  password: 'dev_password',
};

export const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL
      ? buildConnection(process.env.DATABASE_URL)
      : localFallback,
    pool: {
      min: 2,
      max: 10,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './seeds',
      extension: 'ts',
    },
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL
      ? buildConnection(process.env.DATABASE_URL)
      : undefined,
    pool: {
      min: 2,
      max: 20,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './migrations',
      extension: 'ts',
    },
  },
};

export default config;
