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
  
  let maxCorr = -Infinity;
  let optimalLag = 0;
  
  for (const { lag, correlation } of crossCorrelation) {
    if (Math.abs(correlation) > Math.abs(maxCorr)) {
      maxCorr = correlation;
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
 * Measures asymmetric price transmission
 */
export function analyzeRocketsAndFeathers(
  gasPriceChanges: number[],
  oilPriceChanges: number[]
): {
  avgIncreaseSpeed: number;
  avgDecreaseSpeed: number;
  asymmetryRatio: number;
} {
  if (gasPriceChanges.length !== oilPriceChanges.length) {
    throw new Error('Price change arrays must be same length');
  }
  
  let increaseSpeeds: number[] = [];
  let decreaseSpeeds: number[] = [];
  
  for (let i = 0; i < oilPriceChanges.length; i++) {
    const oilChange = oilPriceChanges[i];
    const gasChange = gasPriceChanges[i];
    
    if (oilChange > 0) {
      increaseSpeeds.push(Math.abs(gasChange));
    } else if (oilChange < 0) {
      decreaseSpeeds.push(Math.abs(gasChange));
    }
  }
  
  const avgIncreaseSpeed = increaseSpeeds.length > 0
    ? increaseSpeeds.reduce((sum, val) => sum + val, 0) / increaseSpeeds.length
    : 0;
    
  const avgDecreaseSpeed = decreaseSpeeds.length > 0
    ? decreaseSpeeds.reduce((sum, val) => sum + val, 0) / decreaseSpeeds.length
    : 0;
  
  const asymmetryRatio = avgDecreaseSpeed > 0 ? avgIncreaseSpeed / avgDecreaseSpeed : 0;
  
  return {
    avgIncreaseSpeed,
    avgDecreaseSpeed,
    asymmetryRatio,
  };
}
