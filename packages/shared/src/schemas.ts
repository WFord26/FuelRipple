import { z } from 'zod';

// Energy Price Schema
export const EnergyPriceSchema = z.object({
  time: z.date(),
  source: z.enum(['eia', 'fred', 'oilprice', 'aaa', 'yahoo', 'estimated']),
  metric: z.enum(['gas_regular', 'gas_midgrade', 'gas_premium', 'diesel', 'crude_wti', 'crude_brent']),
  region: z.string().default('US'),
  value: z.number(),
  unit: z.enum(['usd_per_gallon', 'usd_per_barrel']),
});

export type EnergyPrice = z.infer<typeof EnergyPriceSchema>;

// API Request Schemas
export const PriceHistoryQuerySchema = z.object({
  metric: z.enum(['gas_regular', 'gas_midgrade', 'gas_premium', 'diesel', 'crude_wti', 'crude_brent']).optional(),
  region: z.string().optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  granularity: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('weekly'),
});

export type PriceHistoryQuery = z.infer<typeof PriceHistoryQuerySchema>;

// Geopolitical Event Schema
export const GeoEventSchema = z.object({
  id: z.number(),
  event_date: z.date(),
  category: z.enum(['opec', 'sanctions', 'hurricane', 'policy', 'other']),
  title: z.string(),
  description: z.string().optional(),
  impact: z.enum(['bullish', 'bearish', 'neutral']).optional(),
});

export type GeoEvent = z.infer<typeof GeoEventSchema>;

// Economic Indicator Schema
export const EconomicIndicatorSchema = z.object({
  time: z.date(),
  indicator: z.enum(['cpi', 'ppi_trucking', 'freight_rate']),
  value: z.number(),
  source: z.string(),
});

export type EconomicIndicator = z.infer<typeof EconomicIndicatorSchema>;

// Disruption Score Schema
export const DisruptionScoreSchema = z.object({
  score: z.number(),
  classification: z.enum(['normal', 'elevated', 'high', 'crisis']),
  weeklyChange: z.number(),
  annualizedVolatility: z.number(),
  timestamp: z.date(),
});

export type DisruptionScore = z.infer<typeof DisruptionScoreSchema>;

// Fuel Cost Calculator Input Schema
export const FuelCostInputSchema = z.object({
  annualMiles: z.number().min(0).default(13500),
  vehicleMPG: z.number().min(1).max(100).default(25.4),
  commuteDistance: z.number().min(0).default(20.5),
  workingDaysPerYear: z.number().min(0).max(365).default(250),
  currentGasPrice: z.number().min(0),
  baselineGasPrice: z.number().min(0).optional(),
});

export type FuelCostInput = z.infer<typeof FuelCostInputSchema>;

// Fuel Cost Calculator Output Schema
export const FuelCostOutputSchema = z.object({
  annualFuelCost: z.number(),
  annualGallons: z.number(),
  priceSensitivity: z.number(),
  commuteCostPerYear: z.number(),
  costVsBaseline: z.number().optional(),
});

export type FuelCostOutput = z.infer<typeof FuelCostOutputSchema>;
