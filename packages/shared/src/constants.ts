// Constants based on federal data sources
export const CONSTANTS = {
  // Average annual miles driven (FHWA Highway Statistics Table VM-1)
  AVG_ANNUAL_MILES: 13500,
  
  // On-road fleet fuel economy (EPA Automotive Trends Report)
  AVG_FLEET_MPG: 25.4,
  
  // Average one-way commute (Census LEHD / ACS Table S0801)
  AVG_COMMUTE_DISTANCE: 20.5,
  
  // Working days per year
  WORKING_DAYS_PER_YEAR: 250,
  
  // Diesel truck fuel economy (Class 8 average)
  TRUCK_MPG: 6.5,
  
  // Diesel baseline for freight surcharge calculation (DOE reference)
  DIESEL_BASELINE: 1.25,

  // Average national dry-van freight rate (DAT/FreightWaves, 2024-25 range)
  BASE_FREIGHT_RATE_PER_MILE: 2.70,

  // Diesel cost-per-mile pass-through: $1/gal → 15-17¢/mile (ATRI midpoint)
  DIESEL_COST_PER_MILE_FACTOR: 0.16,

  // Freight → CPI multipliers (Architecture §4.5.2, BLS PPI):
  //   5-10% freight rate ↑ → 0.5-2% consumer goods ↑
  //   Low:  5% → 0.5% = 0.10 ratio
  //   High: 10% → 2.0% = 0.20 ratio
  CPI_FREIGHT_ELASTICITY_MIN: 0.10,
  CPI_FREIGHT_ELASTICITY_MAX: 0.20,

  // USDA ERS: transportation is ~9% of retail food cost
  FOOD_TRANSPORT_SHARE: 0.09,
  
  // Crude oil price impact on gas prices
  CRUDE_TO_GAS_RATIO: 0.025, // $10/barrel ≈ $0.25/gallon
  
  // Volatility thresholds
  VOLATILITY: {
    CALM: 30,
    MODERATE: 60,
  },
} as const;

// PADD Regions
export const PADD_REGIONS = {
  PADD1: { code: 'R10', name: 'East Coast', states: ['CT', 'DC', 'DE', 'FL', 'GA', 'MA', 'MD', 'ME', 'NC', 'NH', 'NJ', 'NY', 'PA', 'RI', 'SC', 'VA', 'VT', 'WV'] },
  PADD2: { code: 'R20', name: 'Midwest', states: ['IA', 'IL', 'IN', 'KS', 'KY', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'OK', 'SD', 'TN', 'WI'] },
  PADD3: { code: 'R30', name: 'Gulf Coast', states: ['AL', 'AR', 'LA', 'MS', 'NM', 'TX'] },
  PADD4: { code: 'R40', name: 'Rocky Mountain', states: ['CO', 'ID', 'MT', 'UT', 'WY'] },
  PADD5: { code: 'R50', name: 'West Coast', states: ['AK', 'AZ', 'CA', 'HI', 'NV', 'OR', 'WA'] },
} as const;

// EIA Series IDs
export const EIA_SERIES = {
  GAS_REGULAR_US: 'PET.EMM_EPMR_PTE_NUS_DPG.W',
  GAS_PADD1: 'PET.EMM_EPMR_PTE_R10_DPG.W',
  GAS_PADD2: 'PET.EMM_EPMR_PTE_R20_DPG.W',
  GAS_PADD3: 'PET.EMM_EPMR_PTE_R30_DPG.W',
  GAS_PADD4: 'PET.EMM_EPMR_PTE_R40_DPG.W',
  GAS_PADD5: 'PET.EMM_EPMR_PTE_R50_DPG.W',
  GAS_CA: 'PET.EMM_EPMR_PTE_SCA_DPG.W',
  GAS_CO: 'PET.EMM_EPMR_PTE_SCO_DPG.W',
  CRUDE_WTI: 'PET.RWTC.D',
  CRUDE_BRENT: 'PET.RBRTE.D',
  DIESEL_US: 'PET.EMD_EPD2D_PTE_NUS_DPG.W',
} as const;

