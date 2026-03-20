# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [1.1.5] - 2026-03-20


### Added
- **Test coverage — `@fuelripple/db` queries** — expanded `packages/db/src/__tests__/queries.test.ts`
  with 38 new tests covering all previously untested query modules:
  - `aaa.ts`: full coverage (0% → **100%**) across all 13 exported functions —
    `upsertNationalAverages`, `getRecentNationalAverages`, `getAaaNationalChanges`,
    `upsertStateAggregates`, `getStateAggregatesForDate`, `getAaaStateLatest`,
    `getAaaStateHistory`, `getAaaStateChanges`, `getAllAaaStatesLatest`,
    `upsertPaddAggregates`, `getAaaPaddLatest`, `getAaaPaddHistory`, `getAllAaaPaddLatest`
  - `supply.ts`: full coverage (0% → **100%**) across all 8 exported functions —
    `upsertRefineryData`, `getUtilizationByRegion`, `getProductionData`,
    `getInventoryData`, `getSupplyHealth`, `getFlowData`, `getCapacityData`,
    `upsertCapacityData`
  - `createChainableMock()` helper enhanced with `andWhere` and `merge` methods to
    support upsert and date-range query patterns
  - Overall `@fuelripple/db` statement coverage: **16.89% → 58.39%**
- **Test coverage — `@fuelripple/api` integration tests** — extended
  `apps/api/src/test/api.integration.test.ts` with 16 new endpoint tests and
  9 additional `@fuelripple/db` mock functions:
  - AAA route mocks added: `getRecentNationalAverages`, `getAaaNationalChanges`,
    `getAaaStateLatest`, `getAaaStateHistory`, `getAaaStateChanges`,
    `getAllAaaStatesLatest`, `getAaaPaddLatest`, `getAaaPaddHistory`, `getAllAaaPaddLatest`
  - New `AAA endpoints` describe block exercises all 10 AAA routes:
    `/national`, `/national/latest`, `/national/changes`, `/states`,
    `/state/:abbr/latest`, `/state/:abbr`, `/state/:abbr/changes`,
    `/regions`, `/region/:padd/latest`, `/region/:padd`
  - New `Supply endpoints` describe block exercises all 6 supply routes:
    `/utilization`, `/production`, `/inventories`, `/health`, `/flow`, `/capacity`
  - Previously failing `prices/current` tests (`getLatestPricesSnapshot is not a
    function`) now pass — mock was present but Turbo cache was replaying a stale run
  - API route coverage improvements: `aaa.ts` **17% → 74.5%**, `supply.ts`
    **13% → 82.95%**, overall API statement coverage **37.5% → 53.59%**
  - Total API test count: **51 → 67 tests** across 3 suites (all passing)

---

---

## [1.1.0-beta.3] - 2026-03-20

### Added
- **Historical fuel prices page overhaul** (`apps/web/src/pages/Historical.tsx`) — complete
  redesign with AAA daily data, all 4 fuel grades, and enhanced Recharts visualization:
  - Full support for all 4 AAA fuel grades (Regular, Mid-Grade, Premium, Diesel) replacing
    the EIA single-grade approach; users can toggle any combination for comparison
  - Regional drill-down: National (US) → PADD region (5 regions) → Individual state (51 states)
  - Time range buttons: 7D, 30D, 90D, 1Y, 5Y, All-Time (configurable limit parameter)
  - **Recharts LineChart** with multi-series support (replaces Elastic Charts):
    - Clean, responsive design scales to any screen size
    - Tooltip shows prices for all selected grades on hover
    - Legend dynamically updates based on active fuel toggles
    - Smooth line interpolation for volatility visualization
  - **7-day Moving Average overlay** — optional toggle to smooth out daily fluctuations
    and reveal underlying trends; computed client-side for both regular and diesel
  - **Enhanced statistics cards** for each active fuel grade showing:
    - Current price ($X.XX) with period-over-period % change (colored red/green)
    - 7-day and 30-day % changes for short-term volatility tracking
    - Min, Max, and Average prices across the selected time range
  - Data source attribution footer explains AAA (daily state aggregates, population-weighted
    regional means) vs Yahoo Finance (crude oil feeds)
  - Client-side API method `getAaaPaddHistory(padd, limit)` added to fetch PADD historical
    data alongside national and state endpoints
