import { describe, it, expect } from 'vitest';
import { calculateFuelCost, calculateDollarImpact, calculateTypicalHouseholdImpact } from '../fuelCost';

describe('calculateFuelCost', () => {
  it('calculates annual fuel cost correctly', () => {
    const result = calculateFuelCost({
      annualMiles: 13500,
      vehicleMPG: 25.4,
      commuteDistance: 20.5,
      workingDaysPerYear: 250,
      currentGasPrice: 3.50,
    });

    const expectedGallons = 13500 / 25.4;
    expect(result.annualGallons).toBeCloseTo(expectedGallons, 2);
    expect(result.annualFuelCost).toBeCloseTo(expectedGallons * 3.50, 2);
    expect(result.priceSensitivity).toBeCloseTo(expectedGallons, 2);
  });

  it('calculates commute cost correctly', () => {
    const result = calculateFuelCost({
      annualMiles: 13500,
      vehicleMPG: 25,
      commuteDistance: 20,
      workingDaysPerYear: 250,
      currentGasPrice: 4.00,
    });

    // commute: 20 miles * 2 * 250 days = 10000 miles/year
    // commute gallons: 10000 / 25 = 400
    // commute cost: 400 * 4.00 = 1600
    expect(result.commuteCostPerYear).toBeCloseTo(1600, 2);
  });

  it('calculates cost vs baseline when provided', () => {
    const result = calculateFuelCost({
      annualMiles: 10000,
      vehicleMPG: 25,
      commuteDistance: 10,
      workingDaysPerYear: 250,
      currentGasPrice: 4.00,
      baselineGasPrice: 3.00,
    });

    // gallons = 10000 / 25 = 400
    // current cost = 400 * 4 = 1600
    // baseline cost = 400 * 3 = 1200
    // cost vs baseline = 400
    expect(result.costVsBaseline).toBeCloseTo(400, 2);
  });

  it('returns undefined costVsBaseline when no baseline provided', () => {
    const result = calculateFuelCost({
      annualMiles: 10000,
      vehicleMPG: 25,
      commuteDistance: 10,
      workingDaysPerYear: 250,
      currentGasPrice: 3.50,
    });

    expect(result.costVsBaseline).toBeUndefined();
  });

  it('handles zero commute distance', () => {
    const result = calculateFuelCost({
      annualMiles: 10000,
      vehicleMPG: 25,
      commuteDistance: 0,
      workingDaysPerYear: 250,
      currentGasPrice: 3.00,
    });

    expect(result.commuteCostPerYear).toBe(0);
  });

  it('handles high MPG vehicles', () => {
    const result = calculateFuelCost({
      annualMiles: 13500,
      vehicleMPG: 50,
      commuteDistance: 20,
      workingDaysPerYear: 250,
      currentGasPrice: 3.50,
    });

    // 13500 / 50 = 270 gallons, * 3.50 = 945
    expect(result.annualFuelCost).toBeCloseTo(945, 2);
  });
});

describe('calculateDollarImpact', () => {
  it('returns gallons consumed per year', () => {
    // Impact per $1 gas change = annual miles / MPG
    const impact = calculateDollarImpact(13500, 25);
    expect(impact).toBeCloseTo(540, 2);
  });

  it('lower MPG means higher dollar impact', () => {
    const impact15 = calculateDollarImpact(13500, 15);
    const impact30 = calculateDollarImpact(13500, 30);
    expect(impact15).toBeGreaterThan(impact30);
  });
});

describe('calculateTypicalHouseholdImpact', () => {
  it('calculates annual cost with federal defaults', () => {
    const result = calculateTypicalHouseholdImpact(3.50);

    // costPerDollar = 13500 / 25.4 ≈ 531.50
    // annualCost = 531.50 * 3.50 ≈ 1860.24
    expect(result.costPerDollar).toBeCloseTo(13500 / 25.4, 1);
    expect(result.annualCost).toBeCloseTo((13500 / 25.4) * 3.50, 1);
    expect(result.vsBaseline).toBeUndefined();
  });

  it('calculates vs baseline when provided', () => {
    const result = calculateTypicalHouseholdImpact(4.00, 3.00);

    const costPerDollar = 13500 / 25.4;
    expect(result.vsBaseline).toBeCloseTo(costPerDollar, 1);
  });

  it('reports negative vs baseline when current < baseline', () => {
    const result = calculateTypicalHouseholdImpact(3.00, 4.00);

    const costPerDollar = 13500 / 25.4;
    expect(result.vsBaseline).toBeCloseTo(-costPerDollar, 1);
  });
});
