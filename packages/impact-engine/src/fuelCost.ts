import { CONSTANTS, FuelCostInput, FuelCostOutput } from '@fuelripple/shared';

/**
 * Calculate annual fuel cost and sensitivity
 * Based on FHWA and EPA federal data sources
 */
export function calculateFuelCost(input: FuelCostInput): FuelCostOutput {
  const {
    annualMiles,
    vehicleMPG,
    commuteDistance,
    workingDaysPerYear,
    currentGasPrice,
    baselineGasPrice,
  } = input;

  // Calculate annual gallons consumed
  const annualGallons = annualMiles / vehicleMPG;
  
  // Calculate annual fuel cost
  const annualFuelCost = annualGallons * currentGasPrice;
  
  // Price sensitivity (gallons/year)
  const priceSensitivity = annualGallons;
  
  // Calculate commute-specific costs
  const commuteAnnualMiles = commuteDistance * 2 * workingDaysPerYear;
  const commuteGallons = commuteAnnualMiles / vehicleMPG;
  const commuteCostPerYear = commuteGallons * currentGasPrice;
  
  // Calculate cost vs baseline if provided
  let costVsBaseline: number | undefined;
  if (baselineGasPrice !== undefined) {
    const baselineAnnualCost = annualGallons * baselineGasPrice;
    costVsBaseline = annualFuelCost - baselineAnnualCost;
  }
  
  return {
    annualFuelCost,
    annualGallons,
    priceSensitivity,
    commuteCostPerYear,
    costVsBaseline,
  };
}

/**
 * Calculate cost impact per dollar change in gas price
 */
export function calculateDollarImpact(annualMiles: number, vehicleMPG: number): number {
  return annualMiles / vehicleMPG;
}

/**
 * Calculate typical household impact using default values
 */
export function calculateTypicalHouseholdImpact(currentPrice: number, baselinePrice?: number): {
  annualCost: number;
  costPerDollar: number;
  vsBaseline?: number;
} {
  const costPerDollar = CONSTANTS.AVG_ANNUAL_MILES / CONSTANTS.AVG_FLEET_MPG;
  const annualCost = costPerDollar * currentPrice;
  
  let vsBaseline: number | undefined;
  if (baselinePrice !== undefined) {
    vsBaseline = (currentPrice - baselinePrice) * costPerDollar;
  }
  
  return {
    annualCost,
    costPerDollar,
    vsBaseline,
  };
}
