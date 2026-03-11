import { vi } from 'vitest';

/**
 * Mock factory for common API responses
 * Useful for testing API calls in components
 */
export const createMockApiClient = () => {
  return {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  };
};

/**
 * Mock fetch responses
 */
export const mockFetchSuccess = (data: any) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
};

export const mockFetchError = (status: number, error: any) => {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(error),
  });
};

/**
 * Mock localStorage
 */
export const createMockLocalStorage = () => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

/**
 * Mock timers
 */
export const createMockTimer = () => {
  return {
    advance: (ms: number) => vi.advanceTimersByTime(ms),
    runAll: () => vi.runAllTimers(),
    setSeed: (seed: number) => vi.setSystemTime(seed),
  };
};

/**
 * Wait for promises and updates
 */
export const waitForAsync = () =>
  new Promise(resolve => setTimeout(resolve, 0));

/**
 * Mock console methods
 */
export const createMockConsole = () => {
  return {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };
};
