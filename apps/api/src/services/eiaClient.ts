import axios from 'axios';
import { EIA_SERIES } from '@fuelripple/shared';

const EIA_BASE_URL = 'https://api.eia.gov/v2';
const API_KEY = process.env.EIA_API_KEY;

if (!API_KEY) {
  console.warn('⚠️  EIA_API_KEY not configured');
}

export interface EIADataPoint {
  period: string;
  value: number;
}

/**
 * Fetch data from EIA API
 */
export async function fetchEIASeries(
  seriesId: string,
  startDate?: string,
  endDate?: string
): Promise<EIADataPoint[]> {
  if (!API_KEY) {
    throw new Error('EIA API key not configured');
  }

  try {
    const params: any = {
      api_key: API_KEY,
      frequency: 'weekly',
      data: ['value'],
      sort: [{ column: 'period', direction: 'desc' }],
    };

    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;

    const response = await axios.get(`${EIA_BASE_URL}/petroleum/pri/spt/data/`, {
      params: {
        ...params,
        'facets[series][]': seriesId,
      },
    });

    return response.data.response.data.map((item: any) => ({
      period: item.period,
      value: parseFloat(item.value),
    }));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('EIA API error:', error.response?.data || error.message);
      throw new Error(`EIA API error: ${error.response?.status}`);
    }
    throw error;
  }
}

/**
 * Fetch gas and diesel retail prices from EIA v2 API
 */
export async function fetchAllGasPrices(startDate?: string, endDate?: string): Promise<{
  series: string;
  region: string;
  data: EIADataPoint[];
}[]> {
  if (!API_KEY) {
    throw new Error('E EIA API key not configured');
  }

  try {
    // Use actual working EIA v2 endpoint for gas/diesel retail prices
    const params: any = {
      api_key: API_KEY,
      frequency: 'weekly',
      'data[0]': 'value',
      'facets[product][]': 'EPM0', // Regular gasoline
      sort: [{ column: 'period', direction: 'desc' }],
    };

    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;

    // Paginate until all records are fetched
    const allApiData: any[] = [];
    let offset = 0;
    const pageSize = 5000;

    while (true) {
      const response = await axios.get(`${EIA_BASE_URL}/petroleum/pri/gnd/data/`, {
        params: { ...params, offset, length: pageSize },
      });

      const page = response.data?.response?.data || [];
      allApiData.push(...page);
      console.log(`EIA API page offset=${offset}: ${page.length} records (total so far: ${allApiData.length})`);

      if (page.length < pageSize) break; // last page
      offset += pageSize;
    }

    console.log(`EIA API returned ${allApiData.length} total data points`);

    // Group by region (both PADD-level R** and state-level S**)
    const regionMap = new Map<string, EIADataPoint[]>();

    for (const item of allApiData) {
      const region = item.duoarea || item.area || 'US';
      if (!regionMap.has(region)) {
        regionMap.set(region, []);
      }
      regionMap.get(region)!.push({
        period: item.period,
        value: parseFloat(item.value),
      });
    }

    // Convert to format expected by caller
    const results: { series: string; region: string; data: EIADataPoint[] }[] = [];
    for (const [region, data] of regionMap.entries()) {
      results.push({
        series: `gas-retail-${region}`,
        region,
        data,
      });
    }

    console.log(`Processed into ${results.length} regional datasets`);
    return results;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('EIA API error:', error.response?.data || error.message);
      console.error('Request URL:', error.config?.url);
      console.error('Request params:', error.config?.params);
    }
    throw error;
  }
}

/**
 * Fetch crude oil prices (WTI and Brent spot prices)
 */
