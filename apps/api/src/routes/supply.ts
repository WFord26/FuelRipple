import { Router, Request, Response, NextFunction } from 'express';
import { getFromCache, setInCache } from '../services/cache';
import {
  getUtilizationByRegion,
  getProductionData,
  getInventoryData,
  getSupplyHealth,
  getFlowData,
  getCapacityData,
} from '@fuelripple/db';

const router = Router();

const CACHE_TTL = 60 * 60; // 1 hour — data refreshes weekly on Mondays

/**
 * GET /api/v1/supply/utilization
 * Returns current refinery utilization % by PADD region (+ national),
 * with 52-week average, stddev, and a stress z-score for each region.
 *
 * Optional query: ?region=R30 to filter to a single PADD.
 *
 * Stress z-score interpretation (from architecture §4.6.1):
 *   > -0.5σ        = Normal operations
 *   -0.5σ to -1.5σ = Elevated risk
 *   -1.5σ to -2.5σ = Supply stress
 *   < -2.5σ        = Critical disruption
 */
router.get('/utilization', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = req.query.region as string | undefined;
    const cacheKey = `supply:utilization:${region ?? 'all'}`;

    const cached = await getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await getUtilizationByRegion(region);

    const payload = {
      data,
      meta: {
        description: 'Refinery utilization % with 52-week baseline and stress z-score',
        stressThresholds: {
          normal:        'z > -0.5',
          elevated_risk: '-1.5 < z ≤ -0.5',
          supply_stress: '-2.5 < z ≤ -1.5',
          critical:      'z ≤ -2.5',
        },
      },
    };

    await setInCache(cacheKey, payload, CACHE_TTL);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/supply/production
 * Weekly gasoline + distillate production volumes (national).
 * Includes 4-week rolling average and year-ago comparison.
 *
 * Query params:
 *   ?region=US  (default; only US national available from EIA)
 *   ?weeks=52   (history window, default 52)
 */
router.get('/production', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = (req.query.region as string) || 'US';
    const weeks  = parseInt((req.query.weeks as string) || '52', 10);
    const cacheKey = `supply:production:${region}:${weeks}`;

    const cached = await getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await getProductionData(region, weeks);

    const payload = {
      region,
      data,
      meta: {
        description: 'Weekly gasoline & distillate production (thousand bbl/day)',
        fields: {
          gasoline_production:      'Finished motor gasoline, thousand bbl/day',
          distillate_production:    'Distillate fuel, thousand bbl/day',
          gasoline_prod_4w_avg:     '4-week rolling average (gasoline)',
          gasoline_prod_year_ago:   'Same week, prior year (gasoline)',
        },
      },
    };

    await setInCache(cacheKey, payload, CACHE_TTL);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/supply/inventories
 * Weekly gasoline + distillate stock levels with days-of-supply and
 * a 52-week seasonal comparison z-score.
 *
 * Query params:
 *   ?region=US   (default; 'R10'–'R50' for PADD stocks where available)
 *   ?weeks=104   (history window, default 2 years)
 *
 * Inventory health z-score (from architecture §4.6.2):
 *   Positive z = above seasonal norm (healthy)
 *   z < -1     = below seasonal norm — watch condition
 *   z < -2     = supply squeeze risk when paired with low utilization
 */
router.get('/inventories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = (req.query.region as string) || 'US';
    const weeks  = parseInt((req.query.weeks as string) || '104', 10);
    const cacheKey = `supply:inventories:${region}:${weeks}`;

    const cached = await getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await getInventoryData(region, weeks);

    const payload = {
      region,
      data,
      meta: {
        description: 'Weekly petroleum stock levels (thousand barrels)',
        fields: {
          gasoline_stocks:          'Total motor gasoline stocks, thousand bbl',
          distillate_stocks:        'Distillate fuel stocks, thousand bbl',
          gasoline_days_supply:     'Estimated days of supply (stocks ÷ daily avg)',
          gasoline_stocks_52w_avg:  '52-week rolling average (gasoline stocks)',
          inventory_z_score:        'Deviation from 52-week norm (σ). Negative = below seasonal average',
        },
        supplySqueezeAlert: 'Triggered when inventory_z_score < -1 AND utilization stress z < -1.5',
      },
    };

    await setInCache(cacheKey, payload, CACHE_TTL);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/supply/health
 * Composite supply health score aggregating utilization stress and
 * inventory health into a single classification per PADD region.
 *
 * Returns one entry per region with:
 *   - util_z         : utilization z-score vs 52-week average
 *   - inventory_z    : gasoline stocks z-score vs 52-week average
 *   - composite_z    : average of the two (positive = healthy)
 *   - classification : 'normal' | 'elevated_risk' | 'supply_stress' | 'critical'
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cacheKey = 'supply:health';

    const cached = await getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await getSupplyHealth();

    // Derive an overall system health from worst regional classification
    const classOrder = ['normal', 'elevated_risk', 'supply_stress', 'critical'];
    const worstClass = data.reduce((worst: string, row: any) => {
      return classOrder.indexOf(row.classification) > classOrder.indexOf(worst)
        ? row.classification
        : worst;
    }, 'normal');

    const payload = {
      overall: worstClass,
      regions: data,
      meta: {
        classifications: {
          normal:        'Utilization and inventories within seasonal norms',
          elevated_risk: 'Minor outages or seasonal turnarounds; monitor closely',
          supply_stress: 'Significant unplanned outages; price spike risk elevated',
          critical:      'Major supply disruption; immediate price impact likely',
        },
        note: 'Leading indicator — typically precedes retail price increases by 1–2 weeks',
      },
    };

    // Supply health refreshes on new data — 1 hour cache TTL
    await setInCache(cacheKey, payload, 60 * 60);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/supply/flow
 * Weekly petroleum flow balance: imports (gasoline + distillate + crude),
 * exports, and product-supplied (implied domestic demand) per region.
 *
 * Derived field: import_dependency_pct = gasoline_imports / product_supplied_gas * 100
 *   East Coast typically 40–60% — heavily reliant on waterborne product imports.
 *   Gulf Coast / Midwest typically <5% — net exporters.
 *
 * Query params:
 *   ?region=US   (default; 'R10'–'R50' for PADD-level where available)
 *   ?weeks=52    (history window, default 52)
 */
router.get('/flow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = (req.query.region as string) || 'US';
    const weeks  = parseInt((req.query.weeks as string) || '52', 10);
    const cacheKey = `supply:flow:${region}:${weeks}`;

    const cached = await getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await getFlowData(region, weeks);

    // Compute the latest import dependency for a quick summary
    const latest = data[0];
    const importDependencyPct = latest?.import_dependency_pct ?? null;

    const payload = {
      region,
      importDependencyPct,
      data,
      meta: {
        description: 'Weekly petroleum flow balance (imports, exports, product-supplied / implied demand)',
        units: 'thousand bbl/day',
        fields: {
          gasoline_imports:           'Finished gasoline imports by region, k bbl/day',
          distillate_imports:         'Distillate fuel imports by region, k bbl/day',
          crude_imports:              'Crude oil imports by region, k bbl/day',
          total_exports:              'Total petroleum exports (national), k bbl/day',
          product_supplied_gas:       'Implied gasoline demand (production + imports − exports ± Δstocks), k bbl/day',
          product_supplied_dist:      'Implied distillate demand, k bbl/day',
          import_dependency_pct:      'gasoline_imports ÷ product_supplied_gas × 100; high = vulnerable to import disruption',
          gasoline_imports_4w_avg:    '4-week rolling average (gasoline imports)',
          product_supplied_gas_4w_avg:'4-week rolling average (gasoline demand)',
        },
        note: 'EIA WPSR — published weekly Monday ~5PM ET; process codes IM0 (imports), EXP (exports), VPP (product supplied)',
      },
    };

    await setInCache(cacheKey, payload, CACHE_TTL);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/supply/capacity
 * Annual refinery operable capacity from EIA Form 820.
 * Returns the most recent year available (or a specific year via ?year=2024).
 *
 * Fields per region:
 *   operable_capacity   — total capacity (k bbl/calendar day)
 *   operating_capacity  — currently operating
 *   idle_capacity       — idle (not operating)
 *   capacity_utilization_pct — operating / operable * 100
 *
 * Query params:
 *   ?year=2024  (optional; defaults to most recent year per region)
 */
router.get('/capacity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const cacheKey = `supply:capacity:${year ?? 'latest'}`;

    const cached = await getFromCache(cacheKey);
    if (cached) return res.json(cached);

    const data = await getCapacityData(year);

    const payload = {
      year: year ?? data[0]?.year ?? null,
      data,
      meta: {
        description: 'Annual refinery operable capacity by region (EIA Form 820)',
        units: 'thousand barrels per calendar day (k bbl/cd)',
        source: 'EIA Form 820 (Annual Refinery Report)',
        fields: {
          operable_capacity:       'Total capacity of operable refineries',
          operating_capacity:      'Capacity at refineries currently operating',
          idle_capacity:           'Capacity at idle refineries',
          shutdown_capacity:       'Capacity at permanently shutdown refineries',
          capacity_utilization_pct:'operating / operable × 100',
          idle_pct:                'idle / operable × 100',
        },
        note: 'Published annually by EIA, typically January–February for prior year',
      },
    };

    // Cache for 24 hours — annual data changes infrequently
    await setInCache(cacheKey, payload, 24 * 60 * 60);
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;
