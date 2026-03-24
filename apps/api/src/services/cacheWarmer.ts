/**
 * Warms the Redis/L1 cache for all dashboard endpoints on server startup.
 * Runs in the background after the server starts listening, so it does not
 * block the server from accepting user requests.
 *
 * Covers both fuel types (gas_regular + diesel) for all queries that the
 * Dashboard page fires on mount. A cold Redis instance (e.g. after a fresh
 * deploy) will otherwise make the first visitor trigger 13+ sequential DB
 * queries; warming runs those in parallel server-side where the DB latency
 * is lowest.
 */

const DASHBOARD_ENDPOINTS = [
  // Prices
  '/api/v1/prices/current?metric=gas_regular',
  '/api/v1/prices/current?metric=diesel',
  '/api/v1/prices/current?metric=crude_wti',
  '/api/v1/prices/changes?metric=gas_regular&region=NUS',
  '/api/v1/prices/changes?metric=diesel&region=US',
  '/api/v1/prices/comparison?metric=gas_regular',
  '/api/v1/prices/comparison?metric=diesel',
  '/api/v1/prices/seasonal?metric=gas_regular&region=NUS&years=5',
  '/api/v1/prices/seasonal?metric=diesel&region=US&years=5',
  // Disruption
  '/api/v1/disruption/score?metric=gas_regular&region=NUS',
  '/api/v1/disruption/score?metric=diesel&region=US',
  '/api/v1/disruption/volatility?metric=gas_regular&region=US&window=30',
  '/api/v1/disruption/volatility?metric=diesel&region=US&window=30',
  // Impact
  '/api/v1/impact/fuel-cost/typical',
  '/api/v1/impact/downstream',
  // Supply
  '/api/v1/supply/health',
  '/api/v1/supply/inventories?region=US&weeks=4',
  // AAA + Events
  '/api/v1/aaa/national/changes',
  '/api/v1/events',
];

export async function warmDashboardCache(port: number | string): Promise<void> {
  const base = `http://localhost:${port}`;
  console.log('🔥 Warming dashboard cache...');

  const results = await Promise.allSettled(
    DASHBOARD_ENDPOINTS.map((path) =>
      fetch(`${base}${path}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
    )
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

  if (failed.length > 0) {
    failed.forEach((f) =>
      console.warn(`⚠️  Cache warm skipped: ${(f as PromiseRejectedResult).reason?.message}`)
    );
  }
  console.log(`✅ Cache warm: ${succeeded}/${DASHBOARD_ENDPOINTS.length} endpoints ready`);
}
