import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Build a chainable mock that returns itself for all query-builder methods
function createChainableMock() {
  const chain: any = {
    select: vi.fn(),
    where: vi.fn(),
    whereIn: vi.fn(),
    orderBy: vi.fn(),
    insert: vi.fn(),
    onConflict: vi.fn(),
    ignore: vi.fn().mockResolvedValue(undefined),
    first: vi.fn().mockResolvedValue(undefined),
    limit: vi.fn(),
  };
  // Every method returns the chain itself (fluent API)
  for (const key of Object.keys(chain)) {
    if (key !== 'ignore' && key !== 'first') {
      chain[key].mockReturnValue(chain);
    }
  }
  return chain;
}

let chain: ReturnType<typeof createChainableMock>;
const mockRaw = vi.fn();

const mockKnexInstance = Object.assign(
  vi.fn(() => chain),
  { raw: mockRaw }
);

vi.mock('../index', () => ({
  getKnex: () => mockKnexInstance,
}));

import { getCurrentPrices, insertPrices, getHistoricalPrices } from '../queries/prices';
import { getEvents } from '../queries/events';
import { getIndicators } from '../queries/indicators';

describe('prices queries', () => {
  beforeEach(() => {
    chain = createChainableMock();
    mockKnexInstance.mockReturnValue(chain);
    vi.clearAllMocks();
    // Re-create chain after clearAllMocks
    chain = createChainableMock();
    mockKnexInstance.mockReturnValue(chain);
  });

  describe('getCurrentPrices', () => {
    it('executes raw SQL with metric parameter', async () => {
      mockRaw.mockResolvedValueOnce({ rows: [{ region: 'NUS', value: 3.45, time: new Date() }] });

      const result = await getCurrentPrices('gas_regular');

      expect(mockRaw).toHaveBeenCalledTimes(1);
      const [sql, params] = mockRaw.mock.calls[0];
      expect(sql).toContain('energy_prices');
      expect(params).toContain('gas_regular');
      expect(result).toHaveLength(1);
      expect(result[0].region).toBe('NUS');
    });
  });

  describe('insertPrices', () => {
    it('does nothing for empty array', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await insertPrices([]);
      expect(mockKnexInstance).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('calls knex insert with onConflict ignore', async () => {
      const prices = [
        {
          time: new Date(),
          source: 'eia' as const,
          metric: 'gas_regular' as const,
          region: 'NUS',
          value: 3.45,
          unit: 'usd_per_gallon' as const,
        },
      ];

      await insertPrices(prices);

      expect(mockKnexInstance).toHaveBeenCalledWith('energy_prices');
      expect(chain.insert).toHaveBeenCalledWith(prices);
      expect(chain.onConflict).toHaveBeenCalledWith(['time', 'source', 'metric', 'region']);
      expect(chain.ignore).toHaveBeenCalled();
    });
  });

  describe('getHistoricalPrices', () => {
    it('uses weekly_prices table by default', async () => {
      chain.orderBy.mockResolvedValueOnce([]);

      await getHistoricalPrices({});

      expect(mockKnexInstance).toHaveBeenCalledWith('weekly_prices');
    });

    it('uses daily_prices table for daily granularity', async () => {
      chain.orderBy.mockResolvedValueOnce([]);

      await getHistoricalPrices({ granularity: 'daily' });

      expect(mockKnexInstance).toHaveBeenCalledWith('daily_prices');
    });

    it('uses monthly_prices table for monthly granularity', async () => {
      chain.orderBy.mockResolvedValueOnce([]);

      await getHistoricalPrices({ granularity: 'monthly' });

      expect(mockKnexInstance).toHaveBeenCalledWith('monthly_prices');
    });

    it('applies metric filter when provided', async () => {
      // Make the terminal where call resolve the promise chain
      chain.where.mockReturnValue(chain);
      // After all chaining, orderBy should resolve
      chain.orderBy.mockReturnValue(chain);
      // The final call is the implicit Promise resolution — set it up
      (chain as any).then = vi.fn((resolve: Function) => resolve([]));

      await getHistoricalPrices({ metric: 'crude_wti' });

      expect(chain.where).toHaveBeenCalledWith({ metric: 'crude_wti' });
    });
  });
});

describe('events queries', () => {
  beforeEach(() => {
    chain = createChainableMock();
    mockKnexInstance.mockReturnValue(chain);
  });

  describe('getEvents', () => {
    it('queries geo_events table', async () => {
      chain.orderBy.mockResolvedValueOnce([{ id: 1, title: 'Test Event' }]);

      const result = await getEvents();

      expect(mockKnexInstance).toHaveBeenCalledWith('geo_events');
    });
  });
});

describe('indicators queries', () => {
  beforeEach(() => {
    chain = createChainableMock();
    mockKnexInstance.mockReturnValue(chain);
  });

  describe('getIndicators', () => {
    it('queries economic_indicators table with indicator filter', async () => {
      // getIndicators chains: .select('*').where({ indicator }).orderBy('time', 'desc')
      // then conditionally .where('time', '>=', startDate)
      // The whole chain is returned as a thenable
      chain.orderBy.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      (chain as any).then = vi.fn((resolve: Function) => resolve([{ time: new Date(), indicator: 'cpi', value: 312.5 }]));

      const result = await getIndicators('cpi', new Date('2025-01-01'));

      expect(mockKnexInstance).toHaveBeenCalledWith('economic_indicators');
      expect(chain.where).toHaveBeenCalledWith({ indicator: 'cpi' });
    });
  });
});
