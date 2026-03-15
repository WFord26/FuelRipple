import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createMockRequest, createMockResponse, createMockNext } from './test-utils';
import { AppError, errorHandler } from '../middleware/errorHandler';

describe('AppError', () => {
  it('creates error with status code', () => {
    const error = new AppError('Not found', 404);

    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('captures stack trace', () => {
    const error = new AppError('test', 500);
    expect(error.stack).toBeDefined();
  });
});

describe('errorHandler middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  it('handles AppError with correct status code', () => {
    const error = new AppError('Resource not found', 404);

    errorHandler(error, req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.data).toEqual({
      status: 'error',
      message: 'Resource not found',
    });
  });

  it('handles AppError with 400 status', () => {
    const error = new AppError('Invalid input', 400);

    errorHandler(error, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.data.message).toBe('Invalid input');
  });

  it('handles AppError with 503 status', () => {
    const error = new AppError('Service unavailable', 503);

    errorHandler(error, req, res, next);

    expect(res.statusCode).toBe(503);
  });

  it('handles generic Error with 500 status', () => {
    const error = new Error('Something unexpected happened');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(error, req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.data).toEqual({
      status: 'error',
      message: 'Internal server error',
    });

    consoleSpy.mockRestore();
  });

  it('logs unexpected errors', () => {
    const error = new Error('Unexpected');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(error, req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith('Unexpected error:', error);

    consoleSpy.mockRestore();
  });

  it('does not expose generic error messages', () => {
    const error = new Error('sensitive database details');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(error, req, res, next);

    expect(res.data.message).toBe('Internal server error');
    expect(res.data.message).not.toContain('sensitive');

    consoleSpy.mockRestore();
  });
});