- **Daily crude oil and gas data endpoints** for intraday correlation analysis:
  - New DB query helpers in `@fuelripple/db`:
    - `getDailyCrudePrices(metric, days)` — daily OHLC crude oil from Yahoo Finance
      (WTI/Brent) with open/high/low/close/average prices
    - `getDailyAaaGasPrices(metric, days)` — daily national average gas prices from
      AAA, replacing EIA weekly bucketing for fresher data
    - `getDailyCorrelationSeries(days)` — aligned daily gas (AAA) + crude (Yahoo)
      by date for dual-axis charting without weekly aggregation
  - Three new API endpoints in correlation route:
    - `GET /api/v1/correlation/daily-crude` — daily WTI/Brent prices (6-hour cache
      during trading hours)
    - `GET /api/v1/correlation/daily-gas-aaa` — daily AAA gas prices (24-hour cache)
    - `GET /api/v1/correlation/daily-series` — pre-aligned daily gas+crude series
  - New client API methods in `apps/web/src/api/client.ts`:
    - `getDailyCrudePrices()` — fetch daily crude
    - `getDailyAaaGasPrices()` — fetch daily AAA gas
    - `getDailyCorrelationSeries()` — fetch aligned daily series
- **Enhanced Correlation page** with real-time crude oil tracking:
  - New "Daily WTI Crude Oil — Last Year" chart showing real-time (15-min delayed)
    Yahoo Finance prices with OHLC visualization
  - Line chart displays Close (solid), Daily Average (dashed), High, Low, Open prices
  - Intraday data refreshes every 6 hours during NYSE trading hours for fresh market
    rates instead of stale weekly EIA data
  - Updated weekly correlation analysis to source gas prices from AAA national
    averages instead of EIA weekly data, improving accuracy for pump price lag
    calculations

### Changed
- **Correlation price series logic** (`getCorrelationSeries` in `@fuelripple/db`)
  now uses `aaa_national_averages` table instead of `energy_prices` for gas_regular
  metric, and filters crude_wti to source='yahoo' for Yahoo Finance daily data
- Import chart component updated in Correlation page to include `LineChart` from
  Recharts for daily crude visualization

---

## [1.1.0-beta.2] - 2026-03-20

### Added
- **AAA-derived PADD regional aggregates** — daily PADD-level gas price data computed
  from existing per-state AAA data, replacing the need for weekly EIA regional series:
  - New table `aaa_padd_aggregates` (TimescaleDB hypertable, 30-day chunks) stores two
    aggregation methods for every grade (regular, mid-grade, premium, diesel) per PADD
    region per day:
    - `*_mean` — simple arithmetic mean across all reporting states in the region
    - `*_wtd` — population-weighted mean using 2020 US Census state populations, so
      high-population states (CA, TX, FL) carry their proportional weight
  - `STATE_POPULATIONS` constant added to `@fuelripple/shared` (2020 Census data for
    all 50 states + DC), used for weighting in both the job queue and backfill script
  - Job queue (`processAAAPrices`) now computes and upserts PADD aggregates immediately
    after the daily state aggregate pass — all 5 regions updated daily at 9 AM ET
  - New DB query helpers: `upsertPaddAggregates`, `getAaaPaddLatest`,
    `getAaaPaddHistory`, `getAllAaaPaddLatest` (exported from `@fuelripple/db`)
  - Three new API endpoints:
    - `GET /api/v1/aaa/regions` — latest row for all 5 PADD regions
    - `GET /api/v1/aaa/region/:padd/latest` — latest row for a single region
    - `GET /api/v1/aaa/region/:padd` — historical rows (default 90 days, max 365)
    - All endpoints return both `*_mean` and `*_wtd` columns; cached 24 hours
  - Backfill script `apps/api/src/scripts/backfill-aaa-padd.ts` computes PADD
    aggregates from all existing `aaa_state_aggregates` data in one pass:
    - CLI flags: `--start`, `--end`, `--dry-run`
    - Registered as `npm run --workspace=@fuelripple/api backfill-aaa-padd`
  - Migration: `packages/db/migrations/20260320000001_create_aaa_padd_aggregates.ts`
- **Regional price comparison page** (`apps/web/src/pages/Comparison.tsx`) refactored
  to showcase all 4 fuel grades across all 5 PADD regions using daily AAA data:
  - Four-button toggle selects individual grade (Regular, Mid-Grade, Premium, Diesel)
  - Dual-method selector switches between `*_mean` and `*_wtd` (population-weighted)
    aggregations on the fly — updates all regional data simultaneously
  - Summary cards display National Average, Price Range (min–max spread), and Price
    Variance (%) calculated across the 5 PADD values for the selected grade+method
  - Interactive bar chart ranks all 5 PADDs by price for the selected metric
  - US state choropleth map displays each state colored by its individual regular gas
    price; PADD region borders overlaid; click any state to navigate to its detail page
  - Collapsible PADD region cards show per-region price (`$X.XXX`), percentage vs
    national average (`±Y.Z%`), and a sortable list of all states in that PADD with
    individual prices (states without AAA reporting marked "no data"); click any state
    to detail page
  - Regional insights panel explains why certain regions systematically run hot/cold
    (e.g., Gulf Coast refining capacity, West Coast blend requirements, Rocky Mountain
    transport costs)
