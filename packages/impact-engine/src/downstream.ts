import { CONSTANTS } from '@fuelripple/shared';

/**
 * Calculate freight surcharge per mile based on diesel price
 */
export function calculateFreightSurcharge(currentDieselPrice: number): {
  surchargePerMile: number;
  baselineDiesel: number;
  dieselDelta: number;
} {
  const dieselDelta = currentDieselPrice - CONSTANTS.DIESEL_BASELINE;
  const surchargePerMile = dieselDelta / CONSTANTS.TRUCK_MPG;
  
  return {
    surchargePerMile,
    baselineDiesel: CONSTANTS.DIESEL_BASELINE,
    dieselDelta,
  };
}

/**
 * Estimate freight rate increase percentage
 * Based on $1/gal diesel increase → 15-17¢/mile trucking cost increase
 */
export function estimateFreightRateIncrease(dieselPriceIncrease: number): {
  costPerMileIncrease: number;
  freightRateIncreasePercent: number;
} {
  // 15-17 cents per mile per dollar of diesel increase (using midpoint)
  const costPerMileIncrease = dieselPriceIncrease * 0.16;
  
  // Assuming base freight rate of ~$2.00/mile, this is percentage increase
  const baseFreightRate = 2.0;
  const freightRateIncreasePercent = (costPerMileIncrease / baseFreightRate) * 100;
  
  return {
    costPerMileIncrease,
    freightRateIncreasePercent,
  };
}

/**
 * Estimate consumer goods price increase from freight rate increase
 * 5-10% freight rate increase → 0.5-2% consumer goods price increase
 */
export function estimateCPIImpact(freightRateIncreasePercent: number): {
  minCPIIncrease: number;
  maxCPIIncrease: number;
  avgCPIIncrease: number;
} {
  // Conservative estimate: 1% freight → 0.1% CPI (10:1 ratio)
  const minCPIIncrease = freightRateIncreasePercent * 0.05;
  const maxCPIIncrease = freightRateIncreasePercent * 0.2;
  const avgCPIIncrease = (minCPIIncrease + maxCPIIncrease) / 2;
  
  return {
    minCPIIncrease,
    maxCPIIncrease,
    avgCPIIncrease,
  };
}

/**
 * Calculate food price impact
 * Transportation is ~9% of retail food cost
 */
export function estimateFoodPriceImpact(freightRateIncreasePercent: number): number {
  // Transportation is 9% of food cost, so increase is proportional
  return freightRateIncreasePercent * 0.09;
}

/**
 * Complete diesel-to-consumer pass-through chain
 */
export function calculateDownstreamImpact(
  currentDieselPrice: number,
  baselineDieselPrice: number = CONSTANTS.DIESEL_BASELINE
): {
  diesel: {
    current: number;
    baseline: number;
    increase: number;
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
} {
  const dieselIncrease = currentDieselPrice - baselineDieselPrice;
  
  const surcharge = calculateFreightSurcharge(currentDieselPrice);
  const freightEstimate = estimateFreightRateIncrease(dieselIncrease);
  const cpiImpact = estimateCPIImpact(freightEstimate.freightRateIncreasePercent);
  const foodImpact = estimateFoodPriceImpact(freightEstimate.freightRateIncreasePercent);
  
  return {
    diesel: {
      current: currentDieselPrice,
      baseline: baselineDieselPrice,
      increase: dieselIncrease,
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
  };
}
