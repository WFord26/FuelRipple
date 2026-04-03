import { z } from 'zod';

// Energy Price Schema
export const EnergyPriceSchema = z.object({
  time: z.date(),
  source: z.enum(['eia', 'fred', 'oilprice', 'aaa', 'aaa_wayback', 'yahoo', 'estimated']),
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
  score: z.number(),                   // EMA-smoothed z-score
  rawScore: z.number().optional(),     // unsmoothed single-week z-score
  classification: z.enum(['normal', 'elevated', 'high', 'crisis']),
  direction: z.enum(['rising', 'falling', 'stable']).optional(),
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
// Blog Post Metadata Schema
export const BlogPostMetaSchema = z.object({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  publishedAt: z.string(),           // ISO date string
  updatedAt: z.string().optional(),
  author: z.string().default('FuelRipple'),
  tags: z.array(z.string()),
  seoKeywords: z.array(z.string()),
  canonicalPath: z.string(),         // e.g. /blog/padd-regions-explained
  readingMinutes: z.number(),
  featuredImage: z.string().optional(),
});

export type BlogPostMeta = z.infer<typeof BlogPostMetaSchema>;

// ── Dashboard URL Filter State ────────────────────────────────────────────────

export const DashboardFiltersSchema = z.object({
  fuel:      z.enum(['gas_regular', 'diesel']).default('gas_regular'),
  region:    z.string().default('US'),
  timerange: z.enum(['1w', '1m', '3m', '1y', 'all']).default('1m'),
  compare:   z.string().optional(),   // comma-separated regions to overlay
  overlay:   z.enum(['none', 'events', 'crude']).default('none'),
});

export type DashboardFilters = z.infer<typeof DashboardFiltersSchema>;

// ── Dashboard Overview Response ───────────────────────────────────────────────

export const DashboardHeroCardSchema = z.object({
  metric:          z.string(),
  label:           z.string(),
  currentPrice:    z.number().nullable(),
  weekChangePct:   z.number().nullable(),
  monthChangePct:  z.number().nullable(),
  yearChangePct:   z.number().nullable(),
  asOf:            z.string().nullable(),
});

export type DashboardHeroCard = z.infer<typeof DashboardHeroCardSchema>;

export const DashboardSummaryStatsSchema = z.object({
  disruptionScore:          z.number().nullable(),
  disruptionClassification: z.string().nullable(),
  annualizedVolatility:     z.number().nullable(),
  volatilityClassification: z.string().nullable(),
  seasonalDelta:            z.number().nullable(),
  seasonalDeltaPct:         z.number().nullable(),
});

export type DashboardSummaryStats = z.infer<typeof DashboardSummaryStatsSchema>;

export const DashboardAlertSchema = z.object({
  id:       z.string(),
  type:     z.enum(['geo_event', 'supply_health', 'price_spike']),
  severity: z.enum(['info', 'warning', 'critical']),
  title:    z.string(),
  detail:   z.string().optional(),
  asOf:     z.string().optional(),
});

export type DashboardAlert = z.infer<typeof DashboardAlertSchema>;

export const DashboardFreshnessSchema = z.object({
  prices:       z.string().nullable(),
  disruption:   z.string().nullable(),
  supplyHealth: z.string().nullable(),
  events:       z.string().nullable(),
});

export type DashboardFreshness = z.infer<typeof DashboardFreshnessSchema>;

export const DashboardDrilldownSchema = z.object({
  label: z.string(),
  path:  z.string(),
  reason: z.string(),
});

export type DashboardDrilldown = z.infer<typeof DashboardDrilldownSchema>;

export const DashboardOverviewResponseSchema = z.object({
  heroCards:   z.array(DashboardHeroCardSchema),
  summaryStats: DashboardSummaryStatsSchema,
  alerts:      z.array(DashboardAlertSchema),
  freshness:   DashboardFreshnessSchema,
  drilldowns:  z.array(DashboardDrilldownSchema),
  filters:     DashboardFiltersSchema,
});

export type DashboardOverviewResponse = z.infer<typeof DashboardOverviewResponseSchema>;