- **AAA data freshness enhancements** — improved scraper reliability and comprehensive
  architectural documentation:
  - New scraper module `apps/api/src/services/aaaClientV2.ts` delivering:
    - Parallel batch requests (max 5 concurrent) replacing sequential calls for ~5x
      faster completion
    - Exponential backoff retry logic with configurable attempt counts (3 morning, 2
      intraday)
    - Multiple HTML parsing strategies with fallback to regex text-match; handles
      historical layout changes on the AAA site
    - Automatic early termination if success rate drops below 60% to prevent rate
      limiting
    - Comprehensive metrics tracking: total time, per-state average, per-request
      average
  - Optional **intraday scraping** at 4 PM ET (weekdays) via `AAA_INTRADAY_ENABLED=true`
    in `.env`; allows tracking mid-day price changes for high-volatility scenarios
  - Comprehensive new **`docs/AAA_DATA_INTEGRATION.md`** reference guide covering:
    - Architecture layer (scraper → DB → cache → API)
    - Schedule and SLAs (daily 9 AM ET primary, optional 4 PM ET intraday)
    - Data quality metrics (`state_count` tracking success rate)
    - Limitations (stale cache behavior on Wayback fallback, weekday-only intraday)
    - Test strategy and local development instructions

### Changed
- **Job queue `processAAAPrices()`** now invokes `aaaClientV2` instead of `aaaClient`
  for improved concurrency and resilience

---

## [1.1.0-beta.1] - 2026-03-20

### Added
- **Wayback Machine historical backfill** — new script `apps/api/src/scripts/backfill-aaa-wayback.ts`
  recovers state-level AAA gas prices from Internet Archive snapshots of
  `gasprices.aaa.com/state-gas-price-averages/` dating back to Nov 2017:
  - Queries CDX API with `collapse=timestamp:8` (one snapshot per day) to enumerate
    ~1,655 archived snapshots
  - Fetches and parses each snapshot with `cheerio`; handles two known HTML layouts
    (pre-2020 and 2020+) with a regex text-match fallback
  - Writes to `energy_prices` with `source='aaa_wayback'` for clear provenance; uses
    `onConflict().ignore()` so re-runs are safely idempotent
  - Polite 1,200 ms delay between Wayback requests; auto-retries on 429/503 with
    `Retry-After` header support
  - CLI flags: `--start`, `--end`, `--delay`, `--limit`, `--dry-run`, `--out` (CSV)
  - Registered as `npm run --workspace=@fuelripple/api backfill-aaa-wayback`
- **Live AAA state scraper script** — `apps/api/src/scripts/fetch-aaa-today.ts` scrapes
  all 51 states from the live AAA website and upserts into the database:
  - Uses `Date.UTC()` for a consistent UTC-midnight timestamp, preventing timezone-
    driven duplicate records
  - Deletes any existing same-day rows from `aaa_state_aggregates` before inserting
    to eliminate stale duplicate entries
  - Calls `initializeCache()` before `clearCache()` to ensure Redis L2 is properly
    connected within the script process
  - Registered as `npm run --workspace=@fuelripple/api fetch-aaa-today`
- **`GET /api/v1/aaa/states`** — new endpoint returns the latest AAA prices for all
  51 states in a single response; backed by `getAllAaaStatesLatest()` which uses
  `DISTINCT ON (state) … ORDER BY state, time DESC`
- **`getAllAaaStatePrices()`** client helper in `apps/web/src/api/client.ts` — fetches
  all-states latest AAA data for the `/state-prices` comparison page
- **`getStatePrice(abbr)`** client helper — EIA fallback for states without AAA data

### Changed
- **State detail page refactored** (`apps/web/src/pages/State.tsx`):
  - *Current Prices* section replaced the single-grade toggle with a 4-row table
    (Regular, Mid-Grade, Premium, Diesel) showing state price, national average, and
    percentage difference side-by-side for every grade simultaneously
  - *Price History by Grade* section replaced 4 individual change cards with a
    full-width comparison table — all 4 grades × Current, 1 Week Ago, 1 Month Ago,
    3 Months Ago, 1 Year Ago with colour-coded change badges in every cell
  - Regular Gas / Diesel toggle moved from the changes section to sit inline with the
    *Price History* chart header, where it controls the chart only
  - Data source: now uses live AAA state data (all 51 states) with EIA regional data
    as fallback; previously used synthetic seed data for only 8 states
- **`backfill-aaa-state.ts` region code fix** — the script was storing EIA duoarea
  codes (`SCO`) directly as the `state` column in `aaa_state_aggregates` instead of
  converting to 2-letter abbreviations (`CO`). Fixed by importing `STATE_INFO` from
  `regionMapper` and mapping each `region` through `STATE_INFO[region]?.abbr` before
  upsert, so the chart history query (`WHERE state = 'CO'`) resolves correctly

