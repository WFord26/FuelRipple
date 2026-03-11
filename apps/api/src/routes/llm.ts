import { Router, Request, Response, NextFunction } from 'express';
import { getCurrentPrices, getHistoricalPrices, getEvents } from '@fuelripple/db';
import { calculateFuelCost, calculateCrossCorrelation, analyzeRocketsAndFeathers } from '@fuelripple/impact-engine';
import { getUtilizationByRegion } from '@fuelripple/db';
import { cacheOrFetch } from '../services/cache';
import { CACHE_TTL } from '@fuelripple/shared';

const router = Router();

const DISCLAIMER =
  'This data is for informational purposes only. Historical prices and correlations are not predictive. ' +
  'Actual prices may differ. See fuelripple.com for full terms of use.';

function trendArrow(pct: number): string {
  if (pct > 2)  return '↑';
  if (pct < -2) return '↓';
  return '→';
}

function disruptionEmoji(classification: string): string {
  return classification === 'crisis'   ? '🔴' :
         classification === 'high'     ? '🟠' :
         classification === 'elevated' ? '🟡' : '🟢';
}

/**
 * GET /api/v1/llm/prices/summary
 * Current US average price, direction, disruption score, and regional snapshot
 */
router.get('/prices/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch('llm:prices:summary', async () => {
      const [gasPrices, dieselPrices, crudeWTI] = await Promise.all([
        getCurrentPrices('gas_regular'),
        getCurrentPrices('diesel'),
        getCurrentPrices('crude_wti'),
      ]);

      const national = gasPrices.find((p: any) => p.region === 'NUS') ?? gasPrices[0];
      const diesel   = dieselPrices.find((p: any) => p.region === 'NUS' || p.region === 'US') ?? dieselPrices[0];
      const crude    = crudeWTI.find((p: any) => p.region === 'US') ?? crudeWTI[0];

      // 4-week history for % change
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const history = await getHistoricalPrices({ metric: 'gas_regular', region: 'NUS', granularity: 'weekly' });
      const recent  = history.slice(0, 8);
      const prev    = recent[1];
      const pctWeekly = (national && prev)
        ? ((national.value - prev.value) / prev.value) * 100
        : 0;

      return {
        timestamp: new Date().toISOString(),
        gas_regular: {
          price:       national?.value ?? null,
          currency:    'USD/gallon',
          region:      'US National Average',
          trend:       trendArrow(pctWeekly),
          pct_change_week: +pctWeekly.toFixed(2),
          source:      'EIA / AAA',
        },
        diesel: {
          price:    diesel?.value ?? null,
          currency: 'USD/gallon',
          source:   'EIA',
        },
        crude_wti: {
          price:    crude?.value ?? null,
          currency: 'USD/barrel',
          source:   'Market data',
        },
        data_as_of: national?.time ?? null,
        disclaimer: DISCLAIMER,
      };
    }, CACHE_TTL.WEEKLY_GAS);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/llm/prices/regional
 * Current prices + weekly change for all PADD regions and selected states
 */
