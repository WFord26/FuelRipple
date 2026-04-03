import { Router, Request, Response, NextFunction } from 'express';
import { DashboardFiltersSchema, CACHE_TTL, GeoEvent } from '@fuelripple/shared';
import {
  getAaaNationalChanges,
  getWeeklyChanges,
  getEvents,
  getSupplyHealth,
  getSeasonalComparison,
  AaaNationalChangesRow,
} from '@fuelripple/db';
import {
  calculateDisruptionScore,
  calculateAnnualizedVolatility,
  getVolatilityClassification,
} from '@fuelripple/impact-engine';
import { cacheOrFetch } from '../services/cache';
import { mapRegion } from '../utils/regionMapper';
import type {
  DashboardHeroCard,
  DashboardAlert,
  DashboardDrilldown,
} from '@fuelripple/shared';

/** Shape of a single row returned by getWeeklyChanges() */
interface WeeklyChangeRow {
  week: string | Date;
  avg_price: number;
  prev_price: number | null;
  pct_change: number | null;
}

const router = Router();

/**
 * GET /api/v1/dashboard/overview
 *
 * Consolidated dashboard payload: hero cards, summary stats, alerts,
 * freshness metadata, and recommended drilldowns.
 *
 * Query params (all optional, defaults match DashboardFiltersSchema):
 *   fuel      — 'gas_regular' | 'diesel'       (default: 'gas_regular')
 *   region    — e.g. 'US', 'R10', 'CA'          (default: 'US')
 *   timerange — '1w' | '1m' | '3m' | '1y' | 'all' (default: '1m')
 *   compare   — comma-separated region codes     (default: none)
 *   overlay   — 'none' | 'events' | 'crude'     (default: 'none')
 */
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = DashboardFiltersSchema.safeParse({
      fuel:      req.query.fuel,
      region:    req.query.region,
      timerange: req.query.timerange,
      compare:   req.query.compare,
      overlay:   req.query.overlay,
    });

    const filters = parseResult.success ? parseResult.data : DashboardFiltersSchema.parse({});

    const metric = filters.fuel;
    const region = mapRegion(filters.region);

    const cacheKey = `dashboard:overview:${metric}:${region}:${filters.timerange}:${filters.overlay}`;

    const overview = await cacheOrFetch(
      cacheKey,
      async () => {
        // Parallel fetch all data sources
        const [aaaChanges, weeklyChanges, events, supplyHealthRows, seasonal] = await Promise.allSettled([
          getAaaNationalChanges(),
          getWeeklyChanges(metric, region === 'US' ? 'NUS' : region, 52),
          getEvents(),
          getSupplyHealth(),
          getSeasonalComparison(metric, region === 'US' ? 'NUS' : region, 5),
        ]);

        // ── Hero Cards ───────────────────────────────────────────────────────
        const changesData: AaaNationalChangesRow[] = aaaChanges.status === 'fulfilled' ? aaaChanges.value : [];

        const gradesForFuel = metric === 'diesel'
          ? ['diesel' as const]
          : ['regular' as const, 'mid_grade' as const, 'premium' as const];

        const GRADE_LABELS: Record<string, string> = {
          regular: 'Regular', mid_grade: 'Mid-Grade', premium: 'Premium', diesel: 'Diesel',
        };

        const heroCards: DashboardHeroCard[] = gradesForFuel.map((grade) => {
          const row = changesData.find((r: AaaNationalChangesRow) => r.grade === grade);
          return {
            metric: grade,
            label:  GRADE_LABELS[grade],
            currentPrice:   row?.current_price   ?? null,
            weekChangePct:  row?.week_change_pct  ?? null,
            monthChangePct: row?.month_change_pct ?? null,
            yearChangePct:  row?.year_change_pct  ?? null,
            asOf:           row?.as_of ? new Date(row.as_of).toISOString() : null,
          };
        });

        // ── Summary Stats (disruption + volatility + seasonal) ───────────────
        let disruptionScore: number | null = null;
        let disruptionClassification: string | null = null;
        let annualizedVolatility: number | null = null;
        let volatilityClassification: string | null = null;

        if (weeklyChanges.status === 'fulfilled' && weeklyChanges.value.length >= 2) {
          const changes: WeeklyChangeRow[] = weeklyChanges.value;
          const currentPrice = changes[0].avg_price;
          const previousPrice = changes[1].avg_price;
          const pctChanges = changes
            .map((c: WeeklyChangeRow) => c.pct_change)
            .filter((c): c is number => c !== null && c !== undefined);

          if (pctChanges.length >= 2) {
            const scoreResult = calculateDisruptionScore(currentPrice, previousPrice, pctChanges);
            disruptionScore = scoreResult.score;
            disruptionClassification = scoreResult.classification;

            const vol = calculateAnnualizedVolatility(pctChanges);
            annualizedVolatility = vol;
            volatilityClassification = getVolatilityClassification(vol);
          }
        }

        const seasonalData = seasonal.status === 'fulfilled' ? seasonal.value : null;

        // ── Alerts ───────────────────────────────────────────────────────────
        const alerts: DashboardAlert[] = [];

        // Supply health alerts
        if (supplyHealthRows.status === 'fulfilled') {
          for (const row of supplyHealthRows.value) {
            if (row.classification === 'critical') {
              alerts.push({
                id:       `supply:${row.region}`,
                type:     'supply_health',
                severity: 'critical',
                title:    `Critical supply stress in ${row.region}`,
                detail:   `Composite z-score: ${row.composite_z != null ? parseFloat(row.composite_z).toFixed(2) : 'N/A'}`,
                asOf:     row.latest_data_time ? new Date(row.latest_data_time).toISOString() : undefined,
              });
            } else if (row.classification === 'supply_stress') {
              alerts.push({
                id:       `supply:${row.region}`,
                type:     'supply_health',
                severity: 'warning',
                title:    `Supply stress detected in ${row.region}`,
                detail:   `Composite z-score: ${row.composite_z != null ? parseFloat(row.composite_z).toFixed(2) : 'N/A'}`,
                asOf:     row.latest_data_time ? new Date(row.latest_data_time).toISOString() : undefined,
              });
            }
          }
        }

        // Geo-event alerts (last 30 days)
        if (events.status === 'fulfilled') {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const recentEvents: GeoEvent[] = events.value.filter((e: GeoEvent) => {
            const d = new Date(e.event_date);
            return d >= cutoff;
          });
          for (const evt of recentEvents.slice(0, 3)) {
            alerts.push({
              id:       `event:${evt.id}`,
              type:     'geo_event',
              severity: evt.impact === 'bullish' ? 'warning' : 'info',
              title:    evt.title,
              detail:   evt.description ?? undefined,
              asOf:     evt.event_date ? new Date(evt.event_date).toISOString() : undefined,
            });
          }
        }

        // Price spike alert — flag if weekly change > 5%
        const primaryHero = heroCards[0];
        if (primaryHero?.weekChangePct != null && Math.abs(primaryHero.weekChangePct) > 5) {
          alerts.unshift({
            id:       'price:weekly_spike',
            type:     'price_spike',
            severity: 'warning',
            title:    `${primaryHero.label} prices moved ${primaryHero.weekChangePct > 0 ? '+' : ''}${primaryHero.weekChangePct.toFixed(1)}% this week`,
            asOf:     primaryHero.asOf ?? undefined,
          });
        }

        // ── Freshness ────────────────────────────────────────────────────────
        const pricesAsOf = heroCards[0]?.asOf ?? null;
        const eventsAsOf = events.status === 'fulfilled' && events.value.length > 0
          ? new Date(events.value[0].event_date).toISOString()
          : null;
        const supplyAsOf = supplyHealthRows.status === 'fulfilled' && supplyHealthRows.value.length > 0
          ? (() => {
              const t = supplyHealthRows.value[0].latest_data_time;
              return t ? new Date(t).toISOString() : null;
            })()
          : null;

        // ── Drilldowns ───────────────────────────────────────────────────────
        const drilldowns: DashboardDrilldown[] = [];

        if (disruptionClassification === 'high' || disruptionClassification === 'crisis') {
          drilldowns.push({
            label:  'View Volatility Analysis',
            path:   '/historical',
            reason: `Disruption score is ${disruptionClassification} — deeper price trend context may be useful`,
          });
        }

        if (alerts.some(a => a.type === 'supply_health')) {
          drilldowns.push({
            label:  'Explore Supply Health',
            path:   '/supply',
            reason: 'Supply stress detected in one or more PADD regions',
          });
        }

        if (alerts.some(a => a.type === 'geo_event')) {
          drilldowns.push({
            label:  'Review Geopolitical Events',
            path:   '/historical',
            reason: 'Recent market-moving events recorded',
          });
        }

        if (seasonalData && Math.abs(seasonalData.deltaPct ?? 0) > 5) {
          drilldowns.push({
            label:  'Seasonal Comparison',
            path:   '/historical',
            reason: `Prices are ${(seasonalData.deltaPct ?? 0) > 0 ? 'above' : 'below'} the seasonal average by ${Math.abs(seasonalData.deltaPct ?? 0).toFixed(1)}%`,
          });
        }

        drilldowns.push({
          label:  'Regional Breakdown',
          path:   '/comparison',
          reason: 'Compare prices across all PADD regions and states',
        });

        return {
          heroCards,
          summaryStats: {
            disruptionScore,
            disruptionClassification,
            annualizedVolatility,
            volatilityClassification,
            seasonalDelta:    seasonalData?.delta    ?? null,
            seasonalDeltaPct: seasonalData?.deltaPct ?? null,
          },
          alerts,
          freshness: {
            prices:       pricesAsOf,
            disruption:   pricesAsOf,   // derived from same price data
            supplyHealth: supplyAsOf,
            events:       eventsAsOf,
          },
          drilldowns,
          filters,
        };
      },
      CACHE_TTL.DASHBOARD_OVERVIEW
    );

    res.json({ status: 'success', data: overview });
  } catch (error) {
    next(error);
  }
});

export default router;
