import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Build a chainable mock that returns itself for all query-builder methods
function createChainableMock() {
  const chain: any = {
    select: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    whereIn: vi.fn(),
    orderBy: vi.fn(),
    insert: vi.fn(),
    onConflict: vi.fn(),
    ignore: vi.fn().mockResolvedValue(undefined),
    merge: vi.fn().mockResolvedValue(undefined),
    first: vi.fn().mockResolvedValue(undefined),
    limit: vi.fn(),
  };
  // Every method returns the chain itself (fluent API)
  for (const key of Object.keys(chain)) {
    if (key !== 'ignore' && key !== 'merge' && key !== 'first') {
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
import {
  upsertNationalAverages,
  getRecentNationalAverages,
  getAaaNationalChanges,
  upsertStateAggregates,
  getStateAggregatesForDate,
  getAaaStateLatest,
  getAaaStateHistory,
  getAaaStateChanges,
  getAllAaaStatesLatest,
  upsertPaddAggregates,
  getAaaPaddLatest,
  getAaaPaddHistory,
  getAllAaaPaddLatest,
  type AaaNationalAverageRow,
  type AaaStateAggregateRow,
  type AaaPaddAggregateRow,
} from '../queries/aaa';
import {
  upsertRefineryData,
  getUtilizationByRegion,
  getProductionData,
  getInventoryData,
  getSupplyHealth,
  getFlowData,
  getCapacityData,
  upsertCapacityData,
  type RefineryOperationsRow,
  type CapacityRow,
} from '../queries/supply';

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

describe('aaa queries', () => {
  beforeEach(() => {
    chain = createChainableMock();
    mockKnexInstance.mockReturnValue(chain);
    vi.clearAllMocks();
    chain = createChainableMock();
    mockKnexInstance.mockReturnValue(chain);
  });

  describe('upsertNationalAverages', () => {
    it('does nothing for empty array', async () => {
      await upsertNationalAverages([]);
      expect(mockKnexInstance).not.toHaveBeenCalled();
    });

    it('inserts and merges rows into aaa_national_averages', async () => {
      const row: AaaNationalAverageRow = {
        time: new Date('2026-03-20'),
        regular: 3.45, mid_grade: 3.65, premium: 3.95, diesel: 3.80,
        state_count: 48,
      };
      await upsertNationalAverages([row]);
      expect(mockKnexInstance).toHaveBeenCalledWith('aaa_national_averages');
      expect(chain.insert).toHaveBeenCalledWith(row);
      expect(chain.onConflict).toHaveBeenCalledWith(['time']);
      expect(chain.merge).toHaveBeenCalled();
    });
  });

  describe('getRecentNationalAverages', () => {
    it('queries aaa_national_averages with default limit', async () => {
      chain.select.mockResolvedValueOnce([]);
      await getRecentNationalAverages();
      expect(mockKnexInstance).toHaveBeenCalledWith('aaa_national_averages');
      expect(chain.orderBy).toHaveBeenCalledWith('time', 'desc');
      expect(chain.limit).toHaveBeenCalledWith(90);
    });

    it('accepts a custom limit', async () => {
      chain.select.mockResolvedValueOnce([]);
      await getRecentNationalAverages(30);
      expect(chain.limit).toHaveBeenCalledWith(30);
    });
  });

  describe('getAaaNationalChanges', () => {
    it('calls knex.raw and returns rows', async () => {
      const mockRows = [{ grade: 'regular', current_price: 3.45, as_of: new Date() }];
      mockRaw.mockResolvedValueOnce({ rows: mockRows });
      const result = await getAaaNationalChanges();
      expect(mockRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRows);
    });
  });

  describe('upsertStateAggregates', () => {
    it('does nothing for empty array', async () => {
      await upsertStateAggregates([]);
      expect(mockKnexInstance).not.toHaveBeenCalled();
    });

    it('inserts rows into aaa_state_aggregates', async () => {
      const row: AaaStateAggregateRow = {
        time: new Date(), state: 'CO',
        regular: 3.50, mid_grade: null, premium: null, diesel: null,
      };
      await upsertStateAggregates([row]);
      expect(mockKnexInstance).toHaveBeenCalledWith('aaa_state_aggregates');
      expect(chain.onConflict).toHaveBeenCalledWith(['time', 'state']);
      expect(chain.merge).toHaveBeenCalled();
    });
  });

  describe('getStateAggregatesForDate', () => {
    it('queries aaa_state_aggregates by date range', async () => {
      chain.orderBy.mockResolvedValueOnce([]);
      await getStateAggregatesForDate(new Date('2026-03-20'));
      expect(mockKnexInstance).toHaveBeenCalledWith('aaa_state_aggregates');
      expect(chain.where).toHaveBeenCalledWith('time', '>=', expect.any(Date));
      expect(chain.andWhere).toHaveBeenCalledWith('time', '<', expect.any(Date));
    });
  });

  describe('getAaaStateLatest', () => {
    it('returns null when no row found', async () => {
      chain.first.mockResolvedValueOnce(undefined);
      const result = await getAaaStateLatest('CO');
      expect(result).toBeNull();
      expect(mockKnexInstance).toHaveBeenCalledWith('aaa_state_aggregates');
    });

    it('returns the row when found', async () => {
      const row: AaaStateAggregateRow = {
        time: new Date(), state: 'CO',
        regular: 3.50, mid_grade: null, premium: null, diesel: null,
      };
      chain.first.mockResolvedValueOnce(row);
      const result = await getAaaStateLatest('CO');
      expect(result).toEqual(row);
    });

    it('converts state to uppercase', async () => {
      chain.first.mockResolvedValueOnce(undefined);
      await getAaaStateLatest('co');
      expect(chain.where).toHaveBeenCalledWith('state', 'CO');
    });
  });

  describe('getAaaStateHistory', () => {
    it('queries with uppercase state and default limit', async () => {
      chain.select.mockResolvedValueOnce([]);
      await getAaaStateHistory('TX');
      expect(mockKnexInstance).toHaveBeenCalledWith('aaa_state_aggregates');
      expect(chain.where).toHaveBeenCalledWith('state', 'TX');
      expect(chain.limit).toHaveBeenCalledWith(90);
    });

    it('converts state to uppercase and applies custom limit', async () => {
      chain.select.mockResolvedValueOnce([]);
      await getAaaStateHistory('tx', 30);
      expect(chain.where).toHaveBeenCalledWith('state', 'TX');
      expect(chain.limit).toHaveBeenCalledWith(30);
    });
  });

  describe('getAaaStateChanges', () => {
    it('queries aaa_state_changes_cache with uppercase state', async () => {
      chain.orderBy.mockResolvedValueOnce([]);
      await getAaaStateChanges('co');
      expect(mockKnexInstance).toHaveBeenCalledWith('aaa_state_changes_cache');
      expect(chain.where).toHaveBeenCalledWith('state', 'CO');
    });
  });

  describe('getAllAaaStatesLatest', () => {
    it('calls knex.raw with DISTINCT ON query over aaa_state_aggregates', async () => {
      const mockRows = [{ state: 'CO', regular: 3.50, time: new Date() }];
      mockRaw.mockResolvedValueOnce({ rows: mockRows });
      const result = await getAllAaaStatesLatest();
      expect(mockRaw).toHaveBeenCalledTimes(1);
      const sql: string = mockRaw.mock.calls[0][0];
      expect(sql).toContain('aaa_state_aggregates');
      expect(result).toEqual(mockRows);
    });
  });

  describe('upsertPaddAggregates', () => {
    it('does nothing for empty array', async () => {
      await upsertPaddAggregates([]);
      expect(mockKnexInstance).not.toHaveBeenCalled();
    });

    it('inserts rows into aaa_padd_aggregates', async () => {
      const row: AaaPaddAggregateRow = {
        time: new Date(), padd: 'R10',
        regular_mean: 3.50, mid_grade_mean: null, premium_mean: null, diesel_mean: null,
        regular_wtd: null, mid_grade_wtd: null, premium_wtd: null, diesel_wtd: null,
        state_count: 10,
      };
      await upsertPaddAggregates([row]);
      expect(mockKnexInstance).toHaveBeenCalledWith('aaa_padd_aggregates');
      expect(chain.onConflict).toHaveBeenCalledWith(['time', 'padd']);
      expect(chain.merge).toHaveBeenCalled();
    });
  });

  describe('getAaaPaddLatest', () => {
    it('returns null when no row found', async () => {
      chain.first.mockResolvedValueOnce(undefined);
      const result = await getAaaPaddLatest('R10');
      expect(result).toBeNull();
    });

    it('returns the row when found', async () => {
      const row: AaaPaddAggregateRow = {
        time: new Date(), padd: 'R10',
        regular_mean: 3.50, mid_grade_mean: null, premium_mean: null, diesel_mean: null,
        regular_wtd: null, mid_grade_wtd: null, premium_wtd: null, diesel_wtd: null,
        state_count: 10,
      };
      chain.first.mockResolvedValueOnce(row);
      const result = await getAaaPaddLatest('R10');
      expect(result).toEqual(row);
    });

    it('converts padd to uppercase', async () => {
      chain.first.mockResolvedValueOnce(undefined);
      await getAaaPaddLatest('r10');
      expect(chain.where).toHaveBeenCalledWith('padd', 'R10');
    });
  });

  describe('getAaaPaddHistory', () => {
    it('queries aaa_padd_aggregates with padd and default limit', async () => {
      chain.select.mockResolvedValueOnce([]);
      await getAaaPaddHistory('R20');
      expect(mockKnexInstance).toHaveBeenCalledWith('aaa_padd_aggregates');
      expect(chain.where).toHaveBeenCalledWith('padd', 'R20');
      expect(chain.limit).toHaveBeenCalledWith(90);
    });

    it('applies custom limit', async () => {
      chain.select.mockResolvedValueOnce([]);
      await getAaaPaddHistory('R30', 30);
      expect(chain.limit).toHaveBeenCalledWith(30);
    });
  });

  describe('getAllAaaPaddLatest', () => {
    it('calls knex.raw with DISTINCT ON query over aaa_padd_aggregates', async () => {
      const mockRows = [{ padd: 'R10', regular_mean: 3.50 }];
      mockRaw.mockResolvedValueOnce({ rows: mockRows });
      const result = await getAllAaaPaddLatest();
      expect(mockRaw).toHaveBeenCalledTimes(1);
      const sql: string = mockRaw.mock.calls[0][0];
      expect(sql).toContain('aaa_padd_aggregates');
      expect(result).toEqual(mockRows);
    });
  });
});

describe('supply queries', () => {
  beforeEach(() => {
    chain = createChainableMock();
    mockKnexInstance.mockReturnValue(chain);
    vi.clearAllMocks();
    chain = createChainableMock();
    mockKnexInstance.mockReturnValue(chain);
  });

  describe('upsertRefineryData', () => {
    it('does nothing for empty array', async () => {
      await upsertRefineryData([]);
      expect(mockKnexInstance).not.toHaveBeenCalled();
    });

    it('inserts rows into refinery_operations using onConflict/merge', async () => {
      const row: RefineryOperationsRow = {
        time: new Date(), region: 'US',
        utilization_pct: 92.5, crude_inputs: 15000, gasoline_production: 9500,
        distillate_production: 4500, gasoline_stocks: 220000, distillate_stocks: 115000,
        operable_capacity: 18000, gasoline_imports: 500, distillate_imports: 200,
        crude_imports: 6000, total_exports: 3000,
        product_supplied_gas: 9000, product_supplied_dist: 4000,
      };
      await upsertRefineryData([row]);
      expect(mockKnexInstance).toHaveBeenCalledWith('refinery_operations');
      expect(chain.onConflict).toHaveBeenCalledWith(['time', 'region']);
      expect(chain.merge).toHaveBeenCalled();
    });

    it('chunks large row sets', async () => {
      const rows: RefineryOperationsRow[] = Array.from({ length: 250 }, (_, i) => ({
        time: new Date(2024, 0, i + 1), region: 'US',
        utilization_pct: 90, crude_inputs: null, gasoline_production: null,
        distillate_production: null, gasoline_stocks: null, distillate_stocks: null,
        operable_capacity: null, gasoline_imports: null, distillate_imports: null,
        crude_imports: null, total_exports: null,
        product_supplied_gas: null, product_supplied_dist: null,
      }));
      await upsertRefineryData(rows);
      // 250 rows with CHUNK=200 → 2 inserts
      expect(chain.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUtilizationByRegion', () => {
    it('calls knex.raw and returns rows', async () => {
      const mockRows = [{ region: 'US', utilization_pct: 92 }];
      mockRaw.mockResolvedValueOnce({ rows: mockRows });
      const result = await getUtilizationByRegion();
      expect(mockRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRows);
    });

    it('passes region parameter to raw query', async () => {
      mockRaw.mockResolvedValueOnce({ rows: [] });
      await getUtilizationByRegion('R30');
      expect(mockRaw).toHaveBeenCalledTimes(1);
      const args = mockRaw.mock.calls[0];
      // With region, the query uses parameterized bindings
      expect(args[1]).toContain('R30');
    });
  });

  describe('getProductionData', () => {
    it('calls knex.raw and returns rows', async () => {
      const mockRows = [{ time: new Date(), region: 'US', gasoline_production: 9500 }];
      mockRaw.mockResolvedValueOnce({ rows: mockRows });
      const result = await getProductionData();
      expect(mockRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRows);
    });

    it('passes region and weeks params', async () => {
      mockRaw.mockResolvedValueOnce({ rows: [] });
      await getProductionData('R30', 26);
      const args = mockRaw.mock.calls[0];
      expect(args[1]).toContain('R30');
    });
  });

  describe('getInventoryData', () => {
    it('calls knex.raw and returns rows', async () => {
      mockRaw.mockResolvedValueOnce({ rows: [] });
      const result = await getInventoryData();
      expect(mockRaw).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSupplyHealth', () => {
    it('calls knex.raw and returns rows', async () => {
      mockRaw.mockResolvedValueOnce({ rows: [] });
      const result = await getSupplyHealth();
      expect(mockRaw).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getFlowData', () => {
    it('calls knex.raw and returns rows', async () => {
      mockRaw.mockResolvedValueOnce({ rows: [] });
      const result = await getFlowData();
      expect(mockRaw).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
    });

    it('passes region and weeks params', async () => {
      mockRaw.mockResolvedValueOnce({ rows: [] });
      await getFlowData('R10', 26);
      const args = mockRaw.mock.calls[0];
      expect(args[1]).toContain('R10');
    });
  });

  describe('getCapacityData', () => {
    it('queries refinery_capacity table when year is provided', async () => {
      chain.orderBy.mockResolvedValueOnce([]);
      await getCapacityData(2024);
      expect(mockKnexInstance).toHaveBeenCalledWith('refinery_capacity');
      expect(chain.where).toHaveBeenCalledWith({ year: 2024 });
    });

    it('calls knex.raw when no year is provided', async () => {
      mockRaw.mockResolvedValueOnce({ rows: [] });
      const result = await getCapacityData();
      expect(mockRaw).toHaveBeenCalledTimes(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('upsertCapacityData', () => {
    it('does nothing for empty array', async () => {
      await upsertCapacityData([]);
      expect(mockKnexInstance).not.toHaveBeenCalled();
    });

    it('inserts rows into refinery_capacity using onConflict/merge', async () => {
      const row: CapacityRow = {
        year: 2024, region: 'US',
        operable_capacity: 18000, operating_capacity: 17500,
        idle_capacity: 500, shutdown_capacity: 0,
      };
      await upsertCapacityData([row]);
      expect(mockKnexInstance).toHaveBeenCalledWith('refinery_capacity');
      expect(chain.onConflict).toHaveBeenCalledWith(['year', 'region']);
      expect(chain.merge).toHaveBeenCalled();
    });
  });
});
