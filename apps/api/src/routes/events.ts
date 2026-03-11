import { Router, Request, Response, NextFunction } from 'express';
import { getEvents } from '@fuelripple/db';
import { cacheOrFetch } from '../services/cache';
import { CACHE_TTL } from '@fuelripple/shared';

const router = Router();

/**
 * GET /api/v1/events
 * Get geopolitical events for chart annotations
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.start ? new Date(req.query.start as string) : undefined;
    const endDate = req.query.end ? new Date(req.query.end as string) : undefined;
    const categories = req.query.categories 
      ? (req.query.categories as string).split(',')
      : undefined;
    
    const cacheKey = `events:${startDate}:${endDate}:${categories?.join(',')}`;
    
    const events = await cacheOrFetch(
      cacheKey,
      () => getEvents(startDate, endDate, categories),
      CACHE_TTL.HISTORICAL
    );

    res.json({
      status: 'success',
      data: events,
      count: events.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