### Fixed
- **Downstream page — Sankey diagram pass-through modeling** — the `computeSankeyData()`
  function was displaying an economically implausible split: carriers appeared to absorb
  only ~10% of freight cost increases while consumers bore ~90%, contradicting the
  elasticity constants (0.10–0.20). Root cause: pass-through logic was not properly
  modeling the elasticity ratio `avgCPIIncrease / freightRateIncreasePercent`. Fixed by:
  - Simplified Sankey from 7 nodes to 5 focused nodes (Freight Rate → {CPI pass-through,
    Absorbed by carriers} → {Food, Other Goods}), reducing visualization confusion
  - Freight cost split now correctly models elasticity: ~15% flows to consumers as CPI,
    ~85% absorbed by carriers/retailers (compression of logistics margins)
  - Updated legend to explicitly show the 15%/85% split backed by BLS elasticity data
  - Removed unused intermediate nodes (diesel, trucking costs, freight surcharges as
    separate nodes) that mixed dollars and percentages; now purely percentage-based
  - Pass-through ratio calculated as `Math.max(0.05, Math.min(0.25, elasticity))` to
    clamp to realistic bounds and prevent edge-case visualization glitches
- **Stale T06:00:00Z duplicate rows** — the first run of `fetch-aaa-today` stored
  records at local-midnight (CDT = UTC−6, yielding `T06:00:00Z`), conflicting with
  seed data already at `T00:00:00Z` for the same date. Fixed by switching to
  `new Date(Date.UTC(…))` so all records consistently land at UTC midnight
- **Redis not cleared in script context** — `clearCache()` called without first
  calling `initializeCache()` left the script's Redis client as `null`, silently
  skipping the L2 cache bust. Fixed by adding `initializeCache()` at script startup
- **L1 LRU cache serving stale prices** — after a fresh scrape the Express server's
  in-process LRU cache still served old data until its 5-minute TTL expired or the
  server restarted. Resolved by restarting the dev server after each data refresh

---

## [1.1.0-beta.0] - 2026-03-19

### Added (Phase 0 — Blog & Footer)
- **Version display in footer** — frontend and backend versions now displayed in the site 
  footer, pulled from respective `package.json` files:
  - *Frontend*: version injected at build time by Vite (`__APP_VERSION__` global from 
    `apps/web/package.json`)
  - *API*: version endpoint `/api/v1/health` returns API version from 
    `apps/api/package.json` with 1-hour cache TTL
  - *Frontend hook*: `useApiVersion()` fetches API version using TanStack Query for 
    client-side display in Layout footer
- **Blog article visualizations** — five existing blog articles enhanced with interactive
  charts, data tables, and callout boxes:
  - `ArticleChart` component — responsive Recharts-based bar/line charts with
    multi-series support and auto-assigned color palette; exported from
    `apps/web/src/content/components/ArticleChart.tsx`
  - `ArticleTable` component — styled data table accepting `headers` + `rows`
    (keyed objects matching header strings exactly); co-located in the same file
  - `ArticleCallout` component — color-coded info/warning/tip highlight boxes;
    co-located in the same file
  - All components registered in `apps/web/src/content/components/index.tsx` for
    MDX provider and available via named import in each `.mdx` file
  - *rockets-and-feathers*: asymmetry visualization bar chart + household cost
    impact table
  - *why-gas-prices-spike-refineries*: PADD supply profile table + West Coast
    outage history table + callouts
  - *padd-regions-explained*: PADD premium bar chart (West Coast vs. national)
    + regional inequality callout
  - *2022-energy-crisis-geopolitics*: PADD regional price impact table + timeline
      callouts
  - *monthly-fuel-cost-tracker*: budget scenario table + disruption index line
    chart + tip callouts


### Added (Phase 1 — AAA Data Layer)
- **AAA National Averages** — new `aaa_national_averages` hypertable stores daily 
  USA-wide average gas prices (regular, mid-grade, premium, diesel) computed from
  per-state AAA data. Includes `state_count` field for data quality tracking. 
  Job queue processes daily at 9 AM ET; backfill script `backfill-aaa-national.ts` 
  computes historical averages from existing per-state data.
- **Latest Prices Snapshot** — new `latest_prices` table provides O(1) lookup for 
  current prices by region and metric, eliminating hypertable scans for 
  `/api/v1/prices/current` endpoint.
- **AAA State Aggregates** — new `aaa_state_aggregates` table pre-aggregates per-state 
  AAA prices at the state level, enabling fast state-level queries without scanning 
  raw `energy_prices`.
- **Cache TTL Constant** — `CACHE_TTL.AAA_NATIONAL` (24 hours) added to `@fuelripple/shared` 
  to standardize caching for daily update cycles.
