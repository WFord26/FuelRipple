import { describe, expect, it } from 'vitest';
import { resolvePercentChange, toDisplayNumber } from '../lib/priceChange';

describe('priceChange helpers', () => {
  it('uses the API percent change when provided', () => {
    expect(
      resolvePercentChange({
        pct: 1.2345,
        currentPrice: 3.5,
        previousPrice: 3.4,
      })
    ).toBe(1.2345);
  });

  it('derives the percent change from prices when the API field is missing', () => {
    expect(
      resolvePercentChange({
        pct: null,
        currentPrice: 3.5,
        previousPrice: 3.4,
      })
    ).toBeCloseTo(2.9411764706);
  });

  it('coerces numeric strings from API responses', () => {
    expect(
      resolvePercentChange({
        pct: null,
        currentPrice: '3.50',
        previousPrice: '3.40',
      })
    ).toBeCloseTo(2.9411764706);

    expect(toDisplayNumber('3.50')).toBe(3.5);
  });

  it('returns null when there is not enough data to calculate a change', () => {
    expect(
      resolvePercentChange({
        pct: null,
        currentPrice: 3.5,
        previousPrice: null,
      })
    ).toBeNull();

    expect(
      resolvePercentChange({
        pct: null,
        currentPrice: 3.5,
        previousPrice: 0,
      })
    ).toBeNull();
  });
});
