import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
  };
});

// Import after mock
import apiClient, {
  getCurrentPrices,
  getHistoricalPrices,
  getRegionalComparison,
  getDisruptionScore,
  getVolatility,
  calculateFuelCost,
  getTypicalImpact,
  getDownstreamImpact,
  getCrudeGasCorrelation,
  getRocketsAndFeathers,
  getPriceChanges,
  getCorrelationPriceSeries,
  getEvents,
  getSupplyHealth,
} from '../api/client';

describe('API client functions', () => {
  const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
  const mockPost = apiClient.post as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentPrices', () => {
    it('calls /prices/current with default metric', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [{ region: 'NUS', value: 3.45 }] } });

      const result = await getCurrentPrices();

      expect(mockGet).toHaveBeenCalledWith('/prices/current', { params: { metric: 'gas_regular' } });
      expect(result).toEqual([{ region: 'NUS', value: 3.45 }]);
    });

    it('accepts custom metric', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [] } });

      await getCurrentPrices('diesel');

      expect(mockGet).toHaveBeenCalledWith('/prices/current', { params: { metric: 'diesel' } });
    });
  });

  describe('getHistoricalPrices', () => {
    it('passes params to /prices/history', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [] } });

      const params = { metric: 'gas_regular', granularity: 'monthly' };
      await getHistoricalPrices(params);

      expect(mockGet).toHaveBeenCalledWith('/prices/history', { params });
    });
  });

  describe('getRegionalComparison', () => {
    it('calls /prices/comparison', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [] } });

      await getRegionalComparison();

      expect(mockGet).toHaveBeenCalledWith('/prices/comparison', { params: { metric: 'gas_regular' } });
    });
  });

  describe('getDisruptionScore', () => {
    it('calls /disruption/score with defaults', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: { score: 1.2 } } });

      const result = await getDisruptionScore();

      expect(mockGet).toHaveBeenCalledWith('/disruption/score', {
        params: { metric: 'gas_regular', region: 'US' },
      });
      expect(result).toEqual({ score: 1.2 });
    });
  });

  describe('getVolatility', () => {
    it('calls /disruption/volatility', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: { annualizedVolatility: 35 } } });

      await getVolatility('gas_regular', 'US', 30);

      expect(mockGet).toHaveBeenCalledWith('/disruption/volatility', {
        params: { metric: 'gas_regular', region: 'US', window: 30 },
      });
    });
  });

  describe('calculateFuelCost', () => {
    it('POSTs to /impact/fuel-cost', async () => {
      const input = { currentGasPrice: 3.50 };
      mockPost.mockResolvedValueOnce({ data: { data: { annualFuelCost: 1860 } } });

      const result = await calculateFuelCost(input);

      expect(mockPost).toHaveBeenCalledWith('/impact/fuel-cost', input);
      expect(result).toEqual({ annualFuelCost: 1860 });
    });
  });

  describe('getTypicalImpact', () => {
    it('calls /impact/fuel-cost/typical', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: { annualCost: 1850 } } });

      await getTypicalImpact('US', 3.00);

      expect(mockGet).toHaveBeenCalledWith('/impact/fuel-cost/typical', {
        params: { region: 'US', baseline: 3.00 },
      });
    });
  });

  describe('getDownstreamImpact', () => {
    it('calls /impact/downstream', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: { diesel: {} } } });

      await getDownstreamImpact();

      expect(mockGet).toHaveBeenCalledWith('/impact/downstream', {
        params: { region: 'US', baseline: undefined },
      });
    });
  });

  describe('getCrudeGasCorrelation', () => {
    it('calls /correlation/crude-gas', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: { optimalLag: 2 } } });

      await getCrudeGasCorrelation('US', 12);

      expect(mockGet).toHaveBeenCalledWith('/correlation/crude-gas', {
        params: { region: 'US', maxLag: 12 },
      });
    });
  });

  describe('getRocketsAndFeathers', () => {
    it('calls /correlation/rockets-feathers', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: { asymmetryRatio: 1.5 } } });

      await getRocketsAndFeathers('US');

      expect(mockGet).toHaveBeenCalledWith('/correlation/rockets-feathers', {
        params: { region: 'US' },
      });
    });
  });

  describe('getPriceChanges', () => {
    it('calls /prices/changes', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: { currentPrice: 3.50 } } });

      await getPriceChanges();

      expect(mockGet).toHaveBeenCalledWith('/prices/changes', {
        params: { metric: 'gas_regular', region: 'NUS' },
      });
    });
  });

  describe('getCorrelationPriceSeries', () => {
    it('calls /correlation/price-series', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [] } });

      await getCorrelationPriceSeries('US', 260);

      expect(mockGet).toHaveBeenCalledWith('/correlation/price-series', {
        params: { region: 'US', weeks: 260 },
      });
    });
  });

  describe('getEvents', () => {
    it('calls /events', async () => {
      mockGet.mockResolvedValueOnce({ data: { data: [] } });

      await getEvents();

      expect(mockGet).toHaveBeenCalledWith('/events', { params: undefined });
    });
  });

  describe('getSupplyHealth', () => {
    it('calls /supply/health', async () => {
      mockGet.mockResolvedValueOnce({ data: { status: 'success' } });

      await getSupplyHealth();

      expect(mockGet).toHaveBeenCalledWith('/supply/health');
    });
  });
});