- **AAA National routes** — `GET /api/v1/aaa/national` and `GET /api/v1/aaa/national/latest` 
  serving daily all-grades national averages (regular, mid-grade, premium, diesel).
- **Dashboard AAA integration** — Dashboard National Average section replaced with 
  AAA-sourced data table showing all grades with week/month/3-month/year historical 
  comparisons and percentage change indicators.

### Added (Phase 2 — Server-Side Pre-computed Metrics)
- **Price Changes Cache** — new `price_changes_cache` table pre-computes week/month/
  3-month/year price deltas for every (metric, region) combination. Refreshed after 
  each EIA ingest so `/prices/changes` is an O(1) key lookup rather than a 
  multi-point hypertable scan.
- **AAA National Changes endpoint** — `GET /api/v1/aaa/national/changes` computes 
  7-day/30-day/90-day/1-year lookbacks server-side from `aaa_national_averages` for 
  all four grades, returning a compact snapshot. Eliminates the need for the frontend  
  to download 365 rows to perform four price lookups.
- **Dashboard payload reduction** — Dashboard now calls `/aaa/national/changes` instead 
  of fetching 365-row history and looping client-side, reducing the dashboard 
  initial payload significantly.

### Added (Phase 3 — State-Level AAA Data)
- **State-level AAA queries** — new DB query functions in `@fuelripple/db` for fast 
  state-level lookups:
  - `getAaaStateLatest(state)` — current AAA average for all 4 grades in a state
  - `getAaaStateHistory(state, limit)` — recent historical AAA prices for a state (default 90 days)
  - `getAaaStateChanges(state)` — pre-computed 7d/30d/90d/1y price deltas per grade in a state
- **State-level AAA endpoints** — new routes in `/api/v1/aaa/state/:abbr`:
  - `GET /api/v1/aaa/state/:abbr/latest` — current state-level averages
  - `GET /api/v1/aaa/state/:abbr` — historical state-level prices (limit param, default 90)
  - `GET /api/v1/aaa/state/:abbr/changes` — pre-computed price changes by grade
- **State-level AAA client functions** — new helpers in `apps/web/src/api/client.ts`:
  - `getAaaStateLatest(abbr)` — fetch current state prices
  - `getAaaStateHistory(abbr, limit)` — fetch historical state prices
  - `getAaaStateChanges(abbr)` — fetch pre-computed state price changes
- **State detail pages now AAA-powered** — [State].tsx completely refactored to use 
  state-level AAA data instead of EIA regional data:
  - Pricing source: AAA state aggregates (daily, covers all 50 states + DC)
  - Historical charts: 90-day AAA state history with fuel-type toggle (regular/diesel)
  - Price changes: All 4 lookback periods (7d/30d/90d/1y) from pre-computed server deltas
  - National comparison: Shows state vs. AAA national average with % variance badge
  - Simplified UI: Removed PADD regional reference cards (AAA is state-level only)
  - All 4 fuel grades: regular, mid-grade, premium, diesel (displayed by toggle)

### Optimized
- **Data Layer Caching** — AAA backfill script now invalidates Redis cache after 
  upserting to ensure API returns fresh data on next request.

---

## [1.0.6] - 2026-03-16

### Added
- **Azure Application Insights analytics** — end-to-end telemetry across the
  frontend, API, and infrastructure.
  - *Frontend*: `src/lib/appInsights.ts` initializes the SDK + `ReactPlugin`;
    `usePageTracking()` hook auto-tracks every React Router navigation;
    `useTrackEvent(category)` returns a stable callback for custom feature
    events. `AppInsightsContext.Provider` wraps the React tree in `main.tsx`.
    No-ops automatically when `VITE_APPINSIGHTS_CONNECTION_STRING` is unset
    (zero impact on local dev).
  - *API*: `src/lib/appInsights.ts` enables auto-collection of HTTP requests,
    outgoing dependencies (EIA, FRED, AAA), exceptions, performance counters,
    and console errors. Initialized before all other imports to allow SDK
    monkey-patching. Exports `trackApiEvent`, `trackApiException`, and
    `trackMetric` for manual telemetry in route handlers and services.
  - *ErrorBoundary*: `componentDidCatch` now forwards captured React errors to
    Application Insights with section label and component stack as properties.
  - *Infrastructure*: new `infra/modules/app-insights.bicep` provisions a
    workspace-based Log Analytics workspace + Application Insights component.
    `main.bicep` wires the module and threads the connection string into the
    API App Service app settings automatically on deploy. Outputs include
    `appInsightsConnectionString`, `appInsightsResourceId`, and
    `logAnalyticsWorkspaceId`.
  - *CI/CD*: `deploy.yml` passes `VITE_APPINSIGHTS_CONNECTION_STRING` as a
    Docker build arg sourced from the `APPINSIGHTS_CONNECTION_STRING` GitHub
    Environment secret, baking it into the Vite bundle at build time.

