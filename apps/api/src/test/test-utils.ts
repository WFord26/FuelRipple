import { jest } from '@jest/globals';
import request from 'supertest';

/**
 * Create an Express app test client
 * Used in integration tests for making HTTP requests to the API
 */
export const createTestClient = (app: any) => {
  return request(app);
};

/**
 * Mock delay utility for testing async operations
 */
export const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Create mock request object
 */
export const createMockRequest = (overrides = {}) => {
  return {
    headers: {},
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
};

/**
 * Create mock response object
 */
export const createMockResponse = () => {
  const res: any = {
    statusCode: 200,
    status: function (code: number) {
      this.statusCode = code;
      return this;
    },
    json: function (data: any) {
      this.data = data;
      return this;
    },
    send: function (data: any) {
      this.data = data;
      return this;
    },
  };
  return res;
};

/**
 * Create mock next function for middleware
 */
export const createMockNext = () => {
  const next = jest.fn();
  next.mockImplementation(() => {});
  return next;
};
