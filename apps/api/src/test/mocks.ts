import { jest } from '@jest/globals';

import { jest } from '@jest/globals';

/**
 * Mock Express Request/Response utilities
 */
export const createMockExpressApp = () => {
  const app: any = {
    use: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    listen: jest.fn(),
  };
  return app;
};

/**
 * Mock database connection
 */
export const createMockDBConnection = () => {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
};

/**
 * Mock Redis client
 */
export const createMockRedisClient = () => {
  const cache = new Map();
  
  return {
    get: jest.fn().mockImplementation((key: string) =>
      Promise.resolve(cache.get(key))
    ),
    set: jest.fn().mockImplementation((key: string, value: any) => {
      cache.set(key, value);
      return Promise.resolve('OK');
    }),
    del: jest.fn().mockImplementation((key: string) => {
      cache.delete(key);
      return Promise.resolve(1);
    }),
    exists: jest.fn().mockImplementation((key: string) =>
      Promise.resolve(cache.has(key) ? 1 : 0)
    ),
    flushDir: jest.fn().mockResolvedValue('OK'),
  };
};

/**
 * Mock external API clients
 */
export const createMockEIAClient = () => {
  return {
    fetchPrices: jest.fn().mockResolvedValue([]),
    fetchSupply: jest.fn().mockResolvedValue([]),
    fetchCapacity: jest.fn().mockResolvedValue([]),
  };
};

export const createMockFREDClient = () => {
  return {
    fetchInflation: jest.fn().mockResolvedValue([]),
    fetchUnemployment: jest.fn().mockResolvedValue([]),
    fetchGDP: jest.fn().mockResolvedValue([]),
  };
};

/**
 * Mock cron job
 */
export const createMockCron = () => {
  return {
    schedule: jest.fn().mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
    }),
  };
};

/**
 * Mock job queue
 */
export const createMockJobQueue = () => {
  return {
    add: jest.fn().mockResolvedValue({ id: '1' }),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  };
};

/**
 * Mock logger
 */
export const createMockLogger = () => {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
};
