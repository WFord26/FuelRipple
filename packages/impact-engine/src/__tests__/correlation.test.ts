import { describe, it, expect } from 'vitest';
import {
  calculateCorrelation,
  calculateCrossCorrelation,
  findOptimalLag,
  estimateGasPriceFromCrude,
  analyzeRocketsAndFeathers,
} from '../correlation';

describe('calculateCorrelation', () => {
  it('returns 1 for perfectly correlated arrays', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 6, 8, 10];
    expect(calculateCorrelation(a, b)).toBeCloseTo(1.0, 5);
  });

  it('returns -1 for perfectly inversely correlated arrays', () => {
    const a = [1, 2, 3, 4, 5];
    const b = [10, 8, 6, 4, 2];
    expect(calculateCorrelation(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('returns 0 for uncorrelated arrays', () => {
    // Symmetric data around middle → zero correlation
    const a = [1, 2, 3, 2, 1];
    const b = [1, 1, 1, 1, 1];
    expect(calculateCorrelation(a, b)).toBeCloseTo(0, 5);
  });

  it('returns 0 for empty arrays', () => {
    expect(calculateCorrelation([], [])).toBe(0);
  });

  it('returns 0 for arrays of different lengths', () => {
    expect(calculateCorrelation([1, 2, 3], [1, 2])).toBe(0);
  });

  it('returns 0 when denominator is zero (constant arrays)', () => {
    const a = [5, 5, 5, 5];
    const b = [3, 3, 3, 3];
    expect(calculateCorrelation(a, b)).toBe(0);
  });

  it('calculates positive correlation for similar trends', () => {
    const gas = [3.0, 3.2, 3.4, 3.5, 3.8];
    const oil = [70, 72, 75, 76, 80];
    const corr = calculateCorrelation(gas, oil);
    expect(corr).toBeGreaterThan(0.9);
  });
});

describe('calculateCrossCorrelation', () => {
  it('returns array of lag-correlation pairs', () => {
    const gas = [3.0, 3.2, 3.4, 3.5, 3.8, 4.0, 3.9, 3.7];
    const oil = [70, 72, 75, 76, 80, 82, 81, 78];
    const result = calculateCrossCorrelation(gas, oil, 4);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('lag');
    expect(result[0]).toHaveProperty('correlation');
    expect(result[0].lag).toBe(0);
  });

  it('respects maxLag parameter', () => {
    const gas = Array.from({ length: 20 }, (_, i) => 3 + i * 0.1);
    const oil = Array.from({ length: 20 }, (_, i) => 70 + i * 2);
    const result = calculateCrossCorrelation(gas, oil, 5);

    expect(result.length).toBeLessThanOrEqual(6); // lag 0 through 5
  });

  it('handles empty arrays', () => {
    const result = calculateCrossCorrelation([], [], 5);
    expect(result).toEqual([]);
  });
});

describe('findOptimalLag', () => {
  it('finds lag with highest absolute correlation', () => {
    const crossCorr = [
      { lag: 0, correlation: 0.5 },
      { lag: 1, correlation: 0.8 },
      { lag: 2, correlation: 0.95 },
      { lag: 3, correlation: 0.7 },
    ];
    expect(findOptimalLag(crossCorr)).toBe(2);
  });

  it('returns 0 for empty array', () => {
    expect(findOptimalLag([])).toBe(0);
  });

  it('considers absolute values (negative correlation)', () => {
    const crossCorr = [
      { lag: 0, correlation: 0.5 },
      { lag: 1, correlation: -0.9 },
      { lag: 2, correlation: 0.7 },
    ];
    expect(findOptimalLag(crossCorr)).toBe(1);
  });
});

describe('estimateGasPriceFromCrude', () => {
  it('applies crude-to-gas ratio correctly', () => {
    // $10/barrel → $0.25/gallon
    const result = estimateGasPriceFromCrude(10);
    expect(result).toBeCloseTo(0.25, 2);
  });

  it('handles negative crude change', () => {
    const result = estimateGasPriceFromCrude(-20);
    expect(result).toBeCloseTo(-0.50, 2);
  });

  it('returns 0 for zero change', () => {
    expect(estimateGasPriceFromCrude(0)).toBe(0);
  });
});

describe('analyzeRocketsAndFeathers', () => {
  it('detects symmetric price movements', () => {
    // Equal magnitude response to increases and decreases
    const gasChanges = [0.02, -0.02, 0.01, -0.01, 0.015, -0.015, 0.01, -0.01, 0.02, -0.02, 0.01, -0.01];
    const oilChanges = [0.05, -0.05, 0.03, -0.03, 0.04,  -0.04,  0.03, -0.03, 0.05, -0.05, 0.03, -0.03];

    const result = analyzeRocketsAndFeathers(gasChanges, oilChanges);

    expect(result.avgIncreaseSpeed).toBeGreaterThan(0);
    expect(result.avgDecreaseSpeed).toBeGreaterThan(0);
    // Elasticity ratio should be roughly symmetric (~1)
    expect(result.elasticityRatio).toBeCloseTo(1.0, 0);
    // Legacy ratio should also be near 1
    expect(result.asymmetryRatio).toBeCloseTo(1.0, 1);
    // Both elasticities should be similar
    expect(result.riseElasticity).toBeGreaterThan(0);
    expect(result.fallElasticity).toBeGreaterThan(0);
  });

  it('detects rockets and feathers effect', () => {
    // Gas rises faster when oil goes up, drops slowly when oil goes down
    const gasChanges = [0.05, -0.01, 0.04, -0.005, 0.03, -0.008, 0.04, -0.01, 0.05, -0.005, 0.03, -0.01];
    const oilChanges = [0.05, -0.05, 0.03, -0.03,  0.04, -0.04,  0.03, -0.03, 0.05, -0.05,  0.04, -0.04];

    const result = analyzeRocketsAndFeathers(gasChanges, oilChanges);

    expect(result.elasticityRatio).toBeGreaterThan(1);
    expect(result.riseElasticity).toBeGreaterThan(result.fallElasticity);
    expect(result.avgIncreaseSpeed).toBeGreaterThan(result.avgDecreaseSpeed);
  });

  it('returns cumulative pass-through data', () => {
    // Need enough data points for cumulative analysis (shock + 6-week window)
    const gasChanges = [0.03, 0.005, 0.002, 0.001, 0, 0, -0.01, -0.005, -0.003, -0.002, -0.001, 0];
    const oilChanges = [0.06, 0,     0,     0,     0, 0, -0.06,  0,      0,      0,      0,     0];

    const result = analyzeRocketsAndFeathers(gasChanges, oilChanges);

    expect(result.cumulativePassThrough).toHaveLength(5); // lags 0 through 4
    expect(result.cumulativePassThrough[0].lag).toBe(0);
    expect(result.cumulativePassThrough[4].lag).toBe(4);
  });

  it('returns half-life metrics', () => {
    const gasChanges = [0.03, 0.005, 0.002, 0.001, 0, 0, -0.01, -0.005, -0.003, -0.002, -0.001, 0];
    const oilChanges = [0.06, 0,     0,     0,     0, 0, -0.06,  0,      0,      0,      0,     0];

    const result = analyzeRocketsAndFeathers(gasChanges, oilChanges);

    expect(typeof result.riseHalfLifeWeeks).toBe('number');
    expect(typeof result.fallHalfLifeWeeks).toBe('number');
    expect(result.riseHalfLifeWeeks).toBeGreaterThanOrEqual(0);
    expect(result.fallHalfLifeWeeks).toBeGreaterThanOrEqual(0);
  });

  it('throws error for mismatched array lengths', () => {
    expect(() =>
      analyzeRocketsAndFeathers([0.01, 0.02], [0.05])
    ).toThrow('Price change arrays must be same length');
  });

  it('handles all zero oil changes', () => {
    const gasChanges = [0.01, 0.02, 0.01, 0.02];
    const oilChanges = [0, 0, 0, 0];

    const result = analyzeRocketsAndFeathers(gasChanges, oilChanges);

    expect(result.avgIncreaseSpeed).toBe(0);
    expect(result.avgDecreaseSpeed).toBe(0);
    expect(result.asymmetryRatio).toBe(0);
    expect(result.elasticityRatio).toBe(0);
  });
});