---

## [1.0.5-beta.0] - 2026-03-15

### Added
- **FRED crude oil in backfill** — `backfillCrudePrices()` now also fetches
  DCOILWTICO (WTI) and DCOILBRENTEU (Brent) daily spot prices from FRED,
  extending crude history back to 1986. Stored with `source='fred'` alongside
  existing Yahoo Finance (`source='yahoo'`) data.
- **Supply-squeeze alert** — new end-to-end feature: API `/supply/health`
  returns a `squeezeAlert` object (active flag, affected regions, description)
  when utilization z > 1 AND inventory z < −1 simultaneously. Frontend
  `Supply.tsx` shows an amber alert banner when active.
- **Methodology page** (`/methodology`) — documents every formula in
  `@fuelripple/impact-engine` with reference constants, classification
  thresholds, data-source freshness, pass-through lag table, and a full
  **Supply Health Monitor** section covering utilization stress index, inventory
  health, classification thresholds, and supply-squeeze trigger conditions.
- **Footer restructured** — replaced single-line pipe-delimited footer with a
  3-column responsive grid (brand | resource links | data sources) plus
  copyright bar. Data Status moved from main nav to footer links.

### Changed
- **Disruption score recalibrated** — added 3-week EMA smoothing (α = 0.5) and
  direction signal (rising / falling / stable). Volatility thresholds
  recalibrated for gasoline: calm < 15%, moderate < 30%, elevated < 50%,
  extreme ≥ 50%. DB query now uses `ROW_NUMBER` with source priority
  (EIA > AAA) to avoid mixing daily AAA and weekly EIA data.
- **Downstream impact rewritten** — extracted magic numbers into named
  constants: `BASE_FREIGHT_RATE_PER_MILE` ($2.70), `DIESEL_COST_PER_MILE_FACTOR`
  (0.16), `CPI_FREIGHT_ELASTICITY` (0.10–0.20), `FOOD_TRANSPORT_SHARE` (0.09).
  Accepts rolling 52-week baseline via API. Added pass-through lag timelines.
  Sankey diagram shows food as CPI subset (not additive).
- **Supply health classification** — rewrote to use both utilization AND
  inventory z-scores with cross-trigger logic. Days-of-supply now uses
  `product_supplied_gas` (true implied demand) instead of production.
- **Impact page** — `VolBadge` supports 4 levels, `DisruptionMeter` shows
  direction arrow, volatility gauge labels match new thresholds, downstream
  section shows dynamic baseline source and lag timelines.
- **EIA crude price pagination** — `fetchCrudePrices()` now paginates (5000
  rows per page) instead of hard-capping at 500 rows.

### Fixed
- **Backfill shared-memory errors** — reduced `insertPrices` chunk size from
  1000 → 50 rows and sort by time before inserting, so each batch touches fewer
  TimescaleDB hypertable partitions. Same fix applied to `insertIndicators`
  (added chunking) and `upsertRefineryData` (500 → 200). `refreshMaterializedViews`
  now handles each view independently with `CONCURRENTLY` fallback.
- **Azure PostgreSQL `max_locks_per_transaction`** — increased from 64 → 256
  to support materialized view refreshes across decades of hypertable chunks.

### Data
- **Maximum historical backfill** — pulled all available history from 1983:
  - EIA gas prices: **41,238** records (29 regions, weekly from ~1993)
  - Yahoo Finance crude: **11,049** records (WTI daily from 1983, Brent from 2007)
  - FRED crude: **19,959** records (WTI daily from 1986, Brent from 1987)
  - EIA diesel: **16,869** records (11 regions, weekly from ~1994)
  - FRED economic indicators: **1,500** records (CPI, PPI from 1983)
  - EIA refinery/supply: **17,218** records (utilization, production, stocks)

---

## [1.0.4] - 2026-03-15
### Changed

- **Rockets & Feathers asymmetry** — rewrote `analyzeRocketsAndFeathers()` in
  `@fuelripple/impact-engine` to measure true elasticity ratio (gas Δ% per 1%
  crude Δ, rise vs fall) instead of raw magnitude comparison. Added cumulative
  pass-through speed (week 0–4) and half-life metrics. Updated API response,
  frontend visualization with pass-through bar chart and half-life cards.

### Fixed

- **CORS multi-origin support** — API now parses comma-separated `CORS_ORIGIN`
  env var; Bicep sets both `www.fuelripple.com` and `fuelripple.com`. Added
  diagnostic logging on startup and in `/health` endpoint.

---

## [1.0.3] - 2026-03-15
### Added
- **WTI Crude Oil card** on the dashboard — displays latest WTI closing price with
  pump-price sensitivity note ($10/bbl ≈ $0.25/gal), sourced from existing
  `crude_wti` data in `energy_prices`
