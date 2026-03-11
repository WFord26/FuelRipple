import { Router, Request, Response, NextFunction } from 'express';
import { FuelCostInputSchema } from '@fuelripple/shared';
import { calculateFuelCost, calculateTypicalHouseholdImpact, calculateDownstreamImpact } from '@fuelripple/impact-engine';
import { getCurrentPrices, getIndicators } from '@fuelripple/db';
import { cacheOrFetch } from '../services/cache';
import { CACHE_TTL } from '@fuelripple/shared';
import { AppError } from '../middleware/errorHandler';
import { mapRegion } from '../utils/regionMapper';

const router = Router();

/**
 * POST /api/v1/impact/fuel-cost
 * Calculate personalized fuel cost impact
 */
router.post('/fuel-cost', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = FuelCostInputSchema.parse(req.body);
    const result = calculateFuelCost(input);

    res.json({
      status: 'success',
      data: result,
      input,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      next(new AppError('Invalid input parameters', 400));
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/v1/impact/fuel-cost/typical
 * Get typical household impact
 */
router.get('/fuel-cost/typical', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = mapRegion((req.query.region as string) || 'US');
    const baselinePrice = req.query.baseline ? parseFloat(req.query.baseline as string) : undefined;
    
    const impact = await cacheOrFetch(
      `impact:typical:${region}:${baselinePrice}`,
      async () => {
        // Get current gas price
        const prices = await getCurrentPrices('gas_regular');
        const regionPrice = prices.find((p: any) => p.region === region);
        
        if (!regionPrice) {
          throw new AppError('Region not found', 404);
        }
        
        return calculateTypicalHouseholdImpact(regionPrice.value, baselinePrice);
      },
      CACHE_TTL.WEEKLY_GAS
    );

    res.json({
      status: 'success',
      data: impact,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/impact/downstream
 * Calculate downstream consumer goods impact
 */
router.get('/downstream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = mapRegion((req.query.region as string) || 'US');
    const baselinePrice = req.query.baseline ? parseFloat(req.query.baseline as string) : undefined;
    
    const impact = await cacheOrFetch(
      `impact:downstream:${region}:${baselinePrice}`,
      async () => {
        // Get current diesel price
        // Diesel data may be stored as 'US' (AAA) or 'NUS' (EIA) — try both
        const prices = await getCurrentPrices('diesel');
        const regionPrice = prices.find((p: any) => p.region === region)
          || (region === 'NUS' ? prices.find((p: any) => p.region === 'US') : null);
        
        if (!regionPrice) {
          throw new AppError('Region not found', 404);
        }
        
        return calculateDownstreamImpact(regionPrice.value, baselinePrice);
      },
      CACHE_TTL.DOWNSTREAM
    );

    res.json({
      status: 'success',
      data: impact,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/impact/indicators
 * Returns historical BLS/FRED economic indicator data for the downstream dashboard.
 * Supported indicators: cpi, cpi_food, ppi_trucking, ppi_freight
 * Query params:
 *   - months: number of months of history (default: 60)
 */
router.get('/indicators', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const months = parseInt(req.query.months as string) || 60;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const data = await cacheOrFetch(
      `impact:indicators:${months}`,
      async () => {
        const [cpi, cpiFood, ppiTrucking, ppiFreight] = await Promise.all([
          getIndicators('cpi', startDate),
          getIndicators('cpi_food', startDate),
          getIndicators('ppi_trucking', startDate),
          getIndicators('ppi_freight', startDate),
        ]);

        // Helper: compute year-over-year % change for a sorted array (newest first)
        const withYoY = (rows: any[]) => {
          // rows from DB are newest-first; reverse for chronological order
          const sorted = [...rows].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
          return sorted.map((row, i) => {
            const yearAgoIdx = sorted.findIndex(r =>
              Math.abs(new Date(r.time).getTime() - (new Date(row.time).getTime() - 365.25 * 24 * 3600 * 1000)) < 20 * 24 * 3600 * 1000
            );
            const yoy = yearAgoIdx !== -1
              ? ((row.value - sorted[yearAgoIdx].value) / sorted[yearAgoIdx].value) * 100
              : null;
            return { date: row.time, value: row.value, yoy };
          });
        };

        // Latest values for each indicator
        const latest = {
          cpi:         cpi[0]         ?? null,
          cpiFood:     cpiFood[0]     ?? null,
          ppiTrucking: ppiTrucking[0] ?? null,
          ppiFreight:  ppiFreight[0]  ?? null,
        };

        return {
          latest,
          series: {
            cpi:         withYoY(cpi),
            cpiFood:     withYoY(cpiFood),
            ppiTrucking: withYoY(ppiTrucking),
            ppiFreight:  withYoY(ppiFreight),
          },
        };
      },
      CACHE_TTL.DOWNSTREAM
    );

    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
});

export default router;
