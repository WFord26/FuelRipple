# FuelRipple — Quick Start

## Initial Setup (5 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Add your API keys to .env
# - Get EIA key: https://www.eia.gov/opendata/register.php
# - Get FRED key: https://fred.stlouisfed.org/docs/api/api_key.html

# 4. Start Docker services
docker-compose up -d

# 5. Run database migrations
npm run db:migrate

# 6. Seed sample data
npm run db:seed

# 7. Start development servers
npm run dev
```

## URLs

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                          │
│                   React 19 + Vite                           │
│              TailwindCSS + TanStack Query                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
┌──────────────────────▼──────────────────────────────────────┐
│                   Express.js API                            │
│         Routes: /prices, /disruption, /impact               │
│         Cache: Redis L2 + LRU L1 (stale-while-revalidate)  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴─────────────┐
        │                            │
┌───────▼────────┐          ┌────────▼─────────┐
│   PostgreSQL   │          │   BullMQ Jobs    │
│  + TimescaleDB │          │  (Data Ingestion)│
│   Hypertables  │          │   EIA → FRED     │
│   Compression  │          └────────┬─────────┘
└────────────────┘                   │
                             ┌───────▼──────────┐
                             │  External APIs   │
                             │  EIA, FRED, etc  │
                             └──────────────────┘
```

## Key Components

### Frontend (`apps/web/`)
- **Dashboard**: National price, disruption score, regional breakdown
- **Historical**: Price trends over time (Phase 2)
- **Comparison**: Regional price comparison (Phase 2)
- **Impact**: Fuel cost calculator (Phase 3)
- **Correlation**: Crude oil correlation analysis (Phase 4)

### Backend (`apps/api/`)
- **Routes**: RESTful endpoints for prices, disruption, impact, correlation
- **Cache**: Two-tier caching (Redis + LRU) with TTL-based invalidation
- **Jobs**: BullMQ scheduled jobs for data ingestion
- **Clients**: EIA and FRED API integration

### Packages
- **shared**: Zod schemas, TypeScript types, constants
- **db**: Knex migrations, TimescaleDB queries, connection pooling
- **impact-engine**: Consumer impact calculations (fuel cost, disruption score, correlation)

## Data Flow

1. **Scheduled Jobs** (BullMQ) fetch data from EIA/FRED APIs
2. **ETL Pipeline** normalizes and validates data
3. **TimescaleDB** stores time-series data in hypertables
4. **Continuous Aggregates** pre-compute daily/weekly/monthly averages
5. **API Routes** serve data with Redis caching
6. **React Frontend** fetches via TanStack Query with client-side caching

## Key Metrics Calculated

### Disruption Score
- Z-score of weekly price changes
- Rolling 52-week baseline
- Classification: normal, elevated, high, crisis

### Fuel Cost Sensitivity
- Annual gallons = miles ÷ MPG
- Cost sensitivity = gallons × price change
- Default: 13,500 mi/yr ÷ 25.4 MPG = 531 gal/yr
- **$1/gal increase = $531/year for avg household**

### Crude-to-Gas Correlation
- Cross-correlation with lag analysis
- Optimal lag detection (typically 1-2 weeks)
- Rockets & feathers asymmetry measurement

### Downstream Impact
- Diesel → freight surcharge ($/mile)
- Freight rate increase (%)
- CPI impact estimation (min/max/avg)
- Food price impact (9% transportation component)

## API Endpoints

```
GET  /api/v1/prices/current              # Current prices all regions
GET  /api/v1/prices/history              # Historical with filters
GET  /api/v1/prices/comparison           # Regional comparison
GET  /api/v1/prices/stats/:metric/:region # Statistics

GET  /api/v1/disruption/score            # Current disruption score
GET  /api/v1/disruption/volatility       # Rolling volatility

POST /api/v1/impact/fuel-cost            # Calculate fuel cost
GET  /api/v1/impact/fuel-cost/typical    # Typical household
GET  /api/v1/impact/downstream           # Diesel-to-CPI chain

GET  /api/v1/correlation/crude-gas       # Correlation + lag
GET  /api/v1/correlation/rockets-feathers # Asymmetry analysis

GET  /api/v1/events                      # Geopolitical events
```

## Database Schema

### `energy_prices` (hypertable)
- Stores gas, diesel, crude oil prices
- Partitioned by time (7-day chunks)
- Compressed after 6 months
- Indexed by (metric, region, time)

### Continuous Aggregates
- `daily_prices`: 1-day buckets, refresh every 6 hours
- `weekly_prices`: 7-day buckets, refresh every 24 hours
- `monthly_prices`: 30-day buckets, refresh every 24 hours

### `geo_events`
- Geopolitical events for chart annotations
- Categories: OPEC, sanctions, hurricane, policy
- Impact: bullish, bearish, neutral

### `economic_indicators` (hypertable)
- CPI, PPI trucking, freight rates
- Monthly data from BLS/FRED

## Development Phases

- [x] **Phase 1**: Foundation (monorepo, DB, API, basic frontend)
- [ ] **Phase 2**: Core Dashboard (TradingView charts, interactivity)
- [ ] **Phase 3**: Impact Engine (fuel cost calculator UI)
- [ ] **Phase 4**: Correlation (lag analysis, rockets-and-feathers viz)
- [ ] **Phase 5**: Downstream (Sankey diagrams, BLS integration)
- [ ] **Phase 6**: Polish (heatmaps, mobile, performance)

## Common Tasks

```bash
# View logs
docker-compose logs -f postgres    # Database logs
docker-compose logs -f redis       # Redis logs

# Database management
npm run db:migrate                 # Run migrations
npm run db:migrate:rollback        # Rollback
npm run db:seed                    # Seed sample data

# Manual job trigger (after building API)
cd apps/api
npm run build
node dist/services/jobQueue.js     # Check for export

# Reset database
docker-compose down -v             # Remove volumes
docker-compose up -d               # Restart
npm run db:migrate                 # Re-run migrations
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port conflict | Change PORT in .env or VITE config |
| DB connection failed | Check Docker: `docker-compose ps` |
| API key error | Verify keys at eia.gov and fred.stlouisfed.org |
| Build error | Run `npm run clean` then `npm install` |
| No data showing | Manually trigger jobs or wait for schedule |

## Next Steps

1. **Add API keys** to `.env`
2. **Trigger initial data fetch** to populate database
3. **Explore dashboard** at http://localhost:5173
4. **Review architecture** in `docs/ARCHITECTURE.md`
5. **Start Phase 2** implementation (charts)
