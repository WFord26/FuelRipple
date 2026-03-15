import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Build a Knex connection config from DATABASE_URL.
 * The Node.js `pg` driver does not handle ?sslmode=require the same way as
 * libpq — it can cause SASL to receive an undefined password during the
 * handshake. Strip the ssl query param and supply ssl: { rejectUnauthorized }
 * explicitly instead.
 */
function buildConnection(url: string): Knex.StaticConnectionConfig {
  // Strip ?sslmode=... (and any other query params) so pg parses the URL cleanly
  const cleanUrl = url.split('?')[0];
  const isRemote = !cleanUrl.includes('localhost') && !cleanUrl.includes('127.0.0.1');
  return {
    connectionString: cleanUrl,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  } as unknown as Knex.StaticConnectionConfig;
}

const localFallback = {
  host: 'localhost',
  port: 5433,
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
  },
};

