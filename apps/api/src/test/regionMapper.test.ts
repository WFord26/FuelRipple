import { describe, it, expect } from '@jest/globals';
import {
  STATE_INFO,
  STATE_CODES,
  PADD_CODES,
  ABBR_TO_DUOAREA,
  abbrToDuoarea,
  isStateCode,
  isPaddCode,
  getPaddForState,
  mapRegion,
} from '../utils/regionMapper';

describe('STATE_INFO', () => {
  it('has entries for all 50 states + DC', () => {
    // 50 states + DC = 51
    expect(Object.keys(STATE_INFO).length).toBeGreaterThanOrEqual(51);
  });

  it('each entry has padd, abbr, and name', () => {
    for (const [code, info] of Object.entries(STATE_INFO)) {
      expect(info).toHaveProperty('padd');
      expect(info).toHaveProperty('abbr');
      expect(info).toHaveProperty('name');
      expect(code).toMatch(/^S[A-Z]{2}$/);
    }
  });

  it('California is in PADD5', () => {
    expect(STATE_INFO.SCA.padd).toBe('R50');
    expect(STATE_INFO.SCA.abbr).toBe('CA');
    expect(STATE_INFO.SCA.name).toBe('California');
  });

  it('Texas is in PADD3', () => {
    expect(STATE_INFO.STX.padd).toBe('R30');
    expect(STATE_INFO.STX.abbr).toBe('TX');
  });

  it('New York is in PADD1', () => {
    expect(STATE_INFO.SNY.padd).toBe('R10');
    expect(STATE_INFO.SNY.abbr).toBe('NY');
  });
});

describe('STATE_CODES', () => {
  it('is a Set', () => {
    expect(STATE_CODES).toBeInstanceOf(Set);
  });

  it('contains known state codes', () => {
    expect(STATE_CODES.has('SCA')).toBe(true);
    expect(STATE_CODES.has('STX')).toBe(true);
    expect(STATE_CODES.has('SNY')).toBe(true);
  });

  it('does not contain PADD codes', () => {
    expect(STATE_CODES.has('R10')).toBe(false);
    expect(STATE_CODES.has('R50')).toBe(false);
  });
});

describe('PADD_CODES', () => {
  it('has 5 PADD codes', () => {
    expect(PADD_CODES.size).toBe(5);
  });

  it('contains correct codes', () => {
    expect(PADD_CODES.has('R10')).toBe(true);
    expect(PADD_CODES.has('R20')).toBe(true);
    expect(PADD_CODES.has('R30')).toBe(true);
    expect(PADD_CODES.has('R40')).toBe(true);
    expect(PADD_CODES.has('R50')).toBe(true);
  });

  it('does not contain state codes', () => {
    expect(PADD_CODES.has('SCA')).toBe(false);
    expect(PADD_CODES.has('NUS')).toBe(false);
  });
});

describe('ABBR_TO_DUOAREA', () => {
  it('maps CA to SCA', () => {
    expect(ABBR_TO_DUOAREA['CA']).toBe('SCA');
  });

  it('maps TX to STX', () => {
    expect(ABBR_TO_DUOAREA['TX']).toBe('STX');
  });

  it('maps NY to SNY', () => {
    expect(ABBR_TO_DUOAREA['NY']).toBe('SNY');
  });
});

describe('abbrToDuoarea', () => {
  it('converts state abbreviation to duoarea code', () => {
    expect(abbrToDuoarea('CA')).toBe('SCA');
    expect(abbrToDuoarea('TX')).toBe('STX');
    expect(abbrToDuoarea('FL')).toBe('SFL');
  });

  it('returns null for unknown abbreviation', () => {
    expect(abbrToDuoarea('XX')).toBeNull();
    expect(abbrToDuoarea('')).toBeNull();
  });
});

describe('isStateCode', () => {
  it('returns true for valid state codes', () => {
    expect(isStateCode('SCA')).toBe(true);
    expect(isStateCode('STX')).toBe(true);
    expect(isStateCode('SNY')).toBe(true);
  });

  it('returns false for PADD codes', () => {
    expect(isStateCode('R10')).toBe(false);
    expect(isStateCode('R50')).toBe(false);
  });

  it('returns false for invalid codes', () => {
    expect(isStateCode('XYZ')).toBe(false);
    expect(isStateCode('')).toBe(false);
    expect(isStateCode('NUS')).toBe(false);
  });
});

describe('isPaddCode', () => {
  it('returns true for valid PADD codes', () => {
    expect(isPaddCode('R10')).toBe(true);
    expect(isPaddCode('R20')).toBe(true);
    expect(isPaddCode('R30')).toBe(true);
    expect(isPaddCode('R40')).toBe(true);
    expect(isPaddCode('R50')).toBe(true);
  });

  it('returns false for state codes', () => {
    expect(isPaddCode('SCA')).toBe(false);
  });

  it('returns false for invalid codes', () => {
    expect(isPaddCode('R60')).toBe(false);
    expect(isPaddCode('')).toBe(false);
    expect(isPaddCode('NUS')).toBe(false);
  });
});

describe('getPaddForState', () => {
  it('returns PADD code for known state', () => {
    expect(getPaddForState('SCA')).toBe('R50');
    expect(getPaddForState('STX')).toBe('R30');
    expect(getPaddForState('SOH')).toBe('R20');
    expect(getPaddForState('SCO')).toBe('R40');
    expect(getPaddForState('SNY')).toBe('R10');
  });

  it('returns null for unknown state', () => {
    expect(getPaddForState('XXX')).toBeNull();
    expect(getPaddForState('')).toBeNull();
  });
});

describe('mapRegion', () => {
  it('maps US to NUS', () => {
    expect(mapRegion('US')).toBe('NUS');
  });

  it('maps NUS to NUS', () => {
    expect(mapRegion('NUS')).toBe('NUS');
  });

  it('passes through unmapped regions', () => {
    expect(mapRegion('R10')).toBe('R10');
    expect(mapRegion('SCA')).toBe('SCA');
    expect(mapRegion('custom')).toBe('custom');
  });
});
