import { describe, it, expect } from 'vitest';
import {
  calculateFreightSurcharge,
  estimateFreightRateIncrease,
  estimateCPIImpact,
  estimateFoodPriceImpact,
  calculateDownstreamImpact,
  PASS_THROUGH_LAG,
} from '../downstream';
import { CONSTANTS } from '@fuelripple/shared';

describe('calculateFreightSurcharge', () => {
  it('calculates surcharge above diesel baseline', () => {
    const result = calculateFreightSurcharge(4.00);

    // delta = 4.00 - 1.25 = 2.75
    // surcharge per mile = 2.75 / 6.5 ≈ 0.4231
    expect(result.dieselDelta).toBeCloseTo(2.75, 2);
    expect(result.surchargePerMile).toBeCloseTo(2.75 / 6.5, 3);
    expect(result.baselineDiesel).toBe(1.25);
  });

  it('accepts custom baseline', () => {
    const result = calculateFreightSurcharge(4.00, 3.50);
    expect(result.dieselDelta).toBeCloseTo(0.50, 2);
    expect(result.baselineDiesel).toBe(3.50);
  });

  it('returns negative surcharge below baseline', () => {
    const result = calculateFreightSurcharge(1.00);
    expect(result.dieselDelta).toBeLessThan(0);
    expect(result.surchargePerMile).toBeLessThan(0);
  });

  it('returns zero surcharge at baseline', () => {
    const result = calculateFreightSurcharge(1.25);
    expect(result.dieselDelta).toBeCloseTo(0, 5);
    expect(result.surchargePerMile).toBeCloseTo(0, 5);
  });
});

describe('estimateFreightRateIncrease', () => {
  it('calculates cost per mile increase', () => {
    const result = estimateFreightRateIncrease(1.00);

    // $1 diesel increase → 16¢/mile cost increase (CONSTANTS.DIESEL_COST_PER_MILE_FACTOR)
    expect(result.costPerMileIncrease).toBeCloseTo(0.16, 2);
  });

  it('calculates freight rate increase percentage using CONSTANTS', () => {
    const result = estimateFreightRateIncrease(1.00);

    // 0.16 / 2.70 * 100 ≈ 5.93%
    const expected = (0.16 / CONSTANTS.BASE_FREIGHT_RATE_PER_MILE) * 100;
    expect(result.freightRateIncreasePercent).toBeCloseTo(expected, 1);
  });

  it('scales linearly with diesel increase', () => {
    const result1 = estimateFreightRateIncrease(1.00);
    const result2 = estimateFreightRateIncrease(2.00);

    expect(result2.costPerMileIncrease).toBeCloseTo(result1.costPerMileIncrease * 2, 4);
    expect(result2.freightRateIncreasePercent).toBeCloseTo(result1.freightRateIncreasePercent * 2, 4);
  });

  it('handles zero increase', () => {
    const result = estimateFreightRateIncrease(0);
    expect(result.costPerMileIncrease).toBe(0);
    expect(result.freightRateIncreasePercent).toBe(0);
  });
});

describe('estimateCPIImpact', () => {
  it('uses architecture-consistent multipliers (0.10 min, 0.20 max)', () => {
    const result = estimateCPIImpact(10);

    // min: 10 * 0.10 = 1.0
    // max: 10 * 0.20 = 2.0
    // avg: 1.5
    expect(result.minCPIIncrease).toBeCloseTo(1.0, 2);
    expect(result.maxCPIIncrease).toBeCloseTo(2.0, 2);
    expect(result.avgCPIIncrease).toBeCloseTo(1.5, 2);
  });

  it('average is midpoint of min and max', () => {
    const result = estimateCPIImpact(8);
    expect(result.avgCPIIncrease).toBeCloseTo(
      (result.minCPIIncrease + result.maxCPIIncrease) / 2,
      5
    );
  });

  it('handles zero freight rate increase', () => {
    const result = estimateCPIImpact(0);
    expect(result.minCPIIncrease).toBe(0);
    expect(result.maxCPIIncrease).toBe(0);
    expect(result.avgCPIIncrease).toBe(0);
  });
});

