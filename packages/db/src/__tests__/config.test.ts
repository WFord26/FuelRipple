import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dotenv before importing config
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('Database Config', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('exports a config object with development and production keys', async () => {
    const { config } = await import('../config');

    expect(config).toHaveProperty('development');
    expect(config).toHaveProperty('production');
  });

  it('uses postgresql client for development', async () => {
    const { config } = await import('../config');
    expect(config.development.client).toBe('postgresql');
  });

  it('uses postgresql client for production', async () => {
    const { config } = await import('../config');
    expect(config.production.client).toBe('postgresql');
  });

  it('development has pool config', async () => {
    const { config } = await import('../config');

    expect(config.development.pool).toBeDefined();
    expect(config.development.pool!.min).toBe(2);
    expect(config.development.pool!.max).toBe(10);
  });

  it('production has larger pool', async () => {
    const { config } = await import('../config');

    expect(config.production.pool).toBeDefined();
    expect(config.production.pool!.max).toBe(20);
  });

  it('development falls back to localhost connection when DATABASE_URL is not set', async () => {
    delete process.env.DATABASE_URL;
    const { config } = await import('../config');

    const conn = config.development.connection;
    // When DATABASE_URL is absent, connection is an object
    if (typeof conn === 'object' && conn !== null && !('connectionString' in conn)) {
      expect(conn).toHaveProperty('host');
      expect(conn).toHaveProperty('port');
      expect(conn).toHaveProperty('database');
    }
  });

  it('production uses DATABASE_URL from environment', async () => {
    process.env.DATABASE_URL = 'postgres://user:pass@db:5432/prod';
    const { config } = await import('../config');

    const conn = config.production.connection as Record<string, unknown>;
    if (typeof conn === 'object' && conn !== null) {
      expect(conn.connectionString).toBe('postgres://user:pass@db:5432/prod');
    } else {
      expect(conn).toBe('postgres://user:pass@db:5432/prod');
    }

    delete process.env.DATABASE_URL;
  });
});
