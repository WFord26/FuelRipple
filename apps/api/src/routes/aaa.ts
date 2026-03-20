import { Router, Request, Response, NextFunction } from 'express';
import {
  getRecentNationalAverages,
  getAaaNationalChanges,
  getAaaStateLatest,
  getAaaStateHistory,
  getAaaStateChanges,
  getAllAaaStatesLatest,
  getAaaPaddLatest,
  getAaaPaddHistory,
  getAllAaaPaddLatest,
} from '@fuelripple/db';
import { cacheOrFetch } from '../services/cache';
import { CACHE_TTL, PADD_REGIONS } from '@fuelripple/shared';

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

/**
 * GET /api/v1/aaa/national/changes
 * Pre-computed 7d/30d/90d/365d price changes for all 4 grades, calculated
 * server-side from aaa_national_averages. Compact single-query response — use
 * this instead of fetching full history and doing lookups on the client.
 */
router.get('/national/changes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch(
      'aaa:national:changes',
      () => getAaaNationalChanges(),
      CACHE_TTL.AAA_NATIONAL
    );

    res.json({
      status: 'success',
      data,
      source: 'aaa',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/aaa/states
 * Latest AAA prices for all states — regular, mid-grade, premium, diesel per state.
 * One row per state, all 4 grades in separate columns.
 */
router.get('/states', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch(
      'aaa:states:latest',
      () => getAllAaaStatesLatest(),
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
 * GET /api/v1/aaa/state/:abbr/latest
 * Current AAA state average price for all 4 grades (regular, mid-grade, premium, diesel).
 * Cached 24 hours, invalidated by the daily AAA job.
 */
router.get('/state/:abbr/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { abbr } = req.params;
    if (!abbr || abbr.length !== 2) {
      res.status(400).json({ status: 'error', message: 'Invalid state abbreviation' });
      return;
    }

    const data = await cacheOrFetch(
      `aaa:state:${abbr.toUpperCase()}:latest`,
      () => getAaaStateLatest(abbr),
      CACHE_TTL.AAA_NATIONAL
    );

    if (!data) {
      res.status(404).json({ status: 'error', message: `No AAA data available for state ${abbr}` });
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

/**
 * GET /api/v1/aaa/state/:abbr
 * Historical AAA state average prices, newest-first (default 90 days).
 *
 * Query params:
 *   limit  - number of days to return (default 90, max 365)
 */
router.get('/state/:abbr', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { abbr } = req.params;
    if (!abbr || abbr.length !== 2) {
      res.status(400).json({ status: 'error', message: 'Invalid state abbreviation' });
      return;
    }

    const limit = Math.min(parseInt((req.query.limit as string) || '90', 10), 365);

    const data = await cacheOrFetch(
      `aaa:state:${abbr.toUpperCase()}:${limit}`,
      () => getAaaStateHistory(abbr, limit),
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
 * GET /api/v1/aaa/state/:abbr/changes
 * Pre-computed 7d/30d/90d/365d price changes for all 4 grades in a state,
 * calculated server-side. Returns at most 4 rows (one per grade).
 */
router.get('/state/:abbr/changes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { abbr } = req.params;
    if (!abbr || abbr.length !== 2) {
      res.status(400).json({ status: 'error', message: 'Invalid state abbreviation' });
      return;
    }

    const data = await cacheOrFetch(
      `aaa:state:${abbr.toUpperCase()}:changes`,
      () => getAaaStateChanges(abbr),
      CACHE_TTL.AAA_NATIONAL
    );

    res.json({
      status: 'success',
      data,
      source: 'aaa',
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PADD regional routes
// ---------------------------------------------------------------------------

/** Valid PADD codes */
const VALID_PADD_CODES = new Set(['R10', 'R20', 'R30', 'R40', 'R50']);

const PADD_NAMES: Record<string, string> = {
  R10: PADD_REGIONS.PADD1.name,
  R20: PADD_REGIONS.PADD2.name,
  R30: PADD_REGIONS.PADD3.name,
  R40: PADD_REGIONS.PADD4.name,
  R50: PADD_REGIONS.PADD5.name,
};

/**
 * GET /api/v1/aaa/regions
 * Latest AAA-derived PADD aggregate for all 5 regions — all 4 fuel grades,
 * both simple mean and population-weighted mean.
 */
router.get('/regions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch(
      'aaa:regions:latest',
      () => getAllAaaPaddLatest(),
      CACHE_TTL.AAA_NATIONAL
    );

    res.json({
      status: 'success',
      data: data.map(r => ({ ...r, name: PADD_NAMES[r.padd] })),
      count: data.length,
      source: 'aaa',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/aaa/region/:padd/latest
 * Single most-recent row for a PADD region.
 * Includes both simple mean and population-weighted mean for all 4 grades.
 *
 * :padd — R10, R20, R30, R40, or R50 (case-insensitive)
 */
router.get('/region/:padd/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const padd = req.params.padd.toUpperCase();
    if (!VALID_PADD_CODES.has(padd)) {
      res.status(400).json({ status: 'error', message: `Invalid PADD code. Must be one of: ${[...VALID_PADD_CODES].join(', ')}` });
      return;
    }

    const data = await cacheOrFetch(
      `aaa:region:${padd}:latest`,
      () => getAaaPaddLatest(padd),
      CACHE_TTL.AAA_NATIONAL
    );

    if (!data) {
      res.status(404).json({ status: 'error', message: `No AAA PADD data available for ${padd}` });
      return;
    }

    res.json({
      status: 'success',
      data: { ...data, name: PADD_NAMES[padd] },
      source: 'aaa',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/aaa/region/:padd
 * Historical AAA-derived PADD aggregates, newest first.
 * Both simple mean and population-weighted mean for all 4 grades per row.
 *
 * :padd — R10, R20, R30, R40, or R50 (case-insensitive)
 *
 * Query params:
 *   limit  — number of days to return (default 90, max 365)
 */
router.get('/region/:padd', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const padd = req.params.padd.toUpperCase();
    if (!VALID_PADD_CODES.has(padd)) {
      res.status(400).json({ status: 'error', message: `Invalid PADD code. Must be one of: ${[...VALID_PADD_CODES].join(', ')}` });
      return;
    }

    const limit = Math.min(parseInt((req.query.limit as string) || '90', 10), 365);

    const data = await cacheOrFetch(
      `aaa:region:${padd}:${limit}`,
      () => getAaaPaddHistory(padd, limit),
      CACHE_TTL.AAA_NATIONAL
    );

    res.json({
      status: 'success',
      padd,
      name: PADD_NAMES[padd],
      data,
      count: data.length,
      source: 'aaa',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

