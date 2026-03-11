/**
 * Global test constants and utilities
 */

export const TEST_TIMEOUT = 10000;
export const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Mock data for testing
 */
export const MOCK_DATA = {
  user: {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
  },
  price: {
    id: '1',
    value: 3.45,
    region: 'US',
    date: new Date('2024-01-01'),
  },
  event: {
    id: '1',
    type: 'supply_disruption',
    severity: 5,
    date: new Date('2024-01-01'),
  },
};

/**
 * Helper to create a timestamp for testing
 */
export const createTestTimestamp = (daysAgo: number = 0): Date => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
};

/**
 * Helper to generate random ID
 */
export const generateTestId = (): string => {
  return `test_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Helper to validate JSON structure
 */
export const isValidJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};
