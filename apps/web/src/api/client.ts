import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || '/api/v1',
  timeout: 30000, // 30s — large historical ranges can be slow
});

// Current prices
export const getCurrentPrices = async (metric = 'gas_regular') => {
  const response = await apiClient.get('/prices/current', { params: { metric } });
  return response.data.data;
};

// Historical prices
export const getHistoricalPrices = async (params: {
  metric?: string;
  region?: string;
  start?: string;
  end?: string;
  granularity?: string;
}) => {
  const response = await apiClient.get('/prices/history', { params });
  return response.data.data;
};

// Regional comparison
export const getRegionalComparison = async (metric = 'gas_regular') => {
  const response = await apiClient.get('/prices/comparison', { params: { metric } });
  return response.data.data;
};

// Disruption score
export const getDisruptionScore = async (metric = 'gas_regular', region = 'US') => {
  const response = await apiClient.get('/disruption/score', { params: { metric, region } });
  return response.data.data;
};

// Volatility index
export const getVolatility = async (metric = 'gas_regular', region = 'US', window = 30) => {
  const response = await apiClient.get('/disruption/volatility', { params: { metric, region, window } });
  return response.data.data;
};

// Fuel cost calculation
export const calculateFuelCost = async (input: any) => {
  const response = await apiClient.post('/impact/fuel-cost', input);
  return response.data.data;
};

// Typical household impact
export const getTypicalImpact = async (region = 'US', baseline?: number) => {
  const response = await apiClient.get('/impact/fuel-cost/typical', {
    params: { region, baseline },
  });
  return response.data.data;
};

// Downstream impact
export const getDownstreamImpact = async (region = 'US', baseline?: number) => {
  const response = await apiClient.get('/impact/downstream', {
    params: { region, baseline },
  });
  return response.data.data;
};

// Economic indicators (BLS/FRED): CPI, CPI Food, PPI Trucking, PPI Freight
export const getEconomicIndicators = async (months = 60) => {
  const response = await apiClient.get('/impact/indicators', { params: { months } });
  return response.data.data as {
    latest: {
      cpi:         { time: string; value: number } | null;
      cpiFood:     { time: string; value: number } | null;
      ppiTrucking: { time: string; value: number } | null;
      ppiFreight:  { time: string; value: number } | null;
    };
    series: {
      cpi:         { date: string; value: number; yoy: number | null }[];
      cpiFood:     { date: string; value: number; yoy: number | null }[];
      ppiTrucking: { date: string; value: number; yoy: number | null }[];
      ppiFreight:  { date: string; value: number; yoy: number | null }[];
    };
  };
};

// Correlation analysis
export const getCrudeGasCorrelation = async (region = 'US', maxLag = 12) => {
  const response = await apiClient.get('/correlation/crude-gas', {
    params: { region, maxLag },
  });
  return response.data.data;
};

// Rockets-and-feathers asymmetry analysis
export const getRocketsAndFeathers = async (region = 'US') => {
  const response = await apiClient.get('/correlation/rockets-feathers', {
    params: { region },
  });
  return response.data;
};

// Price changes and daily consumer spend
export const getPriceChanges = async (metric = 'gas_regular', region = 'NUS') => {
  const response = await apiClient.get('/prices/changes', { params: { metric, region } });
  return response.data.data;
};

// Correlation price series (weekly crude + gas aligned by week for dual-axis charting)
export const getCorrelationPriceSeries = async (region = 'US', weeks = 260) => {
  const response = await apiClient.get('/correlation/price-series', {
    params: { region, weeks },
  });
  return response.data.data as { week: string; gas_value: number; crude_value: number }[];
};

// Events
export const getEvents = async (params?: {
  start?: string;
  end?: string;
  categories?: string;
}) => {
  const response = await apiClient.get('/events', { params });
  return response.data.data;
};

// ── Supply / Refinery ──────────────────────────────────────────────────────

/** Composite supply health for all PADD regions + US */
export const getSupplyHealth = async () => {
  const response = await apiClient.get('/supply/health');
  return response.data;
};

/** Refinery utilization % with 52-week baseline, z-score per region */
export const getSupplyUtilization = async (region?: string) => {
  const response = await apiClient.get('/supply/utilization', { params: region ? { region } : {} });
  return response.data.data;
};

/** Weekly gasoline + distillate inventory levels */
export const getSupplyInventories = async (region = 'US', weeks = 52) => {
  const response = await apiClient.get('/supply/inventories', { params: { region, weeks } });
  return response.data.data;
};

/** Weekly gasoline + distillate production volumes */
export const getSupplyProduction = async (region = 'US', weeks = 52) => {
  const response = await apiClient.get('/supply/production', { params: { region, weeks } });
  return response.data.data;
};

/**
 * Weekly petroleum flow balance: imports, exports, product-supplied (implied demand),
 * and computed import_dependency_pct per region.
 */
export const getSupplyFlow = async (region = 'US', weeks = 52) => {
  const response = await apiClient.get('/supply/flow', { params: { region, weeks } });
  return response.data;
};

/**
 * Annual refinery capacity from EIA Form 820.
 * Optional year param; defaults to most recent year available per region.
 */
export const getSupplyCapacity = async (year?: number) => {
  const response = await apiClient.get('/supply/capacity', { params: year ? { year } : {} });
  return response.data;
};

export default apiClient;
