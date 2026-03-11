# FuelRipple — US Gas Price Tracker & Consumer Disruption Index

A web application that tracks US gasoline prices and quantifies the real-world impact of price volatility on American consumers.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the complete technical architecture.

## Technology Stack

- **Frontend:** React 19, Vite, TailwindCSS, TradingView Lightweight Charts
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL 16 + TimescaleDB
- **Cache:** Redis
- **Job Queue:** BullMQ

## Project Structure

```
fuelripple/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # Express.js backend
├── packages/
│   ├── shared/       # Shared types and schemas
│   ├── impact-engine/ # Consumer impact calculations
│   └── db/           # Database migrations and queries
└── docs/             # Documentation
```

## Prerequisites

- Node.js >= 20.0.0
- Docker and Docker Compose (for local development)
- API Keys:
  - [EIA API Key](https://www.eia.gov/opendata/register.php) (free)
  - [FRED API Key](https://fred.stlouisfed.org/docs/api/api_key.html) (free)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (add your API keys)
cp .env.example .env

# 3. Start Docker services (PostgreSQL + Redis)
docker-compose up -d

# 4. Run database migrations
npm run db:migrate

# 5. Seed sample data
npm run db:seed

# 6. Start development servers
npm run dev
```

Visit http://localhost:5173 to see the dashboard.

📖 **Detailed guides:**
- [Setup Guide](docs/SETUP.md) — Complete setup instructions with troubleshooting
- [Quick Reference](docs/QUICK_START.md) — Architecture overview and common tasks
- [Architecture Doc](docs/ARCHITECTURE.md) — Full technical specification
- [Changelog](CHANGELOG.md) — Version history and release notes

## Available Scripts

- `npm run dev` - Start all services in development mode
- `npm run build` - Build all packages and apps for production
- `npm run lint` - Run linting across all workspaces
- `npm run test` - Run tests across all workspaces
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with initial data

## Development Roadmap

- [x] **Phase 1: Foundation** ✅ Complete
  - [x] Monorepo structure with Turborepo
  - [x] PostgreSQL + TimescaleDB schema with hypertables
  - [x] Express.js API with caching (Redis + LRU)
  - [x] BullMQ data ingestion pipeline (EIA + FRED)
  - [x] Consumer impact engine (fuel cost, disruption score, correlation)
  - [x] React frontend with TailwindCSS and routing
  - [x] Basic dashboard with price overview

- [ ] **Phase 2: Core Dashboard** (Next)
  - [ ] TradingView Lightweight Charts integration
  - [ ] Interactive historical price visualization
  - [ ] Regional comparison charts
  - [ ] Geopolitical event markers

- [ ] **Phase 3: Impact Engine**
  - [ ] Interactive fuel cost calculator with React Hook Form
  - [ ] Disruption score visualization
  - [ ] Volatility charting

- [ ] **Phase 4: Correlation**
  - [ ] Crude oil correlation charts
  - [ ] Lag analysis visualization
  - [ ] Rockets-and-feathers asymmetry display

- [ ] **Phase 5: Downstream**
  - [ ] Diesel-freight-CPI Sankey diagram
  - [ ] BLS data integration
  - [ ] Food price impact calculator

- [ ] **Phase 6: Polish**
  - [ ] US regional heatmap
  - [ ] Mobile responsive design
  - [ ] Performance optimization
  - [ ] Error handling and monitoring

## License

MIT
