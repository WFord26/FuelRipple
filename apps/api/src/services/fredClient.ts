import axios from 'axios';
import { FRED_SERIES } from '@fuelripple/shared';

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';
const API_KEY = process.env.FRED_API_KEY;

if (!API_KEY) {
  console.warn('⚠️  FRED_API_KEY not configured');
}

export interface FREDDataPoint {
  date: string;
  value: string;
}

/**
 * Fetch data from FRED API
 */
export async function fetchFREDSeries(
  seriesId: string,
  startDate?: string,
  endDate?: string
): Promise<FREDDataPoint[]> {
  if (!API_KEY) {
    throw new Error('FRED API key not configured');
  }

  try {
    const params: any = {
      api_key: API_KEY,
      series_id: seriesId,
      file_type: 'json',
      sort_order: 'desc',
    };

    if (startDate) params.observation_start = startDate;
    if (endDate) params.observation_end = endDate;

    const response = await axios.get(FRED_BASE_URL, { params });

    return response.data.observations
      .filter((obs: any) => obs.value !== '.')
      .map((obs: any) => ({
        date: obs.date,
        value: obs.value,
      }));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('FRED API error:', error.response?.data || error.message);
      throw new Error(`FRED API error: ${error.response?.status}`);
    }
    throw error;
  }
}

/**
 * Fetch economic indicators
 */
export async function fetchEconomicIndicators(startDate?: string, endDate?: string): Promise<{
  cpi: FREDDataPoint[];
  cpiFoodAtHome: FREDDataPoint[];
  ppiTrucking: FREDDataPoint[];
  ppiFreightCommodity: FREDDataPoint[];
  gasRegular: FREDDataPoint[];
}> {
  const [cpi, cpiFoodAtHome, ppiTrucking, ppiFreightCommodity, gasRegular] = await Promise.all([
    fetchFREDSeries(FRED_SERIES.CPI_ALL_URBAN, startDate, endDate),
    fetchFREDSeries(FRED_SERIES.CPI_FOOD_AT_HOME, startDate, endDate),
    fetchFREDSeries(FRED_SERIES.PPI_TRUCK_TRANSPORT, startDate, endDate),
    fetchFREDSeries(FRED_SERIES.PPI_FREIGHT_COMMODITY, startDate, endDate),
    fetchFREDSeries(FRED_SERIES.GAS_REGULAR_WEEKLY, startDate, endDate),
  ]);

  return { cpi, cpiFoodAtHome, ppiTrucking, ppiFreightCommodity, gasRegular };
}

/**
 * Fetch crude oil prices from FRED (alternative source)
 */
export async function fetchCrudePricesFromFRED(startDate?: string, endDate?: string): Promise<{
  wti: FREDDataPoint[];
  brent: FREDDataPoint[];
}> {
  const [wti, brent] = await Promise.all([
    fetchFREDSeries(FRED_SERIES.WTI_CRUDE, startDate, endDate),
    fetchFREDSeries(FRED_SERIES.BRENT_CRUDE, startDate, endDate),
  ]);

  return { wti, brent };
}
