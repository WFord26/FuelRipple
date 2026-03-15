# Contributing to FuelRipple

Thank you for your interest in contributing to FuelRipple! This guide will help you get started quickly and ensure your contributions align with how the project is structured.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Monorepo Structure](#monorepo-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

Be respectful and constructive. Harassment, discrimination, or hostile behavior of any kind will not be tolerated.

---

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- Docker and Docker Compose (for local PostgreSQL + Redis)
- Free API keys:
  - [EIA](https://www.eia.gov/opendata/register.php)
  - [FRED](https://fred.stlouisfed.org/docs/api/api_key.html)

### Local Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-fork>/GasTrack.git
cd GasTrack

# 2. Install all dependencies (npm workspaces + Turborepo)
npm install

# 3. Copy the environment template and fill in your API keys
cp .env.example .env

# 4. Start PostgreSQL and Redis via Docker
docker-compose up -d

# 5. Run database migrations and seed data
npm run db:migrate
npm run db:seed

# 6. Start all services (API on :3001, web on :5173)
npm run dev
```

See [docs/QUICK_START.md](docs/QUICK_START.md) and [docs/SETUP.md](docs/SETUP.md) for more detail.

---

## Monorepo Structure

| Path | Package | Purpose |
|---|---|---|
| `apps/api` | `@fuelripple/api` | Express 4 + TypeScript API (port 3001) |
| `apps/web` | `@fuelripple/web` | React 19 + Vite SPA (port 5173) |
| `packages/shared` | `@fuelripple/shared` | Zod schemas and shared constants — **the canonical type source** |
| `packages/impact-engine` | `@fuelripple/impact-engine` | Pure math functions: fuel cost, disruption score, correlation |
| `packages/db` | `@fuelripple/db` | Knex migrations, singleton `getKnex()`, query helpers |

---

## Development Workflow

### Branching

- `main` — stable, deployed to production
- `dev` — integration branch; target your PRs here
- Feature branches: `feat/<short-description>`
- Bug fixes: `fix/<short-description>`
- Chores / refactors: `chore/<short-description>`

### Key Commands

```bash
npm run dev          # Start all services (Turbo)
npm run test         # Run all tests across workspaces
npm run build        # Build all packages and apps
npm run db:migrate   # Apply pending Knex migrations
npm run db:seed      # Seed sample geo_events data
npm run db:backfill  # Backfill historical EIA price data
```

---

## Coding Standards

### TypeScript

- Strict mode is enabled in all `tsconfig.json` files — no `any` without a comment explaining why.
- **Shared types via Zod**: All API request/response shapes must be defined as Zod schemas in `packages/shared/src/schemas.ts` and inferred with `z.infer<>`. Never duplicate types inside `apps/`.
- Import `getKnex()` from `@fuelripple/db` — never instantiate Knex directly.

### Impact Engine

`packages/impact-engine` must remain **pure**: no DB calls, no network calls, no side effects. Math functions only. Formulas are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §4.

### Caching

All route handlers must check the two-tier cache (`getFromCache` / `setInCache` from `apps/api/src/services/cache.ts`) before hitting the database. TTL constants live in `@fuelripple/shared`.

### Data Series IDs

EIA and FRED series IDs are **static constants** — do not invent new series. The authoritative list is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §3.

### Frontend

- All pages in `apps/web/src/pages/` are lazy-loaded via `React.lazy`.
- Every `<Route>` must be wrapped in `<ErrorBoundary section="…">`.
- FuelRipple has **no authentication** — do not add auth middleware or protected routes.

### Environment Variables

A single `.env` file lives at the repo root. The API loads it via `dotenv.config({ path: '../../.env' })`. The web uses `VITE_API_URL` (replaced at build time by Vite). Never commit `.env`.

---

## Testing

| Package | Framework |
|---|---|
| `packages/*` | Vitest |
| `apps/web` | Vitest |
| `apps/api` | Jest + ts-jest + Supertest |

Tests run **before** builds in Turbo. When testing an individual workspace, build its package dependencies first:

```bash
# Run all tests
npm run test

# Run tests for a single workspace
npm run test --workspace=packages/impact-engine

# Run API tests only
cd apps/api && npx jest
```

Write tests for every new function in `impact-engine`, every new route in `apps/api`, and every significant component in `apps/web`. Aim for meaningful coverage, not 100% line coverage.

---

## Submitting Changes

1. **Open an issue first** for anything beyond a trivial fix, so we can discuss approach before implementation.
2. Keep PRs focused — one feature or bug fix per PR.
3. Ensure `npm run test` passes locally before opening a PR.
4. Fill out the pull request template completely.
5. Target the `dev` branch (not `main`).
6. Reference the related issue in your PR description (`Closes #123`).

### Database Migrations

If your change requires a schema change:

- Add a new migration file to `packages/db/migrations/` using the naming convention `YYYYMMDDNNNNNN_description.ts`.
- Never modify existing migration files.
- Update or add seeds in `packages/db/seeds/` if needed.
- Document the schema change in `docs/ARCHITECTURE.md`.

---

## Reporting Bugs

Use the **Bug Report** issue template. Include:
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (OS, Node version, browser if frontend)
- Relevant logs or screenshots

---

## Requesting Features

Use the **Feature Request** issue template. Describe:
- The problem you're trying to solve
- Your proposed solution or approach
- Any alternatives you've considered
- How it aligns with the project's goals (tracking gas prices + consumer impact)
