# FuelRipple — Copilot Instructions

## Project Overview
FuelRipple tracks US gasoline prices and computes a Consumer Disruption Index translating price volatility into household-level cost impacts. The app name in code is `fuelripple`; the repo folder is `GasTrack`.

## Monorepo Structure (Turborepo + npm workspaces)
| Path | Package name | Purpose |
|---|---|---|
| `apps/api` | `@fuelripple/api` | Express 4 + TypeScript API, port 3001 |
| `apps/web` | `@fuelripple/web` | React 19 + Vite SPA, port 5173 |
| `packages/shared` | `@fuelripple/shared` | Zod schemas and shared constants — **the canonical type source** |
| `packages/impact-engine` | `@fuelripple/impact-engine` | Pure functions: fuel cost, disruption score, correlation, downstream |
| `packages/db` | `@fuelripple/db` | Knex migrations, singleton `getKnex()`, query helpers |

## Key Developer Commands
```bash
npm run dev          # Start all services via Turbo (API + web hot-reload)
npm run test         # Run all tests in parallel across workspaces
npm run db:migrate   # Run Knex migrations (packages/db)
npm run db:seed      # Seed sample geo_events data
npm run db:backfill  # Backfill historical EIA price data (apps/api script)
```
Tests run before builds in Turbo (`"test": { "dependsOn": ["^build"] }`), so build packages before running isolated workspace tests.

## Data Sources
All EIA series IDs and FRED series IDs are **static constants** — do not invent or guess new ones. The full authoritative list lives in `docs/ARCHITECTURE.md §3`. Key series used in `apps/api/src/services/eiaClient.ts` and `fredClient.ts`:
- `PET.EMM_EPMR_PTE_NUS_DPG.W` — US regular gasoline (weekly)
- `PET.RWTC.D` / `DCOILWTICO` — WTI crude (daily, via EIA and FRED respectively)
- `PET.EMD_EPD2D_PTE_NUS_DPG.W` — on-highway diesel (weekly)
- `WPULEUS3` — US refinery utilization (weekly)
- `WGTSTUS1` / `WDISTUS1` — gasoline/distillate stocks (weekly)

**AAA client** (`apps/api/src/services/aaaClient.ts`): this is a **web scraper**, not an official API. It is fragile by nature — do not rely on it as a primary data source and expect it to break if the AAA site changes its markup.

## Data Flow
```
EIA API / FRED API
  → BullMQ workers (apps/api/src/services/jobQueue.ts) — Monday 6 PM ET for weekly gas
    → TimescaleDB hypertable: energy_prices (time, source, metric, region, value, unit)
      → L1 LRU cache (5 min) + L2 Redis (TTL matched to freshness: 24 h weekly gas, 6 h crude)
        → Express routes (/api/v1/…)
          → axios apiClient (apps/web/src/api/client.ts, base: VITE_API_URL or /api/v1)
            → TanStack Query (client-side cache + background refetch)
```

## Critical Patterns

**Shared types via Zod**: All API request/response shapes are defined as Zod schemas in `packages/shared/src/schemas.ts` and inferred with `z.infer<>`. Never define duplicate types in `apps/`.

**Two-tier cache**: `apps/api/src/services/cache.ts` exports `getFromCache` / `setInCache`. Always call these in route handlers before querying the DB. TTL constants live in `@fuelripple/shared` (`CACHE_TTL`).

**Impact engine is pure**: `packages/impact-engine` has zero side effects and no DB/network calls — just math functions matching the formulas in `docs/ARCHITECTURE.md §4`. Use it from both the API and tests directly.

**DB access**: Always import `getKnex()` from `@fuelripple/db`. The singleton pattern prevents connection pool exhaustion; don't call `knex()` directly.

**Frontend routing**: All pages in `apps/web/src/pages/` are lazy-loaded via `React.lazy`. Every `<Route>` is wrapped in `<ErrorBoundary section="…">`. Follow this pattern for new pages.

**No authentication**: FuelRipple is a public website with no user login or JWT. Do not add auth middleware or protected routes.

**Environment variables**: A single `.env` file lives at the repo root. The API loads it via `dotenv.config({ path: '../../.env' })`. The web uses `VITE_API_URL` (Vite replaces at build time).

## Testing
- **`packages/*` and `apps/web`**: Vitest (config in each `vitest.config.ts`)
- **`apps/api`**: Jest + ts-jest (`jest.config.js`)
- Supertest is used for API integration tests in `apps/api/src/test/`

## Database
- PostgreSQL 16 + TimescaleDB extension; `energy_prices` is the core hypertable partitioned on `time`
- Migrations in `packages/db/migrations/` are numbered `YYYYMMDDNNNNNN_description.ts`
- Continuous aggregates in migration `20260309000002` pre-compute daily/weekly/monthly averages — query those views for historical endpoints rather than raw aggregations

## Infrastructure
- Azure deployment via Bicep in `infra/`; parameterized per environment in `infra/parameters/dev.bicepparam` and `prod.bicepparam`
- Docker Compose in the repo root starts PostgreSQL + Redis for local development