// FRED Series IDs
export const FRED_SERIES = {
  WTI_CRUDE: 'DCOILWTICO',
  BRENT_CRUDE: 'DCOILBRENTEU',
  CPI_ALL_URBAN: 'CPIAUCSL',
  CPI_FOOD_AT_HOME: 'CUSR0000SAF11',      // BLS – CPI Food at Home (monthly)
  PPI_TRUCK_TRANSPORT: 'PCU484484',
  PPI_FREIGHT_COMMODITY: 'WPU3012',        // BLS – PPI Freight Trucking (commodity, monthly)
  GAS_REGULAR_WEEKLY: 'GASREGW',
} as const;

/**
 * Source priority for price data. Higher numbers = higher priority.
 * AAA is preferred for retail gas prices (daily, state-level granularity).
 * EIA is fallback for historical/weekly aggregate data.
 * Used to resolve conflicts when multiple sources have the same (region, metric).
 */
export const SOURCE_PRIORITY: Record<string, number> = {
  aaa: 100,            // AAA: retail gas prices (daily, all states)
  aaa_wayback: 95,     // AAA historical (Wayback archive)
  eia: 50,             // EIA: weekly aggregates, PADD regions
  fred: 40,            // FRED: secondary crude, economic indicators
  market: 30,          // Market data (Yahoo Finance)
} as const;

/**
 * 2020 US Census population by state abbreviation.
 * Used for population-weighted PADD regional price aggregates.
 * Source: US Census Bureau, 2020 Decennial Census P1 Table.
 */
export const STATE_POPULATIONS: Record<string, number> = {
  AL: 5_024_279,
  AK:   733_391,
  AZ: 7_151_502,
  AR: 3_011_524,
  CA: 39_538_223,
  CO: 5_773_714,
  CT: 3_605_944,
  DC:   689_545,
  DE:   989_948,
  FL: 21_538_187,
  GA: 10_711_908,
  HI: 1_455_271,
  ID: 1_839_106,
  IL: 12_812_508,
  IN: 6_785_528,
  IA: 3_190_369,
  KS: 2_937_880,
  KY: 4_505_836,
  LA: 4_657_757,
  ME: 1_362_359,
  MD: 6_177_224,
  MA: 7_029_917,
  MI: 10_077_331,
  MN: 5_706_494,
  MS: 2_961_279,
  MO: 6_154_913,
  MT: 1_084_225,
  NE: 1_961_504,
  NV: 3_104_614,
  NH: 1_377_529,
  NJ: 9_288_994,
  NM: 2_117_522,
  NY: 20_201_249,
  NC: 10_439_388,
  ND:   779_094,
  OH: 11_799_448,
  OK: 3_959_353,
  OR: 4_237_256,
  PA: 13_002_700,
  RI: 1_097_379,
  SC: 5_118_425,
  SD:   886_667,
  TN: 6_910_840,
  TX: 29_145_505,
  UT: 3_271_616,
  VT:   643_077,
  VA: 8_631_393,
  WA: 7_705_281,
  WV: 1_793_716,
  WI: 5_893_718,
  WY:   576_851,
} as const;

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  WEEKLY_GAS: 24 * 60 * 60,      // 24 hours
  DAILY_CRUDE: 6 * 60 * 60,      // 6 hours
  AAA_NATIONAL: 24 * 60 * 60,    // 24 hours (updates daily at 9 AM ET)
  HISTORICAL: 7 * 24 * 60 * 60,  // 7 days
  DISRUPTION_SCORE: 60 * 60,      // 1 hour
  DOWNSTREAM: 24 * 60 * 60,       // 24 hours
} as const;

// API Rate Limits
export const RATE_LIMITS = {
  EIA_REQUESTS_PER_HOUR: 9000,
  EIA_ROWS_PER_REQUEST: 5000,
  FRED_REQUESTS_PER_MINUTE: 120,
} as const;
