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
    query: jest.fn().mockResolvedValue({ rows: [] as unknown[] }),
    release: jest.fn(),
  };
};

/**
 * Mock Redis client
 */
export const createMockRedisClient = () => {
  const cache = new Map<string, unknown>();

  return {
    get: jest.fn().mockImplementation((...args: unknown[]) =>
      Promise.resolve(cache.get(args[0] as string))
    ),
    set: jest.fn().mockImplementation((...args: unknown[]) => {
      cache.set(args[0] as string, args[1]);
      return Promise.resolve('OK' as unknown);
    }),
    del: jest.fn().mockImplementation((...args: unknown[]) => {
      cache.delete(args[0] as string);
      return Promise.resolve(1);
    }),
    exists: jest.fn().mockImplementation((...args: unknown[]) =>
      Promise.resolve(cache.has(args[0] as string) ? 1 : 0)
    ),
    flushAll: jest.fn().mockResolvedValue('OK' as unknown),
  };
};

/**
 * Mock external API clients
 */
export const createMockEIAClient = () => {
  return {
    fetchPrices: jest.fn().mockResolvedValue([] as unknown[]),
    fetchSupply: jest.fn().mockResolvedValue([] as unknown[]),
    fetchCapacity: jest.fn().mockResolvedValue([] as unknown[]),
  };
};

export const createMockFREDClient = () => {
  return {
    fetchInflation: jest.fn().mockResolvedValue([] as unknown[]),
    fetchUnemployment: jest.fn().mockResolvedValue([] as unknown[]),
    fetchGDP: jest.fn().mockResolvedValue([] as unknown[]),
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
    add: jest.fn().mockResolvedValue({ id: '1' } as unknown),
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
