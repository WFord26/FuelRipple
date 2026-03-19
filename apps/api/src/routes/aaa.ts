import { Router, Request, Response, NextFunction } from 'express';
import { getRecentNationalAverages } from '@fuelripple/db';
import { cacheOrFetch } from '../services/cache';
import { CACHE_TTL } from '@fuelripple/shared';

const router = Router();

/**
 * GET /api/v1/aaa/national
 * Daily US national average gas prices computed from AAA per-state data.
 * Returns recent rows newest-first (default 90 days).
 *
 * Query params:
 *   limit  - number of days to return (default 90, max 365)
 */
router.get('/national', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '90', 10), 365);

    const data = await cacheOrFetch(
      `aaa:national:${limit}`,
      () => getRecentNationalAverages(limit),
      CACHE_TTL.AAA_NATIONAL
    );

    res.json({
      status: 'success',
      data,
      count: data.length,
      source: 'aaa',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/aaa/national/latest
 * Single most-recent row — the current national average for all 4 grades.
 * Cached 24 hours, invalidated by the daily AAA job.
 */
router.get('/national/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch(
      'aaa:national:latest',
      async () => {
        const rows = await getRecentNationalAverages(1);
        return rows[0] ?? null;
      },
      CACHE_TTL.AAA_NATIONAL
    );

    if (!data) {
      res.status(404).json({ status: 'error', message: 'No AAA national data available' });
      return;
    }

    res.json({
      status: 'success',
      data,
      source: 'aaa',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
