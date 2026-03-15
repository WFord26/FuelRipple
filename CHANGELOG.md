# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
