# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