export async function fetchCrudePrices(startDate?: string, endDate?: string): Promise<{
  wti: EIADataPoint[];
  brent: EIADataPoint[];
}> {
  if (!API_KEY) {
    throw new Error('EIA API key not configured');
  }

  try {
    const params: any = {
      api_key: API_KEY,
      frequency: 'weekly',
      'data[0]': 'value',
      sort: [{ column: 'period', direction: 'desc' }],
      offset: 0,
      length: 500,
    };

    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;

    // Fetch WTI (Cushing, OK spot price)
    const wtiResponse = await axios.get(`${EIA_BASE_URL}/petroleum/pri/spt/data/`, {
      params: {
        ...params,
        'facets[series][]': 'RWTC', // WTI Cushing spot price
      },
    });

    // Fetch Brent (Europe spot price)
    const brentResponse = await axios.get(`${EIA_BASE_URL}/petroleum/pri/spt/data/`, {
      params: {
        ...params,
        'facets[series][]': 'RBRTE', // Brent Europe spot price
      },
    });

    const wtiData = wtiResponse.data?.response?.data || [];
    const brentData = brentResponse.data?.response?.data || [];

    console.log(`Fetched ${wtiData.length} WTI points, ${brentData.length} Brent points`);

    return {
      wti: wtiData.map((item: any) => ({
        period: item.period,
        value: parseFloat(item.value),
      })),
      brent: brentData.map((item: any) => ({
        period: item.period,
        value: parseFloat(item.value),
      })),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('EIA API error fetching crude:', error.response?.data || error.message);
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Refinery / Supply-side data (EIA Weekly Petroleum Status Report)
// All series live at: /petroleum/sum/sndw/data/ (Weekly Supply Estimates)
// Published every Monday ~5 PM ET at the same time as retail gas prices.
//
// Confirmed facet codes (verified against live API March 2026):
//   process YUP  = % Utilization Refinery Operable Capacity  (PADD regions only; NUS via WPULEUS3)
//   process YIY  = Refinery Net Input (crude oil inputs, k bbl/day)
//   process YPT  = Production (gasoline, k bbl/day)
//   process SAE  = Ending Stocks (gasoline + distillate, k bbl)
//   product EPM0F = Finished Motor Gasoline
//   product EPM0  = Total Gasoline  (for stocks)
//   product EPD0  = Distillate Fuel Oil (for stocks)
//   product EPC0  = Crude Oil (for crude inputs)
// ─────────────────────────────────────────────────────────────────────────────

export interface RefineryDataPoint {
  period: string;
  region: string;
  utilization_pct?: number;
  crude_inputs?: number;
  gasoline_production?: number;
  distillate_production?: number;
  gasoline_stocks?: number;
  distillate_stocks?: number;
  // Flow data (imports / exports / product-supplied)
  gasoline_imports?: number;
  distillate_imports?: number;
  crude_imports?: number;
  total_exports?: number;
  product_supplied_gas?: number;
  product_supplied_dist?: number;
}

export interface CapacityDataPoint {
  year: number;
  region: string;
  operable_capacity?: number;
  operating_capacity?: number;
  idle_capacity?: number;
  shutdown_capacity?: number;
}

/** Single-value EIA v2 fetch with pagination and 429 retry */
async function fetchEIAv2Series(
  extraParams: Record<string, string>,
  startDate?: string,
  endDate?: string,
): Promise<any[]> {
  if (!API_KEY) throw new Error('EIA API key not configured');

  const baseParams: Record<string, any> = {
    api_key: API_KEY,
    frequency: 'weekly',
    'data[0]': 'value',
    'sort[0][column]': 'period',
    'sort[0][direction]': 'desc',
    ...extraParams,
  };
  if (startDate) baseParams.start = startDate;
  if (endDate) baseParams.end = endDate;

  const allRows: any[] = [];
  let offset = 0;
  const pageSize = 5000;

  while (true) {
    let attempt = 0;
    let page: any[] = [];

    while (attempt < 5) {
      try {
        const response = await axios.get(`${EIA_BASE_URL}/petroleum/sum/sndw/data/`, {
          params: { ...baseParams, offset, length: pageSize },
        });
        page = response.data?.response?.data ?? [];
        break;
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 429) {
          const retryAfter = parseInt(err.response.headers['retry-after'] ?? '5', 10);
          const delay = Math.max(retryAfter, 2) * 1000 * (attempt + 1);
          console.warn(`  EIA 429 rate limit — waiting ${delay / 1000}s (attempt ${attempt + 1})`);
          await new Promise(r => setTimeout(r, delay));
          attempt++;
        } else {
          throw err;
        }
      }
    }

    allRows.push(...page);
    console.log(`  EIA sndw offset=${offset}: ${page.length} rows`);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return allRows;
}

/** Merge raw API rows into RefineryDataPoint map keyed on (period|region) */
function mergeRefineryRows(
  map: Map<string, RefineryDataPoint>,
  rows: any[],
  setter: (point: RefineryDataPoint, val: number, row: any) => void,
) {
  for (const row of rows) {
    const region = row.duoarea === 'NUS' ? 'US' : row.duoarea;
    const key = `${row.period}|${region}`;
    if (!map.has(key)) {
      map.set(key, { period: row.period, region });
    }
    const val = parseFloat(row.value);
    if (!isNaN(val)) setter(map.get(key)!, val, row);
  }
}

/**
 * Fetch refinery utilization % and crude oil inputs by PADD + national.
 * - Utilization: process=YUP (PADD R10–R50); series=WPULEUS3 (US total)
 * - Crude inputs: process=YIY, product=EPC0 (all regions)
 */
export async function fetchRefineryUtilization(
  startDate?: string,
  endDate?: string,
): Promise<RefineryDataPoint[]> {
  console.log('Fetching refinery utilization + crude inputs from EIA WPSR...');

  const [paddUtil, usUtil, crudeInputs] = await Promise.all([
    // PADD-level utilization (R10–R50 only — NUS is a separate series)
    fetchEIAv2Series({ 'facets[process][]': 'YUP' }, startDate, endDate),
    // US national utilization
    fetchEIAv2Series({ 'facets[series][]': 'WPULEUS3' }, startDate, endDate),
    // Crude oil inputs (all regions)
    fetchEIAv2Series({
      'facets[process][]': 'YIY',
      'facets[product][]': 'EPC0',
    }, startDate, endDate),
  ]);

  const map = new Map<string, RefineryDataPoint>();
  mergeRefineryRows(map, paddUtil, (p, v) => { p.utilization_pct = v; });
  mergeRefineryRows(map, usUtil,   (p, v) => { p.utilization_pct = v; });
  mergeRefineryRows(map, crudeInputs, (p, v) => { p.crude_inputs = v; });

  console.log(`Utilization: ${map.size} region-week points`);
  return Array.from(map.values());
}

/**
 * Fetch gasoline + distillate production volumes (US national only).
 * - Gasoline:   process=YPT, product=EPM0F  (Finished Motor Gasoline)
 * - Distillate: series=WDIIRPUS2            (US distillate production)
 */
export async function fetchRefineryProduction(
  startDate?: string,
  endDate?: string,
): Promise<RefineryDataPoint[]> {
  console.log('Fetching refinery production from EIA WPSR...');

  const [gasRows, distRows] = await Promise.all([
    fetchEIAv2Series({
      'facets[process][]': 'YPT',
      'facets[product][]': 'EPM0F',
      'facets[duoarea][]': 'NUS',
    }, startDate, endDate),
    // Distillate: process=YPR (Refinery and Blender Net Production), product=EPD0
    fetchEIAv2Series({
      'facets[process][]': 'YPR',
      'facets[product][]': 'EPD0',
      'facets[duoarea][]': 'NUS',
    }, startDate, endDate),
  ]);

  const map = new Map<string, RefineryDataPoint>();
  mergeRefineryRows(map, gasRows,  (p, v) => { p.gasoline_production    = v; });
  mergeRefineryRows(map, distRows, (p, v) => { p.distillate_production  = v; });

  console.log(`Production: ${map.size} region-week points`);
  return Array.from(map.values());
}

/**
 * Fetch weekly gasoline + distillate stock levels by PADD + national.
 * - Gasoline stocks:   process=SAE, product=EPM0  (Total Gasoline)
 * - Distillate stocks: process=SAE, product=EPD0  (Distillate Fuel Oil)
 */
export async function fetchPetroleumStocks(
  startDate?: string,
  endDate?: string,
): Promise<RefineryDataPoint[]> {
  console.log('Fetching petroleum stocks from EIA WPSR...');

  const [gasStocks, distStocks] = await Promise.all([
    fetchEIAv2Series({
      'facets[process][]': 'SAE',
      'facets[product][]': 'EPM0',
    }, startDate, endDate),
    fetchEIAv2Series({
      'facets[process][]': 'SAE',
      'facets[product][]': 'EPD0',
    }, startDate, endDate),
  ]);

  const map = new Map<string, RefineryDataPoint>();
  mergeRefineryRows(map, gasStocks,  (p, v) => { p.gasoline_stocks   = v; });
  mergeRefineryRows(map, distStocks, (p, v) => { p.distillate_stocks = v; });

  console.log(`Stocks: ${map.size} region-week points`);
  return Array.from(map.values());
}

/**
 * Fetch weekly petroleum imports by region (EIA WPSR).
 * - Gasoline imports:   process=IM0, product=EPM0
 * - Distillate imports: process=IM0, product=EPD0
 * - Crude oil imports:  process=IM0, product=EPC0
 */
export async function fetchPetroleumImports(
  startDate?: string,
  endDate?: string,
): Promise<RefineryDataPoint[]> {
  console.log('Fetching petroleum imports from EIA WPSR...');

  const [gasImports, distImports, crudeImports] = await Promise.all([
    fetchEIAv2Series({ 'facets[process][]': 'IM0', 'facets[product][]': 'EPM0' }, startDate, endDate),
    fetchEIAv2Series({ 'facets[process][]': 'IM0', 'facets[product][]': 'EPD0' }, startDate, endDate),
    fetchEIAv2Series({ 'facets[process][]': 'IM0', 'facets[product][]': 'EPC0' }, startDate, endDate),
  ]);

  const map = new Map<string, RefineryDataPoint>();
  mergeRefineryRows(map, gasImports,   (p, v) => { p.gasoline_imports   = v; });
  mergeRefineryRows(map, distImports,  (p, v) => { p.distillate_imports = v; });
  mergeRefineryRows(map, crudeImports, (p, v) => { p.crude_imports       = v; });

  console.log(`Imports: ${map.size} region-week points`);
  return Array.from(map.values());
}

/**
 * Fetch weekly petroleum exports (national) and product-supplied (implied demand).
 * - Exports:                   process=EXP, product=EP (total petroleum)
 * - Product supplied gasoline:  process=VPP, product=EPM0
 * - Product supplied distillate: process=VPP, product=EPD0
 */
export async function fetchFlowBalance(
  startDate?: string,
  endDate?: string,
): Promise<RefineryDataPoint[]> {
  console.log('Fetching exports + product-supplied from EIA WPSR...');

  const [exports_, psGas, psDist] = await Promise.all([
    fetchEIAv2Series({ 'facets[process][]': 'EXP', 'facets[product][]': 'EP' }, startDate, endDate),
    fetchEIAv2Series({ 'facets[process][]': 'VPP', 'facets[product][]': 'EPM0' }, startDate, endDate),
    fetchEIAv2Series({ 'facets[process][]': 'VPP', 'facets[product][]': 'EPD0' }, startDate, endDate),
  ]);

  const map = new Map<string, RefineryDataPoint>();
  mergeRefineryRows(map, exports_, (p, v) => { p.total_exports          = v; });
  mergeRefineryRows(map, psGas,    (p, v) => { p.product_supplied_gas   = v; });
  mergeRefineryRows(map, psDist,   (p, v) => { p.product_supplied_dist  = v; });

  console.log(`Flow balance: ${map.size} region-week points`);
  return Array.from(map.values());
}

/**
 * Fetch annual refinery capacity data (EIA Form 820).
 * Endpoint: /petroleum/sum/cap/data/ — annual operable refinery capacity by PADD.
 * Gracefully returns [] if the endpoint or facets return no data.
 */
export async function fetchRefineryCapacity820(
  year?: number,
): Promise<CapacityDataPoint[]> {
  if (!API_KEY) throw new Error('EIA API key not configured');
  console.log('Fetching EIA-820 annual refinery capacity...');

  try {
    // Build params for the annual capacity endpoint
    const baseParams: Record<string, any> = {
      api_key: API_KEY,
      frequency: 'annual',
      'data[0]': 'value',
      'sort[0][column]': 'period',
      'sort[0][direction]': 'desc',
      offset: 0,
      length: 500,
    };
    if (year) baseParams.start = String(year);

    // Fetch operable, operating, and idle capacity in parallel
    // process=CAP1 = total operable, CAP2 = operating, CAP3 = idle, CAP4 = shutdown
    const fetchCap = async (process: string) => {
      let attempt = 0;
      while (attempt < 5) {
        try {
          const resp = await axios.get(`${EIA_BASE_URL}/petroleum/sum/cap/data/`, {
            params: { ...baseParams, 'facets[process][]': process },
          });
          return resp.data?.response?.data ?? [];
        } catch (err: any) {
          if (axios.isAxiosError(err) && err.response?.status === 429) {
            const delay = Math.max(parseInt(err.response.headers['retry-after'] ?? '5', 10), 2) * 1000 * (attempt + 1);
            console.warn(`  EIA 429 (capacity) — waiting ${delay / 1000}s`);
            await new Promise(r => setTimeout(r, delay));
            attempt++;
          } else if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 400)) {
            console.warn(`  EIA-820 capacity endpoint returned ${err.response.status} for process=${process} — skipping`);
            return [];
          } else {
            throw err;
          }
        }
      }
      return [];
    };

    const [operable, operating, idle, shutdown] = await Promise.all([
      fetchCap('CAP1'),
      fetchCap('CAP2'),
      fetchCap('CAP3'),
      fetchCap('CAP4'),
    ]);

    // Merge into CapacityDataPoint map keyed by (year|region)
    const map = new Map<string, CapacityDataPoint>();
    const ensure = (period: string, duoarea: string): CapacityDataPoint => {
      const yr = parseInt(period.substring(0, 4), 10);
      const region = duoarea === 'NUS' ? 'US' : duoarea;
      const key = `${yr}|${region}`;
      if (!map.has(key)) map.set(key, { year: yr, region });
      return map.get(key)!;
    };

    for (const row of operable)  { const p = ensure(row.period, row.duoarea); if (!isNaN(parseFloat(row.value))) p.operable_capacity  = parseFloat(row.value); }
    for (const row of operating) { const p = ensure(row.period, row.duoarea); if (!isNaN(parseFloat(row.value))) p.operating_capacity = parseFloat(row.value); }
    for (const row of idle)      { const p = ensure(row.period, row.duoarea); if (!isNaN(parseFloat(row.value))) p.idle_capacity      = parseFloat(row.value); }
    for (const row of shutdown)  { const p = ensure(row.period, row.duoarea); if (!isNaN(parseFloat(row.value))) p.shutdown_capacity  = parseFloat(row.value); }

    const results = Array.from(map.values());
    console.log(`EIA-820 capacity: ${results.length} region-year points`);
    return results;
  } catch (err) {
    console.error('EIA-820 capacity fetch failed (non-fatal):', (err as any).message ?? err);
    return [];
  }
}

/**
 * Fetch diesel retail prices
 */
export async function fetchDieselPrices(startDate?: string, endDate?: string): Promise<{
  series: string;
  region: string;
  data: EIADataPoint[];
}> {
  if (!API_KEY) {
    throw new Error('EIA API key not configured');
  }

  try {
    const params: any = {
      api_key: API_KEY,
      frequency: 'weekly',
      'data[0]': 'value',
      'facets[product][]': 'EPD2D', // No. 2 Diesel Retail Prices
      'facets[duoarea][]': 'NUS', // National US
      sort: [{ column: 'period', direction: 'desc' }],
      offset: 0,
      length: 500,
    };

    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;

    const response = await axios.get(`${EIA_BASE_URL}/petroleum/pri/gnd/data/`, {
      params,
    });

    const apiData = response.data?.response?.data || [];
    console.log(`Fetched ${apiData.length} diesel price points`);

    return {
      series: 'diesel-retail-us',
      region: 'US',
      data: apiData.map((item: any) => ({
        period: item.period,
        value: parseFloat(item.value),
      })),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('EIA API error fetching diesel:', error.response?.data || error.message);
    }
    throw error;
  }
}
