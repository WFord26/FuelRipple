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

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  WEEKLY_GAS: 24 * 60 * 60,      // 24 hours
  DAILY_CRUDE: 6 * 60 * 60,      // 6 hours
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
