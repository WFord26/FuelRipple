/**
 * EIA duoarea state code → PADD region code, state abbreviation, and full name
 */
export interface StateInfo {
  padd: string;
  abbr: string;
  name: string;
}

export const STATE_INFO: Record<string, StateInfo> = {
  // PADD 1 – East Coast
  SCT: { padd: 'R10', abbr: 'CT', name: 'Connecticut' },
  SDC: { padd: 'R10', abbr: 'DC', name: 'Washington DC' },
  SDE: { padd: 'R10', abbr: 'DE', name: 'Delaware' },
  SFL: { padd: 'R10', abbr: 'FL', name: 'Florida' },
  SGA: { padd: 'R10', abbr: 'GA', name: 'Georgia' },
  SMA: { padd: 'R10', abbr: 'MA', name: 'Massachusetts' },
  SMD: { padd: 'R10', abbr: 'MD', name: 'Maryland' },
  SME: { padd: 'R10', abbr: 'ME', name: 'Maine' },
  SNC: { padd: 'R10', abbr: 'NC', name: 'North Carolina' },
  SNH: { padd: 'R10', abbr: 'NH', name: 'New Hampshire' },
  SNJ: { padd: 'R10', abbr: 'NJ', name: 'New Jersey' },
  SNY: { padd: 'R10', abbr: 'NY', name: 'New York' },
  SPA: { padd: 'R10', abbr: 'PA', name: 'Pennsylvania' },
  SRI: { padd: 'R10', abbr: 'RI', name: 'Rhode Island' },
  SSC: { padd: 'R10', abbr: 'SC', name: 'South Carolina' },
  SVA: { padd: 'R10', abbr: 'VA', name: 'Virginia' },
  SVT: { padd: 'R10', abbr: 'VT', name: 'Vermont' },
  SWV: { padd: 'R10', abbr: 'WV', name: 'West Virginia' },
  // PADD 2 – Midwest
  SIA: { padd: 'R20', abbr: 'IA', name: 'Iowa' },
  SIL: { padd: 'R20', abbr: 'IL', name: 'Illinois' },
  SIN: { padd: 'R20', abbr: 'IN', name: 'Indiana' },
  SKS: { padd: 'R20', abbr: 'KS', name: 'Kansas' },
  SKY: { padd: 'R20', abbr: 'KY', name: 'Kentucky' },
  SMI: { padd: 'R20', abbr: 'MI', name: 'Michigan' },
  SMN: { padd: 'R20', abbr: 'MN', name: 'Minnesota' },
  SMO: { padd: 'R20', abbr: 'MO', name: 'Missouri' },
  SND: { padd: 'R20', abbr: 'ND', name: 'North Dakota' },
  SNE: { padd: 'R20', abbr: 'NE', name: 'Nebraska' },
  SOH: { padd: 'R20', abbr: 'OH', name: 'Ohio' },
  SOK: { padd: 'R20', abbr: 'OK', name: 'Oklahoma' },
  SSD: { padd: 'R20', abbr: 'SD', name: 'South Dakota' },
  STN: { padd: 'R20', abbr: 'TN', name: 'Tennessee' },
  SWI: { padd: 'R20', abbr: 'WI', name: 'Wisconsin' },
  // PADD 3 – Gulf Coast
  SAL: { padd: 'R30', abbr: 'AL', name: 'Alabama' },
  SAR: { padd: 'R30', abbr: 'AR', name: 'Arkansas' },
  SLA: { padd: 'R30', abbr: 'LA', name: 'Louisiana' },
  SMS: { padd: 'R30', abbr: 'MS', name: 'Mississippi' },
  SNM: { padd: 'R30', abbr: 'NM', name: 'New Mexico' },
  STX: { padd: 'R30', abbr: 'TX', name: 'Texas' },
  // PADD 4 – Rocky Mountain
  SCO: { padd: 'R40', abbr: 'CO', name: 'Colorado' },
  SID: { padd: 'R40', abbr: 'ID', name: 'Idaho' },
  SMT: { padd: 'R40', abbr: 'MT', name: 'Montana' },
  SUT: { padd: 'R40', abbr: 'UT', name: 'Utah' },
  SWY: { padd: 'R40', abbr: 'WY', name: 'Wyoming' },
  // PADD 5 – West Coast
  SAK: { padd: 'R50', abbr: 'AK', name: 'Alaska' },
  SAZ: { padd: 'R50', abbr: 'AZ', name: 'Arizona' },
  SCA: { padd: 'R50', abbr: 'CA', name: 'California' },
  SHI: { padd: 'R50', abbr: 'HI', name: 'Hawaii' },
  SNV: { padd: 'R50', abbr: 'NV', name: 'Nevada' },
  SOR: { padd: 'R50', abbr: 'OR', name: 'Oregon' },
  SWA: { padd: 'R50', abbr: 'WA', name: 'Washington' },
};

/** All EIA state duoarea codes (S-prefix, 3 chars) */
export const STATE_CODES = new Set(Object.keys(STATE_INFO));

/** PADD region codes */
export const PADD_CODES = new Set(['R10', 'R20', 'R30', 'R40', 'R50']);

/** Reverse map: 2-letter state abbr (e.g. 'CA') → EIA duoarea code (e.g. 'SCA') */
export const ABBR_TO_DUOAREA: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_INFO).map(([duoarea, info]) => [info.abbr, duoarea])
);

/**
 * Convert a 2-letter state abbreviation to the EIA duoarea code.
 * Returns null if the state is not in the map.
 */
export function abbrToDuoarea(abbr: string): string | null {
  return ABBR_TO_DUOAREA[abbr] ?? null;
}

/** Return true if an EIA duoarea code is a state-level code */
export function isStateCode(code: string): boolean {
  return STATE_CODES.has(code);
}

/** Return true if an EIA duoarea code is a PADD region code */
export function isPaddCode(code: string): boolean {
  return PADD_CODES.has(code);
}

/**
 * Given an EIA state duoarea code (e.g. 'SCA'), return the PADD region code (e.g. 'R50').
 * Returns null if the code is not a known state.
 */
export function getPaddForState(stateCode: string): string | null {
  return STATE_INFO[stateCode]?.padd ?? null;
}

/**
 * Map frontend region codes to EIA database region codes
 */
const REGION_MAP: Record<string, string> = {
  'US': 'NUS',
  'NUS': 'NUS',
};

export function mapRegion(region: string): string {
  return REGION_MAP[region] || region;
}
