# FuelRipple — Setup Guide

This guide will walk you through setting up the FuelRipple application from scratch.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 20.0.0 ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **Git** ([Download](https://git-scm.com/downloads))

## Step 1: Clone and Install

```bash
# Navigate to the project directory
cd "c:\Users\wford.MS\GitHub\Managed Solution\GasTrack"

# Install all dependencies
npm install
```

## Step 2: Get API Keys

### EIA API Key (Required)
1. Visit https://www.eia.gov/opendata/register.php
2. Fill out the registration form
3. Verify your email
4. Copy your API key

### FRED API Key (Required)
1. Visit https://fred.stlouisfed.org/docs/api/api_key.html
2. Create a free account
3. Request an API key
4. Copy your API key

## Step 3: Configure Environment

Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# API Keys
EIA_API_KEY=your_actual_eia_key_here
FRED_API_KEY=your_actual_fred_key_here
OILPRICE_API_KEY=optional

# Database
DATABASE_URL=postgresql://dev_user:dev_password@localhost:5432/gastracker

# Redis
REDIS_URL=redis://localhost:6379

# Environment
NODE_ENV=development
PORT=3001

# CORS
CORS_ORIGIN=http://localhost:5173
```

## Step 4: Start Local Services

Start PostgreSQL (with TimescaleDB) and Redis using Docker:

```bash
docker-compose up -d
```

Verify services are running:

```bash
docker ps
```

You should see two containers:
- `fuelripple-db` (PostgreSQL + TimescaleDB)
- `fuelripple-redis` (Redis)

## Step 5: Set Up Database

Run migrations to create tables and TimescaleDB hypertables:

```bash
npm run db:migrate
```

Seed the database with sample geopolitical events:

```bash
npm run db:seed
```

## Step 6: Start Development Servers

Start both the API backend and React frontend:

```bash
npm run dev
```

This will start:
- **API server** at http://localhost:3001
- **Frontend** at http://localhost:5173

## Step 7: Verify Installation

1. Open http://localhost:5173 in your browser
2. You should see the FuelRipple dashboard
3. Check the browser console for any errors

### Test API Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Test prices endpoint (may be empty initially)
curl http://localhost:3001/api/v1/prices/current
```

## Step 8: Fetch Initial Data

To populate the database with gas price data, you can manually trigger jobs:

```bash
# From the API directory
cd apps/api

# Trigger gas price fetch
node -e "require('./dist/services/jobQueue').triggerJob('fetch-eia-gas')"

# Trigger crude oil fetch
node -e "require('./dist/services/jobQueue').triggerJob('fetch-eia-crude')"
```

Or wait for the scheduled jobs to run automatically:
- Gas prices: Every Monday at 6PM ET
- Crude oil: Weekdays at 7PM ET
- Economic indicators: 15th of each month at 10AM

## Troubleshooting

### Database Connection Error

If you see "Connection refused" errors:

```bash
# Check if PostgreSQL is running
docker logs fuelripple-db

# Restart the container
docker-compose restart postgres
```

### Redis Connection Error

```bash
# Check if Redis is running
docker logs fuelripple-redis

# Restart the container
docker-compose restart redis
```

### Port Already in Use

If port 3001 or 5173 is already in use:

1. Stop the conflicting process
2. Or change the port in `.env` (for API) or `vite.config.ts` (for frontend)

### API Key Errors

Verify your API keys are correct:

```bash
# Test EIA API key
curl "https://api.eia.gov/v2/?api_key=YOUR_KEY"

# Test FRED API key
curl "https://api.stlouisfed.org/fred/series?series_id=DCOILWTICO&api_key=YOUR_KEY&file_type=json"
```

### Build Errors

If you encounter TypeScript or build errors:

```bash
# Clean all build artifacts
npm run clean

# Rebuild all packages
npm run build

# Try again
npm run dev
```

## Next Steps

Now that your development environment is set up:

1. **Phase 2**: Implement TradingView charts for historical price visualization
2. **Phase 3**: Build interactive fuel cost calculator with React Hook Form
3. **Phase 4**: Add correlation analysis and rockets-and-feathers visualization
4. **Phase 5**: Implement downstream impact modeling with Sankey diagrams
5. **Phase 6**: Add regional heatmaps and mobile responsiveness

## Useful Commands

```bash
# Development
npm run dev                 # Start all services
npm run build              # Build all packages
npm run lint               # Run linting

# Database
npm run db:migrate         # Run migrations
npm run db:migrate:rollback # Rollback last migration
npm run db:seed            # Seed database

# Docker
docker-compose up -d       # Start services in background
docker-compose down        # Stop and remove containers
docker-compose logs -f     # View logs
```

## Project Structure

```
GasTrack/
├── apps/
│   ├── api/              # Express.js backend
│   └── web/              # React frontend
├── packages/
│   ├── shared/           # Shared types and schemas (Zod)
│   ├── impact-engine/    # Consumer impact calculations
│   └── db/               # Database migrations and queries
├── docs/
│   └── ARCHITECTURE.md   # Technical architecture
├── docker-compose.yml    # Local development services
└── package.json          # Root package.json (Turborepo)
```

## Support

For issues or questions:
1. Check the [ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details
2. Review error logs in the terminal
3. Check Docker container logs: `docker-compose logs -f`
