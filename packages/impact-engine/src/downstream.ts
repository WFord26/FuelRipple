import { CONSTANTS } from '@fuelripple/shared';

/**
 * Calculate freight surcharge per mile based on diesel price.
 *
 * DOE fuel-surcharge baseline ($1.25/gal) is the standard industry reference
 * for computing the per-mile surcharge that carriers charge shippers.
 * An optional `baseline` override lets callers use a custom comparison point.
 */
export function calculateFreightSurcharge(
  currentDieselPrice: number,
  baseline: number = CONSTANTS.DIESEL_BASELINE
): {
  surchargePerMile: number;
  baselineDiesel: number;
  dieselDelta: number;
} {
  const dieselDelta = currentDieselPrice - baseline;
  const surchargePerMile = dieselDelta / CONSTANTS.TRUCK_MPG;

  return {
    surchargePerMile,
    baselineDiesel: baseline,
    dieselDelta,
  };
}

/**
 * Estimate freight rate increase percentage.
 *
 * ATRI operational-cost study: $1/gal diesel increase → 15-17¢/mile.
 * Base freight rate sourced from CONSTANTS (national dry-van avg).
 */
export function estimateFreightRateIncrease(dieselPriceIncrease: number): {
  costPerMileIncrease: number;
  freightRateIncreasePercent: number;
} {
  const costPerMileIncrease =
    dieselPriceIncrease * CONSTANTS.DIESEL_COST_PER_MILE_FACTOR;

  const freightRateIncreasePercent =
    (costPerMileIncrease / CONSTANTS.BASE_FREIGHT_RATE_PER_MILE) * 100;

  return {
    costPerMileIncrease,
    freightRateIncreasePercent,
  };
}

/**
 * Estimate consumer-goods CPI increase from freight-rate increase.
 *
 * Architecture §4.5.2 (BLS PPI):
 *   5-10% freight rate ↑ → 0.5-2% consumer goods ↑
 *   Low  ratio: 0.10  (5% → 0.5%)
 *   High ratio: 0.20  (10% → 2.0%)
 */
export function estimateCPIImpact(freightRateIncreasePercent: number): {
  minCPIIncrease: number;
  maxCPIIncrease: number;
  avgCPIIncrease: number;
} {
  const minCPIIncrease =
    freightRateIncreasePercent * CONSTANTS.CPI_FREIGHT_ELASTICITY_MIN;
  const maxCPIIncrease =
    freightRateIncreasePercent * CONSTANTS.CPI_FREIGHT_ELASTICITY_MAX;
  const avgCPIIncrease = (minCPIIncrease + maxCPIIncrease) / 2;

  return { minCPIIncrease, maxCPIIncrease, avgCPIIncrease };
}

/**
 * Calculate food-specific price impact.
 *
 * USDA ERS: ~9% of retail food cost is transportation.
 * Returns the *food-only* price increase — this is a component of overall CPI,
 * not additive to it.
 */
export function estimateFoodPriceImpact(
  freightRateIncreasePercent: number
): number {
  return freightRateIncreasePercent * CONSTANTS.FOOD_TRANSPORT_SHARE;
}

/** Estimated months for each pass-through stage to materialize. */
export const PASS_THROUGH_LAG = {
  freightSurcharge: { min: 0, max: 0.5,  label: '1-2 weeks' },
  consumerGoods:    { min: 2, max: 6,    label: '2-6 months' },
  foodPrices:       { min: 1, max: 3,    label: '1-3 months' },
} as const;

/** Output shape of the complete downstream pass-through chain. */
export interface DownstreamImpact {
  diesel: {
    current: number;
    baseline: number;
    increase: number;
    baselineSource: 'rolling_52w' | 'doe_reference' | 'custom';
  };
  freight: {
    surchargePerMile: number;
    costPerMileIncrease: number;
    rateIncreasePercent: number;
  };
  consumer: {
    minCPIIncrease: number;
    maxCPIIncrease: number;
    avgCPIIncrease: number;
    foodPriceIncrease: number;
  };
  lag: typeof PASS_THROUGH_LAG;
}

/**
 * Complete diesel-to-consumer pass-through chain.
 *
 * @param currentDieselPrice  Current weekly diesel price ($/gal)
 * @param baselineDieselPrice Comparison baseline (52-week-ago price recommended)
 * @param baselineSource      Label for how the baseline was chosen
 */
export function calculateDownstreamImpact(
  currentDieselPrice: number,
  baselineDieselPrice: number = CONSTANTS.DIESEL_BASELINE,
  baselineSource: 'rolling_52w' | 'doe_reference' | 'custom' = 'doe_reference'
): DownstreamImpact {
  const dieselIncrease = currentDieselPrice - baselineDieselPrice;

  const surcharge = calculateFreightSurcharge(currentDieselPrice, baselineDieselPrice);
  const freightEstimate = estimateFreightRateIncrease(dieselIncrease);
  const cpiImpact = estimateCPIImpact(freightEstimate.freightRateIncreasePercent);
  const foodImpact = estimateFoodPriceImpact(
    freightEstimate.freightRateIncreasePercent
  );

  return {
    diesel: {
      current: currentDieselPrice,
      baseline: baselineDieselPrice,
      increase: dieselIncrease,
      baselineSource,
    },
    freight: {
      surchargePerMile: surcharge.surchargePerMile,
      costPerMileIncrease: freightEstimate.costPerMileIncrease,
      rateIncreasePercent: freightEstimate.freightRateIncreasePercent,
    },
    consumer: {
      minCPIIncrease: cpiImpact.minCPIIncrease,
      maxCPIIncrease: cpiImpact.maxCPIIncrease,
      avgCPIIncrease: cpiImpact.avgCPIIncrease,
      foodPriceIncrease: foodImpact,
    },
    lag: PASS_THROUGH_LAG,
  };
}
