import { describe, it, expect } from 'vitest';
import {
  EnergyPriceSchema,
  PriceHistoryQuerySchema,
  GeoEventSchema,
  EconomicIndicatorSchema,
  DisruptionScoreSchema,
  FuelCostInputSchema,
  FuelCostOutputSchema,
} from '../schemas';

describe('EnergyPriceSchema', () => {
  it('accepts valid energy price data', () => {
    const valid = {
      time: new Date('2026-03-10'),
      source: 'eia',
      metric: 'gas_regular',
      region: 'NUS',
      value: 3.45,
      unit: 'usd_per_gallon',
    };
    const result = EnergyPriceSchema.parse(valid);
    expect(result.value).toBe(3.45);
    expect(result.source).toBe('eia');
  });

  it('defaults region to US when omitted', () => {
    const result = EnergyPriceSchema.parse({
      time: new Date(),
      source: 'fred',
      metric: 'crude_wti',
      value: 72.5,
      unit: 'usd_per_barrel',
    });
    expect(result.region).toBe('US');
  });

  it('rejects invalid source', () => {
    expect(() =>
      EnergyPriceSchema.parse({
        time: new Date(),
        source: 'invalid',
        metric: 'gas_regular',
        value: 3.0,
        unit: 'usd_per_gallon',
      })
    ).toThrow();
  });

  it('rejects invalid metric', () => {
    expect(() =>
      EnergyPriceSchema.parse({
        time: new Date(),
        source: 'eia',
        metric: 'natural_gas',
        value: 3.0,
        unit: 'usd_per_gallon',
      })
    ).toThrow();
  });

  it('rejects invalid unit', () => {
    expect(() =>
      EnergyPriceSchema.parse({
        time: new Date(),
        source: 'eia',
        metric: 'gas_regular',
        value: 3.0,
        unit: 'eur_per_liter',
      })
    ).toThrow();
  });

  it('accepts all valid sources', () => {
    const sources = ['eia', 'fred', 'oilprice', 'aaa', 'yahoo'] as const;
    for (const source of sources) {
      const result = EnergyPriceSchema.parse({
        time: new Date(),
        source,
        metric: 'gas_regular',
        value: 3.0,
        unit: 'usd_per_gallon',
      });
      expect(result.source).toBe(source);
    }
  });

  it('accepts all valid metrics', () => {
    const metrics = ['gas_regular', 'gas_midgrade', 'gas_premium', 'diesel', 'crude_wti', 'crude_brent'] as const;
    for (const metric of metrics) {
      const result = EnergyPriceSchema.parse({
        time: new Date(),
        source: 'eia',
        metric,
        value: 3.0,
        unit: 'usd_per_gallon',
      });
      expect(result.metric).toBe(metric);
    }
  });
});

describe('PriceHistoryQuerySchema', () => {
  it('accepts empty query with defaults', () => {
    const result = PriceHistoryQuerySchema.parse({});
    expect(result.granularity).toBe('weekly');
    expect(result.metric).toBeUndefined();
    expect(result.region).toBeUndefined();
  });

  it('accepts full query parameters', () => {
    const result = PriceHistoryQuerySchema.parse({
      metric: 'gas_regular',
      region: 'NUS',
      start: '2025-01-01T00:00:00Z',
      end: '2026-01-01T00:00:00Z',
      granularity: 'monthly',
    });
    expect(result.granularity).toBe('monthly');
  });

  it('rejects invalid granularity', () => {
    expect(() =>
      PriceHistoryQuerySchema.parse({ granularity: 'quarterly' })
    ).toThrow();
  });

  it('rejects invalid datetime format for start', () => {
    expect(() =>
      PriceHistoryQuerySchema.parse({ start: 'not-a-date' })
    ).toThrow();
  });
});