router.get('/prices/regional', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch('llm:prices:regional', async () => {
      const prices   = await getCurrentPrices('gas_regular');
      const history  = await getHistoricalPrices({ metric: 'gas_regular', granularity: 'weekly' });

      // Build prev-week lookup: region → price of the most recent prior week
      const prevByRegion: Record<string, number> = {};
      const seenForPrev = new Set<string>();
      // history is sorted newest-first per region; skip the first occurrence (current week)
      for (const row of history) {
        if (!seenForPrev.has(row.region)) {
          seenForPrev.add(row.region);
        } else if (!prevByRegion[row.region]) {
          prevByRegion[row.region] = row.value;
        }
      }

      const REGION_NAMES: Record<string, string> = {
        NUS: 'US National',
        R10: 'PADD 1 – East Coast',
        R20: 'PADD 2 – Midwest',
        R30: 'PADD 3 – Gulf Coast',
        R40: 'PADD 4 – Rocky Mountain',
        R50: 'PADD 5 – West Coast',
      };

      const regions = prices
        .filter((p: any) => REGION_NAMES[p.region])
        .map((p: any) => {
          const prev = prevByRegion[p.region];
          const pctWeek = prev ? ((p.value - prev) / prev) * 100 : null;
          return {
            region:                REGION_NAMES[p.region],
            code:                  p.region,
            price:                 +p.value.toFixed(3),
            currency:              'USD/gallon',
            pct_change_vs_week_ago: pctWeek !== null ? +pctWeek.toFixed(2) : null,
            trend:                 pctWeek !== null ? trendArrow(pctWeek) : '→',
            data_as_of:            p.time,
          };
        })
        .sort((a: any, b: any) => a.price - b.price);

      return {
        timestamp: new Date().toISOString(),
        regions,
        source: 'EIA v2 API / AAA',
        disclaimer: DISCLAIMER,
      };
    }, CACHE_TTL.WEEKLY_GAS);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/llm/impact/calculate
 * Compute personalized fuel cost from LLM-supplied parameters
 * Body: { annual_miles, vehicle_mpg, current_price_per_gallon, baseline_price_per_gallon? }
 */
router.post('/impact/calculate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      annual_miles = 13500,
      vehicle_mpg  = 25.4,
      current_price_per_gallon,
      baseline_price_per_gallon = 3.00,
    } = req.body;

    if (!current_price_per_gallon || isNaN(Number(current_price_per_gallon))) {
      return res.status(400).json({
        error: 'current_price_per_gallon is required and must be a number',
        disclaimer: DISCLAIMER,
      });
    }

    const result = calculateFuelCost({
      annualMiles:         Number(annual_miles),
      vehicleMPG:          Number(vehicle_mpg),
      currentGasPrice:     Number(current_price_per_gallon),
      baselineGasPrice:    Number(baseline_price_per_gallon),
      commuteDistance:     20.5,
      workingDaysPerYear:  250,
    });

    const delta = result.costVsBaseline ?? 0;
    res.json({
      annual_cost_current:  +result.annualFuelCost.toFixed(2),
      annual_cost_baseline: +(Number(baseline_price_per_gallon) * result.annualGallons).toFixed(2),
      delta_annual_cost:    +delta.toFixed(2),
      delta_per_week:       +(delta / 52).toFixed(2),
      annual_gallons:       +result.annualGallons.toFixed(0),
      pct_increase:         delta !== 0
        ? `${((delta / (Number(baseline_price_per_gallon) * result.annualGallons)) * 100).toFixed(1)}%`
        : '0%',
      inputs: { annual_miles, vehicle_mpg, current_price_per_gallon, baseline_price_per_gallon },
      disclaimer: DISCLAIMER,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/llm/correlation/crude-gas
 * Cross-correlation lag + rockets-and-feathers asymmetry
 */
router.get('/correlation/crude-gas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch('llm:correlation:crude-gas', async () => {
      const [gasHistory, crudeHistory] = await Promise.all([
        getHistoricalPrices({ metric: 'gas_regular', region: 'NUS', granularity: 'weekly' }),
        getHistoricalPrices({ metric: 'crude_wti',   region: 'US',  granularity: 'weekly' }),
      ]);

      const gasMap  = new Map(gasHistory.map((r: any) => [new Date(r.time).toISOString().slice(0, 10), r.value]));
      const aligned: { gas: number; crude: number }[] = [];

      for (const row of crudeHistory) {
        const key = new Date(row.time).toISOString().slice(0, 10);
        const gas = gasMap.get(key);
        if (gas && row.value) aligned.push({ gas: +gas, crude: +row.value });
      }

      const gasArr   = aligned.map(r => r.gas);
      const crudeArr = aligned.map(r => r.crude);
      const ccf      = aligned.length > 14 ? calculateCrossCorrelation(gasArr, crudeArr, 12) : [];
      const rAndF    = aligned.length > 10 ? analyzeRocketsAndFeathers(
        gasArr.slice(1).map((v, i) => (v - gasArr[i]) / gasArr[i]),
        crudeArr.slice(1).map((v, i) => (v - crudeArr[i]) / crudeArr[i]),
      ) : null;

      const optimalLag = ccf.reduce(
        (best: any, cur: any) => (cur.lag <= 8 && cur.correlation > (best?.correlation ?? -Infinity)) ? cur : best,
        ccf[0],
      );

      return {
        timestamp:          new Date().toISOString(),
        correlation_coeff:  optimalLag ? +optimalLag.correlation.toFixed(3) : null,
        optimal_lag_weeks:  optimalLag?.lag ?? null,
        interpretation:     optimalLag
          ? `Crude oil price changes take ~${optimalLag.lag} week(s) to fully appear at the pump.`
          : 'Insufficient data for lag analysis.',
        rule_of_thumb:      '$10/barrel crude change ≈ $0.25/gallon at pump',
        asymmetry_index:    rAndF ? +rAndF.asymmetryRatio.toFixed(2) : null,
        asymmetry_label:    rAndF
          ? `Prices rise ${rAndF.asymmetryRatio.toFixed(1)}× faster than they fall (rockets-and-feathers effect)`
          : null,
        data_points:        aligned.length,
        disclaimer:         DISCLAIMER,
      };
    }, CACHE_TTL.HISTORICAL);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/llm/supply/health
 * Composite supply health score + per-PADD utilization
 */
router.get('/supply/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch('llm:supply:health', async () => {
      const utilRows = await getUtilizationByRegion();

      const padds = utilRows.map((r: any) => ({
        region:              r.region,
        utilization_pct:     r.utilization_pct !== null ? +r.utilization_pct.toFixed(1) : null,
        avg_52w_utilization: r.avg_utilization_52w !== null ? +r.avg_utilization_52w.toFixed(1) : null,
        z_score:             r.util_z !== undefined ? +r.util_z.toFixed(2) : null,
        classification:      r.classification ?? 'unknown',
        gasoline_stocks_mbbl: r.gasoline_stocks ? Math.round(r.gasoline_stocks / 1000) : null,
        data_as_of:          r.time,
      }));

      const usRow = padds.find((r: any) => r.region === 'US');
      const stressCount = padds.filter((r: any) =>
        ['supply_stress', 'critical'].includes(r.classification)
      ).length;

      return {
        timestamp:             new Date().toISOString(),
        national_utilization:  usRow?.utilization_pct ?? null,
        national_classification: usRow?.classification ?? null,
        supply_stress_regions: stressCount,
        supply_stress_alert:   stressCount > 0
          ? `⚠️ ${stressCount} region(s) showing supply stress — watch for price increases within 1–2 weeks.`
          : '✅ No active supply stress signals.',
        utilization_by_padd:   padds.filter((r: any) => r.region !== 'US'),
        interpretation:        'Utilization below 90% combined with low inventory signals likely near-term price spikes.',
        disclaimer:            DISCLAIMER,
      };
    }, CACHE_TTL.DISRUPTION_SCORE);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/llm/events/recent
 * Last 30 days of geopolitical energy events
 */
router.get('/events/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await cacheOrFetch('llm:events:recent', async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const events = await getEvents(since, new Date());

      return {
        timestamp: new Date().toISOString(),
        period:    'Last 30 days',
        count:     events.length,
        events:    events.map((e: any) => ({
          date:                  e.event_date,
          category:              e.category,
          title:                 e.title,
          description:           e.description ?? null,
          impact_direction:      e.impact ?? 'neutral',
          price_effect_estimate: e.impact === 'bullish' ? '↑ upward pressure on pump prices' :
                                 e.impact === 'bearish' ? '↓ downward pressure on pump prices' :
                                 '→ neutral or unclear impact',
        })),
        disclaimer: DISCLAIMER,
      };
    }, 30 * 60); // 30 min cache for events

    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/llm/forecast/naive
 * Simple 2-week naive forecast based on recent trend + seasonal baseline
 * Body: { region? }
 */
