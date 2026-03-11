import { Router, Request, Response, NextFunction } from 'express';
import { getCorrelationSeries } from '@fuelripple/db';
import { calculateCrossCorrelation, analyzeRocketsAndFeathers } from '@fuelripple/impact-engine';
import { cacheOrFetch } from '../services/cache';
import { CACHE_TTL } from '@fuelripple/shared';

const router = Router();

/**
 * Map API region codes to the gas-price region stored in energy_prices.
 * Gas national = 'NUS', PADD regions = 'R10'...'R50'
 */
const mapGasRegion = (region: string): string => {
  const regionMap: Record<string, string> = {
    'US':  'NUS',
    'NUS': 'NUS',
    'R10': 'R10',
    'R20': 'R20',
    'R30': 'R30',
    'R40': 'R40',
    'R50': 'R50',
  };
  return regionMap[region] || 'NUS';
};

/**
 * GET /api/v1/correlation/crude-gas
 */
router.get('/crude-gas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gasRegion = mapGasRegion((req.query.region as string) || 'US');
    const maxLag    = parseInt(req.query.maxLag as string) || 12;

    const correlation = await cacheOrFetch(
      `correlation:crude-gas:${gasRegion}:${maxLag}`,
      async () => {
        const rows = await getCorrelationSeries({ gasRegion, weeks: 300 });

        const gasValues  = rows.map((r: any) => r.gas_value);
        const oilValues  = rows.map((r: any) => r.crude_value);
        const dataPoints = rows.length;

        if (dataPoints < maxLag + 2) {
          return {
            crossCorrelation: Array.from({ length: maxLag + 1 }, (_, lag) => ({ lag, correlation: 0 })),
            optimalLag: 0,
            optimalCorrelation: 0,
            dataPoints,
          };
        }

        const crossCorr = calculateCrossCorrelation(gasValues, oilValues, maxLag);

        // Peak positive correlation in 0-8 week range (economically sensible window)
        const searchRange  = crossCorr.filter((p: any) => p.lag <= 8 && p.correlation > 0);
        const optimalEntry = searchRange.length > 0
          ? searchRange.reduce((best: any, cur: any) => cur.correlation > best.correlation ? cur : best, searchRange[0])
          : crossCorr[0];
        const optimalLag = optimalEntry.lag;

        return {
          crossCorrelation: crossCorr,
          optimalLag,
          optimalCorrelation: crossCorr[optimalLag]?.correlation || 0,
          dataPoints,
        };
      },
      CACHE_TTL.WEEKLY_GAS
    );

    res.json({ status: 'success', data: correlation });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/correlation/rockets-feathers
 */
router.get('/rockets-feathers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gasRegion = mapGasRegion((req.query.region as string) || 'US');

    const analysis = await cacheOrFetch(
      `correlation:rockets-feathers:${gasRegion}`,
      async () => {
        const rows = await getCorrelationSeries({ gasRegion, weeks: 104 });

        const gasChanges: number[] = [];
        const oilChanges: number[] = [];
        for (let i = 1; i < rows.length; i++) {
          const prev = rows[i - 1];
          const curr = rows[i];
          if (prev.gas_value > 0 && prev.crude_value > 0) {
            gasChanges.push((curr.gas_value   - prev.gas_value)   / prev.gas_value);
            oilChanges.push((curr.crude_value - prev.crude_value) / prev.crude_value);
          }
        }

        return analyzeRocketsAndFeathers(gasChanges, oilChanges);
      },
      CACHE_TTL.WEEKLY_GAS
    );

    res.json({
      status: 'success',
      data: analysis,
      interpretation: {
        message: analysis.asymmetryRatio > 2
          ? 'Prices rise significantly faster than they fall (rockets and feathers effect)'
          : 'Price movements are relatively symmetric',
        ratio: analysis.asymmetryRatio,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/correlation/price-series
 * Returns weekly crude oil + gas price time-series aligned by week for dual-axis charting.
 * Query params: region (default US), weeks (default 260 = 5 years)
 */
router.get('/price-series', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gasRegion = mapGasRegion((req.query.region as string) || 'US');
    const weeks     = Math.min(parseInt(req.query.weeks as string) || 260, 1560); // cap at 30 years

    const series = await cacheOrFetch(
      `correlation:price-series:${gasRegion}:${weeks}`,
      () => getCorrelationSeries({ gasRegion, weeks }),
      CACHE_TTL.WEEKLY_GAS
    );

    res.json({ status: 'success', data: series, count: series.length });
  } catch (error) {
    next(error);
  }
});

export default router;
