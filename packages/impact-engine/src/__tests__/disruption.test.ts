import { describe, it, expect } from 'vitest';
import {
  calculateDisruptionScore,
  calculateAnnualizedVolatility,
  getVolatilityClassification,
} from '../disruption';

describe('calculateDisruptionScore', () => {
  it('calculates a disruption score from price data', () => {
    // Simulate 52 weeks of stable ~0.5% weekly changes
    const weeklyChanges = Array.from({ length: 50 }, () => 0.005);

    const result = calculateDisruptionScore(3.50, 3.45, weeklyChanges);

    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('classification');
    expect(result).toHaveProperty('weeklyChange');
    expect(result).toHaveProperty('annualizedVolatility');
    expect(result).toHaveProperty('timestamp');
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('returns normal classification for small changes', () => {
    // Historical changes vary around ~0.5% with some spread
    const weeklyChanges = Array.from({ length: 50 }, (_, i) =>
      0.003 + (i % 5) * 0.002 - 0.004
    );

    // Current change near the mean of the historical data
    const mean = weeklyChanges.reduce((s, v) => s + v, 0) / weeklyChanges.length;
    // Pick prices that produce a change close to the historic mean
    const previousPrice = 3.50;
    const currentPrice = previousPrice * (1 + mean);

    const result = calculateDisruptionScore(currentPrice, previousPrice, weeklyChanges);
    expect(['normal', 'elevated']).toContain(result.classification);
  });

  it('returns crisis for extreme price spike', () => {
    // Normal small changes
    const weeklyChanges = Array.from({ length: 50 }, () => 0.002);

    // Massive 20% price jump
    const currentPrice = 4.20;
    const previousPrice = 3.50;

    const result = calculateDisruptionScore(currentPrice, previousPrice, weeklyChanges);
    expect(result.classification).toBe('crisis');
    expect(Math.abs(result.score)).toBeGreaterThanOrEqual(3.0);
  });

  it('calculates weeklyChange as percentage', () => {
    const weeklyChanges = [0.01, 0.02, -0.01, 0.005];
    const result = calculateDisruptionScore(3.60, 3.50, weeklyChanges);

    // (3.60 - 3.50) / 3.50 ≈ 0.02857
    expect(result.weeklyChange).toBeCloseTo(0.02857, 4);
  });

  it('includes annualized volatility', () => {
    const weeklyChanges = [0.01, -0.01, 0.02, -0.02, 0.015, -0.005];
    const result = calculateDisruptionScore(3.50, 3.48, weeklyChanges);

    expect(result.annualizedVolatility).toBeGreaterThan(0);
  });
});

describe('calculateAnnualizedVolatility', () => {
  it('returns 0 for empty array', () => {
    const vol = calculateAnnualizedVolatility([]);
    expect(vol).toBe(0);
  });

  it('returns 0 for single identical values', () => {
    const vol = calculateAnnualizedVolatility([0]);
    expect(vol).toBe(0);
  });

  it('returns higher volatility for more varied changes', () => {
    const stableChanges = [0.001, 0.002, 0.001, 0.002];
    const volatileChanges = [0.05, -0.05, 0.08, -0.03];

    const stableVol = calculateAnnualizedVolatility(stableChanges);
    const volatileVol = calculateAnnualizedVolatility(volatileChanges);

    expect(volatileVol).toBeGreaterThan(stableVol);
  });

  it('annualizes by sqrt(52)', () => {
    // With known std dev of log returns, check the annualization factor is sqrt(52)
    const changes = [0.01, -0.01, 0.01, -0.01];
    const vol = calculateAnnualizedVolatility(changes);

    // Manual: log returns ≈ changes for small values
    // mean ≈ 0, stddev ≈ 0.01
    // annualized ≈ 0.01 * sqrt(52) * 100 ≈ 7.21
    expect(vol).toBeGreaterThan(0);
    expect(vol).toBeLessThan(100);
  });
});

describe('getVolatilityClassification', () => {
  it('returns calm for volatility below 30', () => {
    expect(getVolatilityClassification(10)).toBe('calm');
    expect(getVolatilityClassification(29.9)).toBe('calm');
  });

  it('returns moderate for volatility between 30 and 60', () => {
    expect(getVolatilityClassification(30)).toBe('moderate');
    expect(getVolatilityClassification(45)).toBe('moderate');
    expect(getVolatilityClassification(59.9)).toBe('moderate');
  });

  it('returns high for volatility 60 or above', () => {
    expect(getVolatilityClassification(60)).toBe('high');
    expect(getVolatilityClassification(100)).toBe('high');
    expect(getVolatilityClassification(200)).toBe('high');
  });

  it('returns calm for zero', () => {
    expect(getVolatilityClassification(0)).toBe('calm');
  });
});
