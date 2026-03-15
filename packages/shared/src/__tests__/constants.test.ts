import { describe, it, expect } from 'vitest';
import {
  CONSTANTS,
  PADD_REGIONS,
  EIA_SERIES,
  FRED_SERIES,
  CACHE_TTL,
  RATE_LIMITS,
} from '../constants';

describe('CONSTANTS', () => {
  it('has correct average annual miles', () => {
    expect(CONSTANTS.AVG_ANNUAL_MILES).toBe(13500);
  });

  it('has correct average fleet MPG', () => {
    expect(CONSTANTS.AVG_FLEET_MPG).toBe(25.4);
  });

  it('has correct average commute distance', () => {
    expect(CONSTANTS.AVG_COMMUTE_DISTANCE).toBe(20.5);
  });

  it('has correct working days per year', () => {
    expect(CONSTANTS.WORKING_DAYS_PER_YEAR).toBe(250);
  });

  it('has correct truck MPG', () => {
    expect(CONSTANTS.TRUCK_MPG).toBe(6.5);
  });

  it('has correct diesel baseline', () => {
    expect(CONSTANTS.DIESEL_BASELINE).toBe(1.25);
  });

  it('has correct crude-to-gas ratio', () => {
    expect(CONSTANTS.CRUDE_TO_GAS_RATIO).toBe(0.025);
  });

  it('has correct volatility thresholds', () => {
    expect(CONSTANTS.VOLATILITY.CALM).toBe(30);
    expect(CONSTANTS.VOLATILITY.MODERATE).toBe(60);
  });
});

describe('PADD_REGIONS', () => {
  it('has 5 PADD regions', () => {
    expect(Object.keys(PADD_REGIONS)).toHaveLength(5);
  });

  it('has correct PADD codes', () => {
    expect(PADD_REGIONS.PADD1.code).toBe('R10');
    expect(PADD_REGIONS.PADD2.code).toBe('R20');
    expect(PADD_REGIONS.PADD3.code).toBe('R30');
    expect(PADD_REGIONS.PADD4.code).toBe('R40');
    expect(PADD_REGIONS.PADD5.code).toBe('R50');
  });

  it('has correct PADD names', () => {
    expect(PADD_REGIONS.PADD1.name).toBe('East Coast');
    expect(PADD_REGIONS.PADD2.name).toBe('Midwest');
    expect(PADD_REGIONS.PADD3.name).toBe('Gulf Coast');
    expect(PADD_REGIONS.PADD4.name).toBe('Rocky Mountain');
    expect(PADD_REGIONS.PADD5.name).toBe('West Coast');
  });

  it('California is in PADD5', () => {
    expect(PADD_REGIONS.PADD5.states).toContain('CA');
  });

  it('Texas is in PADD3', () => {
    expect(PADD_REGIONS.PADD3.states).toContain('TX');
  });

  it('all regions have non-empty states arrays', () => {
    for (const region of Object.values(PADD_REGIONS)) {
      expect(Array.isArray(region.states)).toBe(true);
      expect(region.states.length).toBeGreaterThan(0);
    }
  });
});

describe('EIA_SERIES', () => {
  it('has US regular gasoline series', () => {
    expect(EIA_SERIES.GAS_REGULAR_US).toBe('PET.EMM_EPMR_PTE_NUS_DPG.W');
  });

  it('has all PADD gas series', () => {
    expect(EIA_SERIES.GAS_PADD1).toBe('PET.EMM_EPMR_PTE_R10_DPG.W');
    expect(EIA_SERIES.GAS_PADD2).toBe('PET.EMM_EPMR_PTE_R20_DPG.W');
    expect(EIA_SERIES.GAS_PADD3).toBe('PET.EMM_EPMR_PTE_R30_DPG.W');
    expect(EIA_SERIES.GAS_PADD4).toBe('PET.EMM_EPMR_PTE_R40_DPG.W');
    expect(EIA_SERIES.GAS_PADD5).toBe('PET.EMM_EPMR_PTE_R50_DPG.W');
  });

  it('has crude oil series', () => {
    expect(EIA_SERIES.CRUDE_WTI).toBe('PET.RWTC.D');
    expect(EIA_SERIES.CRUDE_BRENT).toBe('PET.RBRTE.D');
  });

  it('has diesel series', () => {
    expect(EIA_SERIES.DIESEL_US).toBe('PET.EMD_EPD2D_PTE_NUS_DPG.W');
  });
});

describe('FRED_SERIES', () => {
  it('has WTI crude series', () => {
    expect(FRED_SERIES.WTI_CRUDE).toBe('DCOILWTICO');
  });

  it('has CPI series', () => {
    expect(FRED_SERIES.CPI_ALL_URBAN).toBe('CPIAUCSL');
  });

  it('has PPI trucking series', () => {
    expect(FRED_SERIES.PPI_TRUCK_TRANSPORT).toBe('PCU484484');
  });

  it('has gas regular weekly series', () => {
    expect(FRED_SERIES.GAS_REGULAR_WEEKLY).toBe('GASREGW');
  });
});

describe('CACHE_TTL', () => {
  it('weekly gas TTL is 24 hours', () => {
    expect(CACHE_TTL.WEEKLY_GAS).toBe(86400);
  });

  it('daily crude TTL is 6 hours', () => {
    expect(CACHE_TTL.DAILY_CRUDE).toBe(21600);
  });

  it('historical TTL is 7 days', () => {
    expect(CACHE_TTL.HISTORICAL).toBe(604800);
  });

  it('disruption score TTL is 1 hour', () => {
    expect(CACHE_TTL.DISRUPTION_SCORE).toBe(3600);
  });

  it('downstream TTL is 24 hours', () => {
    expect(CACHE_TTL.DOWNSTREAM).toBe(86400);
  });
});

describe('RATE_LIMITS', () => {
  it('has EIA requests per hour limit', () => {
    expect(RATE_LIMITS.EIA_REQUESTS_PER_HOUR).toBe(9000);
  });

  it('has EIA rows per request limit', () => {
    expect(RATE_LIMITS.EIA_ROWS_PER_REQUEST).toBe(5000);
  });

  it('has FRED requests per minute limit', () => {
    expect(RATE_LIMITS.FRED_REQUESTS_PER_MINUTE).toBe(120);
  });
});
