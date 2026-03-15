import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';

/**
 * Module-level mocks — must be called before importing the app.
 *
 * We mock every side-effect-producing dependency so the Express
 * server can boot without a real DB, Redis, or BullMQ connection.
 */

// 1. Mock @fuelripple/db — all query functions resolve with sensible defaults
jest.mock('@fuelripple/db', () => ({
  getKnex: jest.fn(),
  getCurrentPrices: jest.fn().mockImplementation(() => Promise.resolve([
    { region: 'NUS', value: 3.45, time: new Date().toISOString() },
  ])),
  getHistoricalPrices: jest.fn().mockImplementation(() => Promise.resolve([])),
  getPriceStats: jest.fn().mockImplementation(() => Promise.resolve({
    avg_price: 3.50, min_price: 3.00, max_price: 4.00, stddev_price: 0.25, sample_count: 52,
  })),
  getWeeklyChanges: jest.fn().mockImplementation(() => Promise.resolve([
    { week: '2026-03-10', avg_price: 3.50, prev_price: 3.45, pct_change: 0.0145 },
    { week: '2026-03-03', avg_price: 3.45, prev_price: 3.40, pct_change: 0.0147 },
    { week: '2026-02-24', avg_price: 3.40, prev_price: 3.38, pct_change: 0.0059 },
  ])),
  getPriceChanges: jest.fn().mockImplementation(() => Promise.resolve({
    current_price: '3.50', current_time: new Date().toISOString(),
    week_ago_price: '3.45', month_ago_price: '3.30',
    three_month_ago_price: '3.20', year_ago_price: '3.10',
    week_change_pct: '1.45', month_change_pct: '6.06',
    three_month_change_pct: '9.38', year_change_pct: '12.90',
  })),
  getCorrelationSeries: jest.fn().mockImplementation(() => Promise.resolve(
    Array.from({ length: 20 }, (_, i) => ({
      week: new Date(2026, 0, 7 * (i + 1)).toISOString(),
      gas_value: 3.0 + i * 0.05,
      crude_value: 70 + i,
    }))
  )),
  getEvents: jest.fn().mockImplementation(() => Promise.resolve([
    { id: 1, event_date: '2026-01-15', category: 'opec', title: 'OPEC Cut', impact: 'bullish' },
  ])),
  getIndicators: jest.fn().mockImplementation(() => Promise.resolve([
    { time: new Date().toISOString(), indicator: 'cpi', value: 312.5, source: 'fred' },
  ])),
  getLatestIndicator: jest.fn().mockImplementation(() => Promise.resolve(null)),
  insertPrices: jest.fn().mockImplementation(() => Promise.resolve()),
  insertEvents: jest.fn().mockImplementation(() => Promise.resolve()),
  insertIndicators: jest.fn().mockImplementation(() => Promise.resolve()),
  getUtilizationByRegion: jest.fn().mockImplementation(() => Promise.resolve([])),
  getProductionData: jest.fn().mockImplementation(() => Promise.resolve([])),
  getInventoryData: jest.fn().mockImplementation(() => Promise.resolve([])),
  getSupplyHealth: jest.fn().mockImplementation(() => Promise.resolve([])),
  getFlowData: jest.fn().mockImplementation(() => Promise.resolve([])),
  getCapacityData: jest.fn().mockImplementation(() => Promise.resolve([])),
  upsertRefineryData: jest.fn().mockImplementation(() => Promise.resolve()),
  upsertCapacityData: jest.fn().mockImplementation(() => Promise.resolve()),
  refreshMaterializedViews: jest.fn().mockImplementation(() => Promise.resolve()),
}));

// 2. Mock cache service — always miss (pass through to DB mock)
jest.mock('../services/cache', () => ({
  initializeCache: jest.fn(),
  getFromCache: jest.fn().mockImplementation(() => Promise.resolve(null)),
  setInCache: jest.fn().mockImplementation(() => Promise.resolve()),
  clearCache: jest.fn().mockImplementation(() => Promise.resolve()),
  cacheOrFetch: jest.fn().mockImplementation((...args: unknown[]) => (args[1] as Function)()),
}));

// 3. Mock job queue — no-op initializer, no BullMQ connection needed
jest.mock('../services/jobQueue', () => ({
  initializeJobQueue: jest.fn(),
  dataQueue: null,
}));

import request from 'supertest';
import app from '../index';

describe('Health endpoint', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });
});

describe('Prices endpoints', () => {
  it('GET /api/v1/prices/current returns price data', async () => {
    const res = await request(app).get('/api/v1/prices/current');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/v1/prices/current accepts metric param', async () => {
    const res = await request(app).get('/api/v1/prices/current?metric=diesel');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('GET /api/v1/prices/history returns data', async () => {
    const res = await request(app).get('/api/v1/prices/history');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('GET /api/v1/prices/stats/:metric/:region returns stats', async () => {
    const res = await request(app).get('/api/v1/prices/stats/gas_regular/NUS');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('avg_price');
  });

  it('GET /api/v1/prices/changes returns change data', async () => {
    const res = await request(app).get('/api/v1/prices/changes');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('Disruption endpoints', () => {
  it('GET /api/v1/disruption/score returns disruption score', async () => {
    const res = await request(app).get('/api/v1/disruption/score');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('score');
    expect(res.body.data).toHaveProperty('classification');
  });

  it('GET /api/v1/disruption/volatility returns volatility data', async () => {
    const res = await request(app).get('/api/v1/disruption/volatility');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('annualizedVolatility');
    expect(res.body.data).toHaveProperty('classification');
  });
});

describe('Impact endpoints', () => {
  it('POST /api/v1/impact/fuel-cost calculates cost', async () => {
    const res = await request(app)
      .post('/api/v1/impact/fuel-cost')
      .send({ currentGasPrice: 3.50 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('annualFuelCost');
    expect(res.body.data).toHaveProperty('annualGallons');
  });

  it('POST /api/v1/impact/fuel-cost rejects invalid input', async () => {
    const res = await request(app)
      .post('/api/v1/impact/fuel-cost')
      .send({ currentGasPrice: -1 });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  it('GET /api/v1/impact/fuel-cost/typical returns household impact', async () => {
    const res = await request(app).get('/api/v1/impact/fuel-cost/typical');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('annualCost');
    expect(res.body.data).toHaveProperty('costPerDollar');
  });
});

describe('Correlation endpoints', () => {
  it('GET /api/v1/correlation/crude-gas returns correlation data', async () => {
    const res = await request(app).get('/api/v1/correlation/crude-gas');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('crossCorrelation');
    expect(res.body.data).toHaveProperty('optimalLag');
  });

  it('GET /api/v1/correlation/rockets-feathers returns asymmetry analysis', async () => {
    const res = await request(app).get('/api/v1/correlation/rockets-feathers');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('avgIncreaseSpeed');
    expect(res.body.data).toHaveProperty('asymmetryRatio');
  });

  it('GET /api/v1/correlation/price-series returns time-series data', async () => {
    const res = await request(app).get('/api/v1/correlation/price-series');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('Events endpoints', () => {
  it('GET /api/v1/events returns events list', async () => {
    const res = await request(app).get('/api/v1/events');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('count');
  });
});

describe('404 handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nonexistent');

    expect(res.status).toBe(404);
  });
});