router.post('/forecast/naive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = req.body.region ?? 'NUS';

    const data = await cacheOrFetch(`llm:forecast:naive:${region}`, async () => {
      const history = await getHistoricalPrices({
        metric: 'gas_regular', region, granularity: 'weekly',
      });

      if (history.length < 8) {
        return {
          error: 'Insufficient historical data for forecast',
          disclaimer: DISCLAIMER,
        };
      }

      const recent = history.slice(0, 8); // last 8 weeks (newest first)
      const latest = recent[0].value;

      // 2-week momentum: average of last 4 weekly changes
      const changes: number[] = [];
      for (let i = 0; i < Math.min(4, recent.length - 1); i++) {
        changes.push(recent[i].value - recent[i + 1].value);
      }
      const avgWeeklyChange = changes.reduce((s, v) => s + v, 0) / changes.length;

      // Simple naive projection: current + 2×avg weekly trend
      const point2w = latest + avgWeeklyChange * 2;

      // Confidence is low for naive model; base it on recent volatility
      const variance = changes.reduce((s, v) => s + (v - avgWeeklyChange) ** 2, 0) / changes.length;
      const stddev   = Math.sqrt(variance);
      const confidence = Math.max(0.15, Math.min(0.55, 1 - stddev / Math.abs(avgWeeklyChange + 0.001)));

      return {
        timestamp:         new Date().toISOString(),
        region,
        current_price:     +latest.toFixed(3),
        forecast_2w_low:   +(point2w - 1.96 * stddev * 2).toFixed(3),
        forecast_2w_high:  +(point2w + 1.96 * stddev * 2).toFixed(3),
        forecast_2w_point: +point2w.toFixed(3),
        confidence_level:  +confidence.toFixed(2),
        methodology:       'Naive 4-week momentum model (avg weekly Δ extrapolated 2 weeks). Not suitable for investment decisions.',
        avg_weekly_change: +avgWeeklyChange.toFixed(4),
        data_points_used:  recent.length,
        disclaimer:        DISCLAIMER,
      };
    }, 60 * 60); // 1 hour cache

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
