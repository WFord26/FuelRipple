import { DisruptionScore } from '@fuelripple/shared';

/**
 * Calculate disruption score based on z-score of weekly price changes.
 *
 * Improvements over naive z-score:
 * - **Direction**: classifies as upward/downward/neutral so consumers know
 *   whether a spike is hurting them (prices rising) or helping.
 * - **3-week EMA smoothing**: reduces noise from single-week data glitches
 *   (e.g. EIA/AAA source mixing within the same time bucket).
 * - **Recalibrated volatility thresholds** for gasoline-specific ranges.
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
  const rawScore = stddev > 0 ? (weeklyChange - mean) / stddev : 0;

  // 3-week EMA smoothed score: if we have at least 3 weeks, compute z-scores
  // for the last 3 weeks and apply exponential weighting (α=0.5).
  const smoothedScore = calculateSmoothedScore(weeklyChanges, mean, stddev, rawScore);

  // Use the smoothed score for classification (more stable)
  const score = smoothedScore;

  // Classify disruption level
  const classification = classifyDisruption(score);

  // Direction: is the disruption hurting or helping consumers?
  const direction = classifyDirection(weeklyChange);

  // Calculate annualized volatility
  const annualizedVolatility = calculateAnnualizedVolatility(weeklyChanges);

  return {
    score,
    rawScore,
    classification,
    direction,
    weeklyChange,
    annualizedVolatility,
    timestamp: new Date(),
  };
}

/**
 * Compute a 3-week exponentially weighted z-score to reduce single-week noise.
 * α = 0.5 ⇒ weights: current 57%, prev 29%, 2-ago 14%.
 */
function calculateSmoothedScore(
  weeklyChanges: number[],
  mean: number,
  stddev: number,
  currentZScore: number
): number {
  if (stddev === 0 || weeklyChanges.length < 3) return currentZScore;

  const alpha = 0.5;
  // weeklyChanges[0] is the most recent, weeklyChanges[1] is previous, etc.
  const z0 = currentZScore;
  const z1 = (weeklyChanges[0] - mean) / stddev;
  const z2 = (weeklyChanges[1] - mean) / stddev;

  // Exponential weights: α, α(1-α), α(1-α)², normalized
  const w0 = alpha;
  const w1 = alpha * (1 - alpha);
  const w2 = alpha * Math.pow(1 - alpha, 2);
  const wSum = w0 + w1 + w2;

  return (w0 * z0 + w1 * z1 + w2 * z2) / wSum;
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
 * Classify the direction of the price move.
 * Consumers care whether prices are rising (pain) or falling (relief).
 */
export function classifyDirection(
  weeklyChange: number
): 'rising' | 'falling' | 'stable' {
  if (weeklyChange > 0.005) return 'rising';   // >0.5% ≈ ~1.5¢/gal
  if (weeklyChange < -0.005) return 'falling';
  return 'stable';
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
 * Get volatility classification — calibrated for US gasoline.
 * Historical gasoline annualized weekly vol:
 *   - Typical range: 10–25%
 *   - Hurricane/OPEC shock: 30–50%
 *   - COVID/GFC era: 50%+
 */
export function getVolatilityClassification(
  annualizedVol: number
): 'calm' | 'moderate' | 'elevated' | 'extreme' {
  if (annualizedVol < 15) return 'calm';
  if (annualizedVol < 30) return 'moderate';
  if (annualizedVol < 50) return 'elevated';
  return 'extreme';
}