- **Gasoline Inventory days-of-supply card** — shows estimated days of supply with a
  z-score badge vs 52-week seasonal norm (color-coded orange/red below -1σ/-2σ);
  consumes `/api/v1/supply/inventories`
- **Seasonal Context card** — compares the current gas price against the 5-year
  average for the same ISO week, showing the dollar and percentage delta
  - New DB query `getSeasonalComparison()` in `@fuelripple/db`
  - New API endpoint `GET /api/v1/prices/seasonal`
  - New client helper `getSeasonalComparison()` in `apps/web/src/api/client.ts`
- **Recent Market Events feed** — surfaces the 5 most recent `geo_events` rows on the
  dashboard with impact direction badges (bullish/bearish), category labels, and dates
- **Volatility badge** — inline next to the Disruption Score, showing annualized
  volatility % and classification (calm / moderate / elevated / extreme)
- **`getCurrentCrudePrice()` client helper** (`apps/web/src/api/client.ts`) — thin
  wrapper around `/prices/current?metric=crude_wti`
- **State detail page** (`/state/:stateAbbr`) — new route showing per-state gas price
  breakdown with:
  - Current price vs national and PADD regional averages (with % diff badges)
  - Seasonal comparison against 5-year same-week average
  - Price change cards (1 week, 1 month, 3 months, 1 year ago)
  - Historical weekly price chart (PriceChart component)
  - Annual household fuel cost calculated at the state price
  - Visual price-position bars vs national, PADD, and seasonal averages
  - Graceful fallback for states EIA doesn't report (shows PADD average as proxy)
- **Clickable state map** — `USPriceMap` component now accepts `onStateClick` prop;
  clicking any state on the Dashboard or Regional Comparison page navigates to
  `/state/{abbr}`
- **Fuel type toggle (Regular Gas / Diesel)** — pill-style toggle on both the Dashboard
  and State detail page switches all price queries, disruption score, volatility,
  seasonal comparison, regional map, and price change cards between `gas_regular` and
  `diesel` metrics. AAA already scrapes diesel per state; EIA provides national diesel.
- **State-level EIA diesel data** — expanded `fetchDieselPrices()` to fetch all regions
  (50 states + PADDs + national) with pagination, matching the `fetchAllGasPrices()`
  pattern. Updated `processDieselPrices` (job queue) and `backfillDieselPrices`
  (backfill script) to handle multi-region results. Historical diesel charts now
  populate at the state level, not just national.
- **Synthetic state-level history backfill** (`--sources states`) — for the ~40 states
  where EIA lacks direct weekly gas/diesel data, generates estimated price history by
  applying current AAA state-to-PADD price ratios to PADD-level EIA time series.
  Inserted as `source='estimated'` to distinguish from real data. Added `'estimated'`
  to the `EnergyPriceSchema` source enum in `@fuelripple/shared`.
- **Materialized view refresh in backfill** — backfill script now calls
  `refreshMaterializedViews()` after all sources complete, so historical data is
  immediately visible to the API (previously views were stale after backfill).
- **Diesel inventory on dashboard** — inventory days-of-supply card now switches between
  gasoline and distillate (diesel) metrics when the fuel type toggle is changed. Added
  `distillate_days_supply` and `distillate_z_score` to the `getInventoryData()` query
  in `@fuelripple/db`, using `distillate_production` as the demand proxy for days of
  supply and a 52-week rolling window for z-score.

### Fixed
- **CI/CD deploy workflow** — updated health-check URLs, removed Bicep infra job,
  removed resource-group verification step, scoped dev deploys to push and prod to
  `workflow_dispatch`

---

## [1.0.2] - 2026-03-15

### Added
- **Full test coverage across all packages** — replaced every placeholder test
  (`expect(true).toBe(true)`) with real assertions; 216 tests now passing across
  5 packages
  - `@fuelripple/shared` — 56 tests (Zod schema validation, constants/PADD regions,
    EIA/FRED series IDs, cache TTL, rate limits)
  - `@fuelripple/impact-engine` — 60 tests (fuel cost calculations, disruption scoring,
    cross-correlation/optimal lag, downstream freight & CPI impact)
  - `@fuelripple/db` — 16 tests (Knex config per environment, query helpers with
    mocked knex chainable API)
  - `@fuelripple/api` — 51 tests (error handler middleware, region mapper utilities,
    full HTTP integration tests via supertest for prices, disruption, impact,
    correlation, and events endpoints)
  - `@fuelripple/web` — 33 tests (API client wrappers with mocked axios, Layout
    component rendering, ErrorBoundary error/recovery states, SEO hook meta tags,
    App component smoke test)

### Fixed
- **`findOptimalLag` production bug** (`packages/impact-engine/src/correlation.ts`) —
  initialized `maxCorr` to `-Infinity`, but compared via `Math.abs()` which made it
  `Infinity`; no correlation could ever exceed it, so the function always returned
  lag 0. Fixed by tracking `maxAbsCorr = -1`