describe('estimateFoodPriceImpact', () => {
  it('applies USDA 9% transportation factor', () => {
    const result = estimateFoodPriceImpact(10);
    // 10 * 0.09 = 0.9
    expect(result).toBeCloseTo(0.9, 2);
  });

  it('returns 0 for zero freight increase', () => {
    expect(estimateFoodPriceImpact(0)).toBe(0);
  });
});

describe('calculateDownstreamImpact', () => {
  it('returns complete pass-through chain with lag info', () => {
    const result = calculateDownstreamImpact(4.50);

    expect(result).toHaveProperty('diesel');
    expect(result).toHaveProperty('freight');
    expect(result).toHaveProperty('consumer');
    expect(result).toHaveProperty('lag');

    // Diesel section
    expect(result.diesel.current).toBe(4.50);
    expect(result.diesel.baseline).toBe(1.25); // CONSTANTS.DIESEL_BASELINE default
    expect(result.diesel.increase).toBeCloseTo(3.25, 2);
    expect(result.diesel.baselineSource).toBe('doe_reference');

    // Freight section
    expect(result.freight.surchargePerMile).toBeGreaterThan(0);
    expect(result.freight.costPerMileIncrease).toBeGreaterThan(0);
    expect(result.freight.rateIncreasePercent).toBeGreaterThan(0);

    // Consumer section
    expect(result.consumer.minCPIIncrease).toBeGreaterThan(0);
    expect(result.consumer.maxCPIIncrease).toBeGreaterThan(result.consumer.minCPIIncrease);
    expect(result.consumer.foodPriceIncrease).toBeGreaterThan(0);

    // Lag section
    expect(result.lag).toEqual(PASS_THROUGH_LAG);
  });

  it('accepts custom baseline and tags source', () => {
    const result = calculateDownstreamImpact(4.00, 3.50, 'rolling_52w');

    expect(result.diesel.baseline).toBe(3.50);
    expect(result.diesel.increase).toBeCloseTo(0.50, 2);
    expect(result.diesel.baselineSource).toBe('rolling_52w');
  });

  it('surcharge uses same baseline as the increase (no inconsistency)', () => {
    const result = calculateDownstreamImpact(4.00, 3.50, 'custom');

    // Surcharge should also reflect baseline=3.50
    const expectedSurcharge = (4.00 - 3.50) / CONSTANTS.TRUCK_MPG;
    expect(result.freight.surchargePerMile).toBeCloseTo(expectedSurcharge, 4);
  });

  it('returns zeros when diesel equals baseline', () => {
    const result = calculateDownstreamImpact(3.50, 3.50);

    expect(result.diesel.increase).toBeCloseTo(0, 5);
    expect(result.freight.costPerMileIncrease).toBeCloseTo(0, 5);
    expect(result.freight.rateIncreasePercent).toBeCloseTo(0, 5);
    expect(result.consumer.avgCPIIncrease).toBeCloseTo(0, 5);
    expect(result.consumer.foodPriceIncrease).toBeCloseTo(0, 5);
  });

  it('chain produces consistent results', () => {
    const result = calculateDownstreamImpact(5.00);

    // Verify chain from diesel increase → freight → CPI
    const dieselIncrease = 5.00 - 1.25;
    const expectedCostPerMile = dieselIncrease * CONSTANTS.DIESEL_COST_PER_MILE_FACTOR;
    const expectedFreightPct = (expectedCostPerMile / CONSTANTS.BASE_FREIGHT_RATE_PER_MILE) * 100;
    const expectedFoodImpact = expectedFreightPct * CONSTANTS.FOOD_TRANSPORT_SHARE;

    expect(result.freight.costPerMileIncrease).toBeCloseTo(expectedCostPerMile, 4);
    expect(result.freight.rateIncreasePercent).toBeCloseTo(expectedFreightPct, 4);
    expect(result.consumer.foodPriceIncrease).toBeCloseTo(expectedFoodImpact, 4);
  });

  it('food impact is less than total CPI impact', () => {
    const result = calculateDownstreamImpact(4.50);
    // Food is a component of CPI, so food-specific increase should be
    // smaller than the broad CPI estimate
    expect(result.consumer.foodPriceIncrease).toBeLessThan(result.consumer.avgCPIIncrease);
  });
});
