import { CONSTANTS } from '@fuelripple/shared';

/**
 * Calculate crude oil to gas price correlation
 */
export function calculateCorrelation(gasPrices: number[], oilPrices: number[]): number {
  if (gasPrices.length !== oilPrices.length || gasPrices.length === 0) {
    return 0;
  }
  
  const n = gasPrices.length;
  const meanGas = gasPrices.reduce((sum, val) => sum + val, 0) / n;
  const meanOil = oilPrices.reduce((sum, val) => sum + val, 0) / n;
  
  let numerator = 0;
  let sumSqGas = 0;
  let sumSqOil = 0;
  
  for (let i = 0; i < n; i++) {
    const diffGas = gasPrices[i] - meanGas;
    const diffOil = oilPrices[i] - meanOil;
    numerator += diffGas * diffOil;
    sumSqGas += diffGas * diffGas;
    sumSqOil += diffOil * diffOil;
  }
  
  const denominator = Math.sqrt(sumSqGas * sumSqOil);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Calculate cross-correlation at different lags
 */
export function calculateCrossCorrelation(
  gasPrices: number[],
  oilPrices: number[],
  maxLag: number = 12
): { lag: number; correlation: number }[] {
  const results: { lag: number; correlation: number }[] = [];
  
  for (let lag = 0; lag <= maxLag; lag++) {
    if (lag >= oilPrices.length) break;
    
    const laggedOil = oilPrices.slice(0, oilPrices.length - lag);
    const alignedGas = gasPrices.slice(lag);
    
    const correlation = calculateCorrelation(alignedGas, laggedOil);
    results.push({ lag, correlation });
  }
  
  return results;
}

/**
 * Find optimal lag (where correlation is highest)
 */
export function findOptimalLag(crossCorrelation: { lag: number; correlation: number }[]): number {
  if (crossCorrelation.length === 0) return 0;
  
  let maxAbsCorr = -1;
  let optimalLag = 0;
  
  for (const { lag, correlation } of crossCorrelation) {
    const absCorr = Math.abs(correlation);
    if (absCorr > maxAbsCorr) {
      maxAbsCorr = absCorr;
      optimalLag = lag;
    }
  }
  
  return optimalLag;
}

/**
 * Estimate gas price change from crude oil change
 * Using rule of thumb: $10/barrel ≈ $0.25/gallon
 */
export function estimateGasPriceFromCrude(crudeChange: number): number {
  return crudeChange * CONSTANTS.CRUDE_TO_GAS_RATIO;
}

/**
 * Rockets and Feathers analysis
 * Measures asymmetric price transmission between crude oil and gasoline.
 *
 * Two dimensions of asymmetry are measured:
 *
 * 1. **Elasticity asymmetry** — When crude rises, how much does gas move per
 *    1% of crude change vs when crude falls? A ratio > 1 means gas is more
 *    responsive to crude increases ("rockets up").
 *
 * 2. **Cumulative pass-through** — After a crude price shock, how much of the
 *    change has been reflected at the pump after 1, 2, 3, 4 weeks? If crude
 *    drops are passed through more slowly, the cumulative curve for decreases
 *    will lag behind the increases curve — the classic feather effect.
 *
 * The function accepts week-over-week *percentage changes* for gas and oil,
 * aligned by week (same array index = same week).
 */
export function analyzeRocketsAndFeathers(
  gasPriceChanges: number[],
  oilPriceChanges: number[]
): {
  avgIncreaseSpeed: number;
  avgDecreaseSpeed: number;
  asymmetryRatio: number;
  riseElasticity: number;
  fallElasticity: number;
  elasticityRatio: number;
  cumulativePassThrough: {
    lag: number;
    risePct: number;
    fallPct: number;
  }[];
  riseHalfLifeWeeks: number;
  fallHalfLifeWeeks: number;
} {
  if (gasPriceChanges.length !== oilPriceChanges.length) {
    throw new Error('Price change arrays must be same length');
  }

  const n = gasPriceChanges.length;

  // ── 1. Same-week speed (legacy metric, kept for backward compat) ──
  let increaseSpeeds: number[] = [];
  let decreaseSpeeds: number[] = [];

  // ── 2. Elasticity: gasΔ% / oilΔ% for up vs down weeks ──
  let riseElasticities: number[] = [];
  let fallElasticities: number[] = [];

  for (let i = 0; i < n; i++) {
    const oilChange = oilPriceChanges[i];
    const gasChange = gasPriceChanges[i];

    if (oilChange > 0.001) {
      // Crude rose — gas should rise; record magnitude AND elasticity
      increaseSpeeds.push(Math.abs(gasChange));
      riseElasticities.push(gasChange / oilChange);
    } else if (oilChange < -0.001) {
      // Crude fell — gas should fall; record magnitude AND elasticity
      decreaseSpeeds.push(Math.abs(gasChange));
      // For a negative oil change, gasChange should be negative too.
      // Elasticity = gasΔ / oilΔ — both negative ⇒ positive ratio.
      fallElasticities.push(gasChange / oilChange);
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  const avgIncreaseSpeed = avg(increaseSpeeds);
  const avgDecreaseSpeed = avg(decreaseSpeeds);
  const asymmetryRatio = avgDecreaseSpeed > 0 ? avgIncreaseSpeed / avgDecreaseSpeed : 0;

  const riseElasticity = avg(riseElasticities);
  const fallElasticity = avg(fallElasticities);
  const elasticityRatio = fallElasticity > 0 ? riseElasticity / fallElasticity : 0;

  // ── 3. Cumulative pass-through at multiple lags ──
  // For each significant crude shock, measure the cumulative gas response
  // over the next 0–4 weeks and normalize by the total gas adjustment that
  // ultimately occurs (window = 6 weeks).
  const MAX_LAG = 4;
  const WINDOW = 6; // total response window to define "full" pass-through
  const SHOCK_THRESHOLD = 0.005; // 0.5% min crude move to count as a shock

  // Track cumulative fractions at each lag (0 = same week, 1 = +1 week, ...)
  let riseCumFractions: number[][] = Array.from({ length: MAX_LAG + 1 }, () => []);
  let fallCumFractions: number[][] = Array.from({ length: MAX_LAG + 1 }, () => []);

  for (let i = 0; i < n; i++) {
    const oilΔ = oilPriceChanges[i];
    if (Math.abs(oilΔ) < SHOCK_THRESHOLD) continue;
    if (i + WINDOW >= n) continue; // need enough future data

    // Total gas response over the full window
    let totalGasResponse = 0;
    for (let w = 0; w < WINDOW; w++) {
      totalGasResponse += gasPriceChanges[i + w];
    }

    // Skip if total response is negligible (avoids divide-by-zero)
    if (Math.abs(totalGasResponse) < 0.0001) continue;

    // Cumulative fraction at each lag
    let cumGas = 0;
    for (let lag = 0; lag <= MAX_LAG; lag++) {
      cumGas += gasPriceChanges[i + lag];
      const fraction = Math.min(Math.max(cumGas / totalGasResponse, 0), 1);

      if (oilΔ > 0) {
        riseCumFractions[lag].push(fraction);
      } else {
        fallCumFractions[lag].push(fraction);
      }
    }
  }

  const cumulativePassThrough = Array.from({ length: MAX_LAG + 1 }, (_, lag) => ({
    lag,
    risePct: avg(riseCumFractions[lag]) * 100,
    fallPct: avg(fallCumFractions[lag]) * 100,
  }));

  // ── 4. Half-life: weeks until 50% pass-through ──
  const halfLife = (cumPcts: { lag: number; pct: number }[]): number => {
    for (const { lag, pct } of cumPcts) {
      if (pct >= 50) return lag;
    }
    return MAX_LAG + 1; // not reached within window
  };

  const riseHalfLifeWeeks = halfLife(
    cumulativePassThrough.map((c) => ({ lag: c.lag, pct: c.risePct }))
  );
  const fallHalfLifeWeeks = halfLife(
    cumulativePassThrough.map((c) => ({ lag: c.lag, pct: c.fallPct }))
  );

  return {
    avgIncreaseSpeed,
    avgDecreaseSpeed,
    asymmetryRatio,
    riseElasticity,
    fallElasticity,
    elasticityRatio,
    cumulativePassThrough,
    riseHalfLifeWeeks,
    fallHalfLifeWeeks,
  };
}
