# FuelRipple — US Gas Price Tracker & Consumer Disruption Index

[![Tests](https://github.com/WFord26/FuelRipple/actions/workflows/tests.yml/badge.svg)](https://github.com/WFord26/FuelRipple/actions/workflows/tests.yml)
[![Build & Deploy](https://github.com/WFord26/FuelRipple/actions/workflows/deploy.yml/badge.svg)](https://github.com/WFord26/FuelRipple/actions/workflows/deploy.yml)
![Version](https://img.shields.io/badge/version-1.0.1-blue)

**Live site:** [www.fuelripple.com](https://www.fuelripple.com)

A web application that tracks US gasoline prices and quantifies the real-world impact of price volatility on American consumers through a **Consumer Disruption Index** — translating raw fuel price data into household-level cost impacts.

## Documentation

| Guide | Description |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Data models, API design, EIA/FRED series IDs, impact engine formulas |
| [Setup Guide](docs/SETUP.md) | Complete local setup with troubleshooting |
| [Quick Start](docs/QUICK_START.md) | Fastest path to a running dev environment |
| [Deployment](docs/DEPLOYMENT.md) | Azure infrastructure and CI/CD pipeline |
| [Release SOP](docs/RELEASE.md) | Beta → production release process |
| [Testing](docs/TESTING.md) | Test setup, frameworks, and coverage |
| [Changelog](CHANGELOG.md) | Version history and release notes |
| [Contributing](CONTRIBUTING.md) | Contribution guidelines |

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TailwindCSS, TanStack Query |
| Backend | Node.js 20, Express 4, TypeScript |
| Database | PostgreSQL 16 + TimescaleDB (hypertables + continuous aggregates) |
| Cache | Redis (L2) + LRU in-process (L1) |
| Job Queue | BullMQ (weekly EIA ingestion, Monday 6 PM ET) |
| Infrastructure | Azure App Service, Azure Container Registry, Azure Front Door |
| CI/CD | GitHub Actions (test on PR, build + deploy on merge to main) |

## Monorepo Structure

```
fuelripple/
├── apps/
│   ├── web/              # React 19 + Vite SPA (port 5173)
│   └── api/              # Express 4 + TypeScript API (port 3001)
├── packages/
│   ├── shared/           # Zod schemas & shared constants (canonical type source)
│   ├── impact-engine/    # Pure functions: fuel cost, disruption score, correlation
│   └── db/               # Knex migrations, getKnex() singleton, query helpers
├── infra/                # Azure Bicep templates
├── docs/                 # Documentation
└── scripts/              # bump-version.js and other dev utilities
```

## Prerequisites

- Node.js >= 20.0.0
- Docker and Docker Compose
- API Keys (both free):
  - [EIA API Key](https://www.eia.gov/opendata/register.php)
  - [FRED API Key](https://fred.stlouisfed.org/docs/api/api_key.html)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Add EIA_API_KEY, FRED_API_KEY, DB_PASSWORD, etc.

# 3. Start Docker services (PostgreSQL + Redis)
docker-compose up -d

# 4. Run database migrations
npm run db:migrate

# 5. Seed sample data
npm run db:seed

# 6. Start all development servers
npm run dev
```

Visit http://localhost:5173 to see the dashboard.

## Available Scripts

### Development
| Script | Description |
|---|---|
| `npm run dev` | Start all services (API + web) with hot-reload via Turbo |
| `npm run build` | Build all packages and apps for production |
| `npm run lint` | Run linting across all workspaces |
| `npm run test` | Run all tests in parallel across workspaces |
| `npm run test:coverage` | Run tests with coverage reports |

### Database
| Script | Description |
|---|---|
| `npm run db:migrate` | Run Knex migrations |
| `npm run db:seed` | Seed sample `geo_events` data |
| `npm run db:backfill` | Backfill historical EIA price data |

### Versioning
| Script | Description |
|---|---|
| `npm run version:beta:patch` | Bump to next beta patch (e.g. `1.0.1` → `1.0.2-beta.0`) |
| `npm run version:beta:minor` | Bump to next beta minor |
| `npm run version:beta:major` | Bump to next beta major |
| `npm run version:release` | Promote beta to stable (e.g. `1.0.2-beta.0` → `1.0.2`) |

> Pass `-- --preview` to any version script to dry-run without writing files.

## CI/CD

- **`tests.yml`** — runs the full test suite (Jest + Vitest + coverage) on every push to `main`/`beta` and every PR targeting `main`/`beta`. Merging to `main` is blocked until this check passes.
- **`deploy.yml`** — builds API and web Docker images, pushes to Azure Container Registry, and deploys to Azure App Service on merge to `main`.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for required GitHub secrets and Azure setup.

## License

MIT
