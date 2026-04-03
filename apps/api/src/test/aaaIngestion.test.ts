import { describe, expect, it } from '@jest/globals';
import { assertAAAScrapeHealthy, summarizeAAAScrape } from '../services/aaaIngestion';

const buildState = (state: string, hasPrices: boolean) => ({
  state,
  regular: hasPrices ? 3.5 : null,
  midGrade: hasPrices ? 3.9 : null,
  premium: hasPrices ? 4.2 : null,
  diesel: hasPrices ? 4.8 : null,
});

describe('summarizeAAAScrape', () => {
  it('counts populated and empty states', () => {
    const summary = summarizeAAAScrape([
      buildState('CO', true),
      buildState('CA', false),
      buildState('TX', true),
    ]);

    expect(summary.totalStates).toBe(3);
    expect(summary.populatedStates).toBe(2);
    expect(summary.emptyStates).toEqual(['CA']);
    expect(summary.minPopulatedStates).toBe(2);
  });
});

describe('assertAAAScrapeHealthy', () => {
  it('accepts a scrape when at least 60 percent of states returned prices', () => {
    expect(() =>
      assertAAAScrapeHealthy([
        buildState('CO', true),
        buildState('CA', true),
        buildState('TX', false),
        buildState('NM', true),
        buildState('AZ', false),
      ])
    ).not.toThrow();
  });

  it('rejects a scrape when too many states are empty', () => {
    expect(() =>
      assertAAAScrapeHealthy([
        buildState('CO', true),
        buildState('CA', false),
        buildState('TX', false),
        buildState('NM', false),
        buildState('AZ', false),
      ])
    ).toThrow(/AAA scrape rejected/);
  });
});
