import { Router, Request, Response, NextFunction } from 'express';
import { getCorrelationSeries, getDailyCrudePrices, getDailyAaaGasPrices, getDailyCorrelationSeries } from '@fuelripple/db';
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
        message: analysis.elasticityRatio > 1.15
          ? 'Prices rise significantly faster than they fall (rockets and feathers effect)'
          : analysis.elasticityRatio > 1.05
            ? 'Prices show mild upward asymmetry'
            : 'Price movements are relatively symmetric',
        ratio: analysis.elasticityRatio,
        legacyRatio: analysis.asymmetryRatio,
        halfLife: {
          rise: analysis.riseHalfLifeWeeks,
          fall: analysis.fallHalfLifeWeeks,
        },
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

/**
 * GET /api/v1/correlation/daily-crude
 * Returns daily crude oil prices (WTI or Brent) from Yahoo Finance.
 * Query params: metric (crude_wti | crude_brent, default: crude_wti), days (default: 365)
 */
router.get('/daily-crude', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = (req.query.metric as 'crude_wti' | 'crude_brent') || 'crude_wti';
    const days   = Math.min(parseInt(req.query.days as string) || 365, 1825); // cap at 5 years

    const prices = await cacheOrFetch(
      `correlation:daily-crude:${metric}:${days}`,
      () => getDailyCrudePrices(days, metric),
      CACHE_TTL.DAILY_CRUDE || 6 * 60 * 60 * 1000 // 6 hours
    );

    res.json({ status: 'success', data: prices, count: prices.length, metric });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/correlation/daily-gas-aaa
 * Returns daily gas prices from AAA national average.
 * Query params: metric (default: gas_regular), days (default: 365)
 */
router.get('/daily-gas-aaa', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metric = (req.query.metric as string) || 'gas_regular';
    const days   = Math.min(parseInt(req.query.days as string) || 365, 1825); // cap at 5 years

    const prices = await cacheOrFetch(
      `correlation:daily-gas-aaa:${metric}:${days}`,
      () => getDailyAaaGasPrices(days, metric),
      CACHE_TTL.AAA_NATIONAL || 24 * 60 * 60 * 1000 // 24 hours
    );

    res.json({ status: 'success', data: prices, count: prices.length, metric });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/correlation/daily-series
 * Returns daily correlation series: AAA gas + Yahoo crude (WTI/Brent) aligned by date.
 * Query params: days (default: 365)
 */
router.get('/daily-series', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 365, 1825); // cap at 5 years

    const series = await cacheOrFetch(
      `correlation:daily-series:${days}`,
      () => getDailyCorrelationSeries(days),
      CACHE_TTL.DAILY_CRUDE || 6 * 60 * 60 * 1000 // 6 hours
    );

    res.json({ status: 'success', data: series, count: series.length });
  } catch (error) {
    next(error);
  }
});

export default router;