describe('GeoEventSchema', () => {
  it('accepts valid event data', () => {
    const result = GeoEventSchema.parse({
      id: 1,
      event_date: new Date('2026-01-15'),
      category: 'opec',
      title: 'OPEC+ production cut',
      description: 'Major production cut announced',
      impact: 'bullish',
    });
    expect(result.category).toBe('opec');
    expect(result.impact).toBe('bullish');
  });

  it('accepts event without optional fields', () => {
    const result = GeoEventSchema.parse({
      id: 2,
      event_date: new Date(),
      category: 'hurricane',
      title: 'Hurricane in Gulf',
    });
    expect(result.description).toBeUndefined();
    expect(result.impact).toBeUndefined();
  });

  it('accepts all valid categories', () => {
    const categories = ['opec', 'sanctions', 'hurricane', 'policy', 'other'] as const;
    for (const category of categories) {
      const result = GeoEventSchema.parse({
        id: 1,
        event_date: new Date(),
        category,
        title: 'Test',
      });
      expect(result.category).toBe(category);
    }
  });
});

describe('EconomicIndicatorSchema', () => {
  it('accepts valid indicator data', () => {
    const result = EconomicIndicatorSchema.parse({
      time: new Date(),
      indicator: 'cpi',
      value: 312.5,
      source: 'fred',
    });
    expect(result.indicator).toBe('cpi');
  });

  it('accepts all valid indicators', () => {
    const indicators = ['cpi', 'ppi_trucking', 'freight_rate'] as const;
    for (const indicator of indicators) {
      const result = EconomicIndicatorSchema.parse({
        time: new Date(),
        indicator,
        value: 100,
        source: 'bls',
      });
      expect(result.indicator).toBe(indicator);
    }
  });
});

describe('DisruptionScoreSchema', () => {
  it('accepts valid disruption score', () => {
    const result = DisruptionScoreSchema.parse({
      score: 1.5,
      classification: 'elevated',
      weeklyChange: 0.03,
      annualizedVolatility: 45.2,
      timestamp: new Date(),
    });
    expect(result.classification).toBe('elevated');
  });

  it('accepts all classifications', () => {
    const classifications = ['normal', 'elevated', 'high', 'crisis'] as const;
    for (const classification of classifications) {
      const result = DisruptionScoreSchema.parse({
        score: 0,
        classification,
        weeklyChange: 0,
        annualizedVolatility: 0,
        timestamp: new Date(),
      });
      expect(result.classification).toBe(classification);
    }
  });
});

describe('FuelCostInputSchema', () => {
  it('applies defaults correctly', () => {
    const result = FuelCostInputSchema.parse({ currentGasPrice: 3.50 });
    expect(result.annualMiles).toBe(13500);
    expect(result.vehicleMPG).toBe(25.4);
    expect(result.commuteDistance).toBe(20.5);
    expect(result.workingDaysPerYear).toBe(250);
  });

  it('rejects negative annual miles', () => {
    expect(() =>
      FuelCostInputSchema.parse({ annualMiles: -100, currentGasPrice: 3.0 })
    ).toThrow();
  });

  it('rejects MPG below 1', () => {
    expect(() =>
      FuelCostInputSchema.parse({ vehicleMPG: 0, currentGasPrice: 3.0 })
    ).toThrow();
  });

  it('rejects MPG above 100', () => {
    expect(() =>
      FuelCostInputSchema.parse({ vehicleMPG: 150, currentGasPrice: 3.0 })
    ).toThrow();
  });

  it('rejects negative gas price', () => {
    expect(() =>
      FuelCostInputSchema.parse({ currentGasPrice: -1 })
    ).toThrow();
  });

  it('accepts custom values with baseline', () => {
    const result = FuelCostInputSchema.parse({
      annualMiles: 15000,
      vehicleMPG: 30,
      commuteDistance: 25,
      workingDaysPerYear: 260,
      currentGasPrice: 4.00,
      baselineGasPrice: 3.00,
    });
    expect(result.baselineGasPrice).toBe(3.00);
  });
});

describe('FuelCostOutputSchema', () => {
  it('accepts valid output', () => {
    const result = FuelCostOutputSchema.parse({
      annualFuelCost: 1850.39,
      annualGallons: 531.50,
      priceSensitivity: 531.50,
      commuteCostPerYear: 1200.0,
      costVsBaseline: 265.75,
    });
    expect(result.annualFuelCost).toBe(1850.39);
  });

  it('accepts output without optional costVsBaseline', () => {
    const result = FuelCostOutputSchema.parse({
      annualFuelCost: 1850.39,
      annualGallons: 531.50,
      priceSensitivity: 531.50,
      commuteCostPerYear: 1200.0,
    });
    expect(result.costVsBaseline).toBeUndefined();
  });
});
