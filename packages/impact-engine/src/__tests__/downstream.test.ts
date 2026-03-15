import { describe, it, expect } from 'vitest';
import {
  calculateFreightSurcharge,
  estimateFreightRateIncrease,
  estimateCPIImpact,
  estimateFoodPriceImpact,
  calculateDownstreamImpact,
} from '../downstream';

describe('calculateFreightSurcharge', () => {
  it('calculates surcharge above diesel baseline', () => {
    const result = calculateFreightSurcharge(4.00);

    // delta = 4.00 - 1.25 = 2.75
    // surcharge per mile = 2.75 / 6.5 ≈ 0.4231
    expect(result.dieselDelta).toBeCloseTo(2.75, 2);
    expect(result.surchargePerMile).toBeCloseTo(2.75 / 6.5, 3);
    expect(result.baselineDiesel).toBe(1.25);
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

    // $1 diesel increase → 16¢/mile cost increase
    expect(result.costPerMileIncrease).toBeCloseTo(0.16, 2);
  });

  it('calculates freight rate increase percentage', () => {
    const result = estimateFreightRateIncrease(1.00);

    // 0.16 / 2.00 * 100 = 8%
    expect(result.freightRateIncreasePercent).toBeCloseTo(8.0, 1);
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
  it('calculates min and max CPI range', () => {
    const result = estimateCPIImpact(10);

    // min: 10 * 0.05 = 0.5
    // max: 10 * 0.2 = 2.0
    // avg: 1.25
    expect(result.minCPIIncrease).toBeCloseTo(0.5, 2);
    expect(result.maxCPIIncrease).toBeCloseTo(2.0, 2);
    expect(result.avgCPIIncrease).toBeCloseTo(1.25, 2);
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
  it('applies 9% transportation factor', () => {
    const result = estimateFoodPriceImpact(10);
    // 10 * 0.09 = 0.9
    expect(result).toBeCloseTo(0.9, 2);
  });

  it('returns 0 for zero freight increase', () => {
    expect(estimateFoodPriceImpact(0)).toBe(0);
  });
});

describe('calculateDownstreamImpact', () => {
  it('returns complete pass-through chain', () => {
    const result = calculateDownstreamImpact(4.50);

    expect(result).toHaveProperty('diesel');
    expect(result).toHaveProperty('freight');
    expect(result).toHaveProperty('consumer');

    // Diesel section
    expect(result.diesel.current).toBe(4.50);
    expect(result.diesel.baseline).toBe(1.25); // CONSTANTS.DIESEL_BASELINE
    expect(result.diesel.increase).toBeCloseTo(3.25, 2);

    // Freight section
    expect(result.freight.surchargePerMile).toBeGreaterThan(0);
    expect(result.freight.costPerMileIncrease).toBeGreaterThan(0);
    expect(result.freight.rateIncreasePercent).toBeGreaterThan(0);

    // Consumer section
    expect(result.consumer.minCPIIncrease).toBeGreaterThan(0);
    expect(result.consumer.maxCPIIncrease).toBeGreaterThan(result.consumer.minCPIIncrease);
    expect(result.consumer.foodPriceIncrease).toBeGreaterThan(0);
  });

  it('accepts custom baseline', () => {
    const result = calculateDownstreamImpact(4.00, 2.00);

    expect(result.diesel.baseline).toBe(2.00);
    expect(result.diesel.increase).toBeCloseTo(2.00, 2);
  });

  it('returns zeros when diesel equals baseline', () => {
    const result = calculateDownstreamImpact(1.25, 1.25);

    expect(result.diesel.increase).toBeCloseTo(0, 5);
    expect(result.freight.costPerMileIncrease).toBeCloseTo(0, 5);
    expect(result.freight.rateIncreasePercent).toBeCloseTo(0, 5);
    expect(result.consumer.avgCPIIncrease).toBeCloseTo(0, 5);
    expect(result.consumer.foodPriceIncrease).toBeCloseTo(0, 5);
  });

  it('chain produces consistent results', () => {
    const result = calculateDownstreamImpact(5.00);

    // Verify the chain from diesel increase → freight → CPI
    const dieselIncrease = 5.00 - 1.25;
    const expectedCostPerMile = dieselIncrease * 0.16;
    const expectedFreightPct = (expectedCostPerMile / 2.0) * 100;
    const expectedFoodImpact = expectedFreightPct * 0.09;

    expect(result.freight.costPerMileIncrease).toBeCloseTo(expectedCostPerMile, 4);
    expect(result.freight.rateIncreasePercent).toBeCloseTo(expectedFreightPct, 4);
    expect(result.consumer.foodPriceIncrease).toBeCloseTo(expectedFoodImpact, 4);
  });
});
