import { DisruptionScore } from '@fuelripple/shared';

/**
 * Calculate disruption score based on z-score of weekly price changes
 */
export function calculateDisruptionScore(
  currentPrice: number,
  previousPrice: number,
  weeklyChanges: number[]
): DisruptionScore {
  // Calculate current week's change
  const weeklyChange = (currentPrice - previousPrice) / previousPrice;
  
  // Calculate statistics from historical changes
  const mean = calculateMean(weeklyChanges);
  const stddev = calculateStdDev(weeklyChanges, mean);
  
  // Calculate z-score
  const score = (weeklyChange - mean) / stddev;
  
  // Classify disruption level
  const classification = classifyDisruption(score);
  
  // Calculate annualized volatility
  const annualizedVolatility = calculateAnnualizedVolatility(weeklyChanges);
  
  return {
    score,
    classification,
    weeklyChange,
    annualizedVolatility,
    timestamp: new Date(),
  };
}

/**
 * Classify disruption score into categories
 */
function classifyDisruption(score: number): 'normal' | 'elevated' | 'high' | 'crisis' {
  const absScore = Math.abs(score);
  
  if (absScore >= 3.0) return 'crisis';
  if (absScore >= 2.0) return 'high';
  if (absScore >= 1.0) return 'elevated';
  return 'normal';
}

/**
 * Calculate annualized volatility from weekly changes
 */
export function calculateAnnualizedVolatility(weeklyChanges: number[]): number {
  // Calculate log returns
  const logReturns = weeklyChanges.map(change => Math.log(1 + change));
  
  // Calculate standard deviation of log returns
  const mean = calculateMean(logReturns);
  const stddev = calculateStdDev(logReturns, mean);
  
  // Annualize (sqrt of 52 weeks)
  return stddev * Math.sqrt(52) * 100;
}

/**
 * Calculate mean of an array
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Get volatility classification
 */
export function getVolatilityClassification(annualizedVol: number): 'calm' | 'moderate' | 'high' {
  if (annualizedVol < 30) return 'calm';
  if (annualizedVol < 60) return 'moderate';
  return 'high';
}
