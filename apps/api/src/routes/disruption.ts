import { Router, Request, Response, NextFunction } from 'express';
import { getWeeklyChanges } from '@fuelripple/db';
import { calculateDisruptionScore, calculateAnnualizedVolatility, getVolatilityClassification } from '@fuelripple/impact-engine';
import { cacheOrFetch } from '../services/cache';
import { AppError } from '../middleware/errorHandler';
import { CACHE_TTL } from '@fuelripple/shared';
import { mapRegion } from '../utils/regionMapper';

const router = Router();

/**
 * GET /api/v1/disruption/score
 * Get current disruption score
 */
router.get('/score', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = (req.query.metric as string) || 'gas_regular';
    const region = mapRegion((req.query.region as string) || 'US');
    
    const score = await cacheOrFetch(
      `disruption:score:${metric}:${region}`,
      async () => {
        // Get weekly changes for the last 52 weeks
        const changes = await getWeeklyChanges(metric, region, 52);
        
        if (changes.length < 2) {
          throw new AppError('Insufficient data to calculate disruption score — run the historical backfill first', 503);
        }
        
        // Get current and previous week prices
        const currentPrice = changes[0].avg_price;
        const previousPrice = changes[1].avg_price;
        
        // Extract percentage changes
        const pctChanges = changes
          .map(c => c.pct_change)
          .filter((c): c is number => c !== null);
        
        return calculateDisruptionScore(currentPrice, previousPrice, pctChanges);
      },
      CACHE_TTL.DISRUPTION_SCORE
    );

    res.json({
      status: 'success',
      data: score,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/disruption/volatility
 * Get rolling volatility index
 */
router.get('/volatility', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = (req.query.metric as string) || 'gas_regular';
    const region = mapRegion((req.query.region as string) || 'US');
    const window = parseInt(req.query.window as string) || 30;
    
    const volatility = await cacheOrFetch(
      `disruption:volatility:${metric}:${region}:${window}`,
      async () => {
        const changes = await getWeeklyChanges(metric, region, window);
        
        if (changes.length < 2) {
          throw new AppError('Insufficient data to calculate volatility — run the historical backfill first', 503);
        }
        
        const pctChanges = changes
          .map(c => c.pct_change)
          .filter((c): c is number => c !== null);
        
        const annualizedVol = calculateAnnualizedVolatility(pctChanges);
        const classification = getVolatilityClassification(annualizedVol);
        
        return {
          annualizedVolatility: annualizedVol,
          classification,
          window,
          dataPoints: pctChanges.length,
        };
      },
      CACHE_TTL.DISRUPTION_SCORE
    );

    res.json({
      status: 'success',
      data: volatility,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
