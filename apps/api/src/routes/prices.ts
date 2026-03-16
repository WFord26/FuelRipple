import { Router, Request, Response, NextFunction } from 'express';
import { PriceHistoryQuerySchema } from '@fuelripple/shared';
import { getHistoricalPrices, getCurrentPrices, getPriceStats, getPriceChanges, getSeasonalComparison, getAllStatePrices, getDataStatus } from '@fuelripple/db';
import { cacheOrFetch } from '../services/cache';
import { CACHE_TTL } from '@fuelripple/shared';
import { AppError } from '../middleware/errorHandler';
import { isStateCode, isPaddCode, getPaddForState, STATE_INFO } from '../utils/regionMapper';

const router = Router();

/**
 * GET /api/v1/prices/current
 * Get current prices for all regions
 */
router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = (req.query.metric as string) || 'gas_regular';
    
    const prices = await cacheOrFetch(
      `prices:current:${metric}`,
      () => getCurrentPrices(metric),
      CACHE_TTL.WEEKLY_GAS
    );

    res.json({
      status: 'success',
      data: prices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/prices/history
 * Get historical prices with optional filters
 */
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate query parameters
    const query = PriceHistoryQuerySchema.parse(req.query);
    
    // Map yearly to monthly for continuous aggregates
    const granularity = query.granularity === 'yearly' ? 'monthly' : query.granularity;
    
    const cacheKey = `prices:history:${query.metric}:${query.region}:${granularity}:${query.start}:${query.end}`;
    
    const prices = await cacheOrFetch(
      cacheKey,
      () => getHistoricalPrices({
        metric: query.metric,
        region: query.region,
        start: query.start ? new Date(query.start) : undefined,
        end: query.end ? new Date(query.end) : undefined,
        granularity,
      }),
      CACHE_TTL.HISTORICAL
    );

    res.json({
      status: 'success',
      data: prices,
      count: prices.length,
      query,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      next(new AppError('Invalid query parameters', 400));
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/v1/prices/comparison
 * Get regional price comparison with state-level breakdown
 */
router.get('/comparison', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = (req.query.metric as string) || 'gas_regular';
    
    const prices = await cacheOrFetch(
      `prices:comparison:v2:${metric}`,
      async () => {
        const currentPrices = await getCurrentPrices(metric);

        // Separate PADD-level and state-level prices
        const paddPrices = currentPrices.filter((p: any) => isPaddCode(p.region));
        const statePrices = currentPrices.filter((p: any) => isStateCode(p.region));

        // Build a map of PADD code -> state rows
        const statesByPadd = new Map<string, any[]>();
        for (const sp of statePrices) {
          const padd = getPaddForState(sp.region);
          if (!padd) continue;
          if (!statesByPadd.has(padd)) statesByPadd.set(padd, []);
          const info = STATE_INFO[sp.region];
          statesByPadd.get(padd)!.push({
            code: sp.region,
            abbr: info.abbr,
            name: info.name,
            value: sp.value,
            time: sp.time,
          });
        }

        // Sort states within each PADD by price descending
        for (const states of statesByPadd.values()) {
          states.sort((a, b) => b.value - a.value);
        }

        // Enrich PADD rows with stats + state breakdown
        const enriched = await Promise.all(
          paddPrices.map(async (price: any) => {
            const stats = await getPriceStats(metric, price.region, 365);
            return {
              ...price,
              yearAvg: stats?.avg_price,
              yearMin: stats?.min_price,
              yearMax: stats?.max_price,
              percentile: stats
                ? ((price.value - stats.min_price) / (stats.max_price - stats.min_price)) * 100
                : null,
              states: statesByPadd.get(price.region) ?? [],
            };
          })
        );
        
        return enriched;
      },
      CACHE_TTL.WEEKLY_GAS
    );

    res.json({
      status: 'success',
      data: prices,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/prices/stats/:metric/:region
 * Get price statistics for a specific metric and region
 */
router.get('/stats/:metric/:region', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metric, region } = req.params;
    const days = parseInt(req.query.days as string) || 365;
    
    const stats = await cacheOrFetch(
      `prices:stats:${metric}:${region}:${days}`,
      () => getPriceStats(metric, region, days),
      CACHE_TTL.WEEKLY_GAS
    );

    if (!stats) {
      throw new AppError('No data found for the specified parameters', 404);
    }

    res.json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/prices/changes
 * Get price % changes vs 1 week, 1 month, 1 year ago + daily US consumer spend
 * US daily gasoline consumption: ~369 million gallons (EIA)
 */
router.get('/changes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = (req.query.metric as string) || 'gas_regular';
    const region = (req.query.region as string) || 'NUS';

    const data = await cacheOrFetch(
      `prices:changes:${metric}:${region}`,
      async () => {
        const changes = await getPriceChanges(metric, region);
        if (!changes) return null;

        // EIA: US consumes ~369 million gallons of motor gasoline per day
        const DAILY_GALLONS_US = 369_000_000;
        const dailyConsumerCost = parseFloat(changes.current_price) * DAILY_GALLONS_US;

        return {
          currentPrice: parseFloat(changes.current_price),
          currentTime: changes.current_time,
          weekAgoPrice: changes.week_ago_price != null ? parseFloat(changes.week_ago_price) : null,
          monthAgoPrice: changes.month_ago_price != null ? parseFloat(changes.month_ago_price) : null,
          threeMonthAgoPrice: changes.three_month_ago_price != null ? parseFloat(changes.three_month_ago_price) : null,
          yearAgoPrice: changes.year_ago_price != null ? parseFloat(changes.year_ago_price) : null,
          weekChangePct: changes.week_change_pct != null ? parseFloat(changes.week_change_pct) : null,
          monthChangePct: changes.month_change_pct != null ? parseFloat(changes.month_change_pct) : null,
          threeMonthChangePct: changes.three_month_change_pct != null ? parseFloat(changes.three_month_change_pct) : null,
          yearChangePct: changes.year_change_pct != null ? parseFloat(changes.year_change_pct) : null,
          dailyGallonsUs: DAILY_GALLONS_US,
          dailyConsumerCost,
        };
      },
      CACHE_TTL.WEEKLY_GAS
    );

    res.json({
      status: 'success',
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/prices/seasonal
 * Compare the current price against the 5-year seasonal average for the same
 * ISO week. Returns a simple delta and %-above/below the norm.
 */
router.get('/seasonal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = (req.query.metric as string) || 'gas_regular';
    const region = (req.query.region as string) || 'NUS';
    const years  = parseInt((req.query.years as string) || '5', 10);

    const data = await cacheOrFetch(
      `prices:seasonal:${metric}:${region}:${years}`,
      () => getSeasonalComparison(metric, region, years),
      CACHE_TTL.WEEKLY_GAS,
    );

    res.json({
      status: 'success',
      data,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/prices/states
 * Latest daily price for every state — regular, midgrade, premium, diesel in one row.
 */
router.get('/states', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch(
      'prices:states:all',
      async () => {
        const rows = await getAllStatePrices();
        // Enrich with state names
        return rows.map((r: any) => {
          const info = STATE_INFO[r.region];
          return {
            region: r.region,
            abbr: info?.abbr ?? r.region,
            name: info?.name ?? r.region,
            regular: r.regular != null ? parseFloat(r.regular) : null,
            midGrade: r.mid_grade != null ? parseFloat(r.mid_grade) : null,
            premium: r.premium != null ? parseFloat(r.premium) : null,
            diesel: r.diesel != null ? parseFloat(r.diesel) : null,
            time: r.time,
          };
        });
      },
      CACHE_TTL.WEEKLY_GAS,
    );

    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/prices/data-status
 * Data freshness report — latest timestamp per source × metric × region class.
 */
router.get('/data-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch(
      'prices:data-status',
      () => getDataStatus(),
      300, // 5 min cache
    );

    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

export default router;