- **`app.listen` EADDRINUSE in tests** (`apps/api/src/index.ts`) — added
  `NODE_ENV !== 'test'` guard so supertest integration tests can import the Express
  app without binding to port 3001
- **DB config test for production connection** — production config wraps `DATABASE_URL`
  in an object with SSL options; updated test assertion to check `connectionString`
  property instead of a bare string comparison
- **React 18/19 dual-copy resolution** — `@elastic/charts` pulled React 18 as a
  transitive dependency, breaking component tests under React 19. Installed
  `react@19` and `react-dom@19` at the workspace root, upgraded
  `@testing-library/react` to v16, and added `@testing-library/dom` peer dependency
- **Cleaned up `apps/web/vitest.config.ts`** — removed broken React path aliases and
  deprecated `deps.inline` option that were no longer needed after root React
  deduplication

---

## [1.0.1] - 2026-03-15
### Added
- **VITE_API_URL Docker build argument** — `apps/web/Dockerfile` now accepts a
  `VITE_API_URL` build arg (default: `https://api.fuelripple.com/api/v1`), baking the
  correct API base URL into the static bundle at image build time
- **Preview flag for bump-version** (`scripts/bump-version.js`) — pass `--preview` (or
  `-p`) to print the resulting version without writing or committing any files
- **Release SOP** (`docs/RELEASE.md`) — standard operating procedure covering the full
  lifecycle: changelog update → beta bump → beta deployment → PR → review → merge → prod
- **Version bump script** (`scripts/bump-version.js`) — Node.js CLI for managing semver
  across `apps/web`, `apps/api`, and the root `package.json`
  - Bump types: `patch`, `minor`, `major`, `pre-patch`, `pre-minor`, `pre-major`, `release`
  - Automatically stages changed files and commits after each bump
  - Pre-release examples: `1.0.0 → 1.0.1-beta.0`; subsequent beta run → `1.0.1-beta.1`
  - Release promotion: `1.0.1-beta.0 → 1.0.1`
- **npm version scripts** in root `package.json`:
  `version:beta:patch`, `version:beta:minor`, `version:beta:major`,
  `version:release`, `version:release:api`, `version:release:web`
- **Azure App Service CI/CD workflows** — GitHub Actions workflow configs for building
  and deploying the API and web containers to Azure App Service (added 2026-03-14,
  updated 2026-03-15)
- **Energy price seeding & correlation** — initial implementation of EIA historical data
  backfill (`apps/api/src/scripts/`) and correlation calculation helpers
  (`packages/impact-engine/src/correlation.ts`)
- **Copilot instructions** (`.github/copilot-instructions.md`) — project-level guidance
  for GitHub Copilot covering monorepo structure, data flow, and critical patterns

### Fixed
- Updated `README.md` to include the live site URL (https://www.fuelripple.com)
---

## [1.0.0] - 2026-03-11

### Added
- **Testing Infrastructure** - Complete test suite setup across all packages
  - Jest configuration for API package (@fuelripple/api)
  - Vitest configuration for web, shared, impact-engine, and db packages
  - Test utilities and helpers for consistent testing patterns
  - Test coverage reporting capabilities
  - Watch mode support via `npm run test:watch`
  
- **API Package Tests** - 2 test suites with 10 passing tests
  - Error handler middleware tests
  - Route integration tests

- **Web Package Tests** - 2 test files with 7 passing tests
  - Component tests
  - Hook tests

- **Shared Package Tests** - 1 test file with 2 passing tests
  - Schema validation tests
  - Utility function tests

- **Impact Engine Tests** - 1 test file with 3 passing tests
  - Correlation calculations
  - Disruption scoring
  - Fuel cost analysis

- **Database Package Tests** - 1 test file with 3 passing tests
  - Migration tests
  - Query tests

### Changed
- **Test Scripts** - Updated all Vitest configurations to use `--run` flag
  - Tests now exit after completion instead of watch mode
  - Improved CI/CD compatibility
  - Watch mode available via separate npm script

- **Project Documentation** - Added comprehensive test setup guides
  - Testing infrastructure summary
  - Command references and examples

### Fixed
- Fixed missing test files for @fuelripple/db that caused "No test files found" errors
- Fixed Jest import errors in test utility files
- Resolved Vitest watch mode blocking test completion
- Added proper imports from @jest/globals in Jest-based tests

### Technical Details
- **Total Test Coverage:** 25 tests passing across all packages
- **Test Frameworks:** Jest (API) and Vitest (Web, Shared, Impact-Engine, DB)
- **Node.js Version:** >= 20.0.0

---

## Versioning

This project follows semantic versioning:
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality in a backward compatible manner
- **PATCH** version for backward compatible bug fixes
