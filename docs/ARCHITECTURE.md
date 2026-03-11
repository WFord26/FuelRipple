# FuelRipple — US Gas Price Tracker & Consumer Disruption Index

**Architecture Document**

> **Stack:** React + Node.js + PostgreSQL/TimescaleDB
> **Version:** 1.1 | **Date:** March 2026 | **Author:** Will Ford

---

# 1. Executive Summary

This document defines the complete technical architecture for a web application that tracks US gasoline prices across daily, weekly, monthly, and yearly timeframes and quantifies the real-world impact of price volatility on American consumers. The application goes beyond raw price display to deliver a Consumer Disruption Index that translates market data into household-level cost impacts, commute expense changes, and downstream effects on consumer goods prices. It also monitors the upstream supply chain — refinery utilization, gasoline production volumes, and inventory levels — to provide early warning of supply-driven price disruptions.

The system is built on a React frontend, Node.js/Express API layer, and PostgreSQL with TimescaleDB for time-series storage. It ingests data from the US Energy Information Administration (EIA) API, FRED (Federal Reserve Economic Data), and optionally OilPriceAPI for real-time crude oil quotes. BullMQ handles scheduled data ingestion, Redis provides multi-tier caching, and TradingView Lightweight Charts powers the financial-grade visualization layer.

## 1.1 Key Objectives

Track retail gasoline prices at national, PADD region, state, and metro levels with weekly EIA data and optional real-time augmentation.

Calculate consumer impact metrics including annual fuel cost sensitivity ($531/year per $1/gallon increase), a z-score-based disruption index, and crude-oil-to-pump lag analysis.

Model downstream ripple effects from diesel price changes through trucking freight costs to consumer goods (food, retail) price inflation.

Deliver interactive visualizations with geopolitical event overlays (OPEC decisions, sanctions, hurricanes) and rockets-and-feathers asymmetry analysis.

Monitor refinery supply health by tracking utilization rates, gasoline/distillate production volumes, and inventory levels by PADD region — providing leading-indicator alerts when supply stress is likely to drive price spikes.

# 2. System Overview

The architecture follows a three-tier pattern with clear separation of concerns: a React single-page application (SPA) handles presentation and user interaction, a Node.js/Express API provides data aggregation and business logic, and PostgreSQL with TimescaleDB manages persistent time-series storage. Redis serves as both a caching layer and the backing store for BullMQ job queues.

## 2.1 High-Level Architecture Diagram

The following table represents the system layers and data flow from external sources through processing to the user interface.

| **Layer**      | **Components**                                                                                 | **Responsibility**                                                                                                       |
|----------------|------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| Presentation   | React 19, TradingView Lightweight Charts, Recharts, TanStack Query v5, Tailwind CSS            | Interactive dashboards, price charts with event markers, consumer impact calculators, regional comparisons               |
| API Gateway    | Express.js 4, TypeScript 5, Zod validation, JWT auth                                           | RESTful endpoints, request validation, response shaping, rate limiting, CORS                                             |
| Business Logic | Consumer impact engine, volatility calculator, correlation analyzer, downstream impact modeler, supply health monitor | Disruption score computation, cost sensitivity analysis, crude-oil lag detection, freight-to-CPI pass-through modeling, refinery utilization stress index and inventory health scoring |
| Data Ingestion | BullMQ 5, node-cron fallback, ETL pipelines                                                    | Scheduled API fetches, data normalization, gap detection, backfill orchestration                                         |
| Caching        | Redis (ioredis 5) L2, lru-cache 10 L1                                                          | TTL-based caching matched to data freshness: 24h for weekly gas, 6h for daily crude, 7d for historical                   |
| Storage        | PostgreSQL 16, TimescaleDB 2.x                                                                 | Hypertable-partitioned time-series, continuous aggregates for pre-computed averages, 90%+ compression on historical data |

## 2.2 Data Flow Summary

External data sources (EIA API, FRED API, OilPriceAPI) are polled on scheduled intervals by BullMQ workers. Raw responses are normalized into a unified schema, validated, and inserted into TimescaleDB hypertables. Continuous aggregates automatically maintain pre-computed daily, weekly, monthly, and yearly price averages. The Express API reads from Redis cache first (stale-while-revalidate pattern) and falls back to the database. TanStack Query on the frontend manages client-side caching, background refetching, and optimistic updates.

# 3. Data Sources & API Integration

The application relies on three tiers of data: a primary authoritative source (EIA), a complementary economic data source (FRED), and an optional real-time crude oil feed (OilPriceAPI). All primary data is free and government-sourced, ensuring reliability and zero ongoing API costs for the MVP.

## 3.1 EIA Open Data API v2

**Base URL:** https://api.eia.gov/v2/

**Authentication:** API key (free registration at eia.gov/developer)

**Rate Limit:** ~9,000 requests/hour, 5,000 rows per request

**History:** Weekly retail gasoline from 1990, PADD regions from 1992, select states from 2000

### 3.1.1 Key Series IDs

| **Data Point**                 | **Series ID**               | **Frequency** |
|--------------------------------|-----------------------------|---------------|
| US Regular Gasoline (national) | PET.EMM_EPMR_PTE_NUS_DPG.W  | Weekly        |
| PADD 1 – East Coast            | PET.EMM_EPMR_PTE_R10_DPG.W  | Weekly        |
| PADD 2 – Midwest               | PET.EMM_EPMR_PTE_R20_DPG.W  | Weekly        |
| PADD 3 – Gulf Coast            | PET.EMM_EPMR_PTE_R30_DPG.W  | Weekly        |
| PADD 4 – Rocky Mountain        | PET.EMM_EPMR_PTE_R40_DPG.W  | Weekly        |
| PADD 5 – West Coast            | PET.EMM_EPMR_PTE_R50_DPG.W  | Weekly        |
| California                     | PET.EMM_EPMR_PTE_SCA_DPG.W  | Weekly        |
| Colorado                       | PET.EMM_EPMR_PTE_SCO_DPG.W  | Weekly        |
| WTI Crude Oil Spot             | PET.RWTC.D                  | Daily         |
| Brent Crude Oil Spot           | PET.RBRTE.D                 | Daily         |
| US On-Highway Diesel           | PET.EMD_EPD2D_PTE_NUS_DPG.W | Weekly        |

### 3.1.2 PADD Regions

The Petroleum Administration for Defense Districts (PADDs) divide all 50 US states + DC into 5 districts (with PADD 1 further split into 3 sub-PADDs), originally established during WWII for petroleum allocation. PADD 3 (Gulf Coast) holds over 50% of US refining capacity and typically has the lowest retail prices. PADD 5 (West Coast) consistently posts the highest prices due to California’s special-blend gasoline requirements and geographic isolation from pipeline networks.

| **PADD** | **Region**     | **States (complete)**         | **Pricing Characteristic**                |
|----------|----------------|------------------------|-------------------------------------------|
| 1A       | East Coast (New England)    | CT, ME, MA, NH, RI, VT                              | Moderate; pipeline-fed from Gulf Coast    |
| 1B       | East Coast (Central Atlantic) | DE, DC, MD, NJ, NY, PA                            | Moderate; major population center         |
| 1C       | East Coast (Lower Atlantic) | FL, GA, NC, SC, VA, WV                               | Moderate; colonial pipeline terminus      |
| 2        | Midwest                     | IL, IN, IA, KS, KY, MI, MN, MO, NE, ND, SD, OH, OK, TN, WI | Volatile; refinery outages cause spikes   |
| 3        | Gulf Coast                  | AL, AR, LA, MS, NM, TX                               | Lowest; >50% of US refining capacity     |
| 4        | Rocky Mountain              | CO, ID, MT, UT, WY                                   | Higher; limited refining, transport costs |
| 5        | West Coast                  | AK, AZ, CA, HI, NV, OR, WA                           | Highest; CA blend reqs, isolated market   |

### 3.1.3 Refinery & Supply Data Series

The EIA Weekly Petroleum Status Report (WPSR) publishes comprehensive refinery operations data every Monday by ~5 PM ET. This supply-side data is available through the same API and key as retail prices, providing leading indicators for price disruptions.

| **Data Point** | **Series ID** | **Frequency** | **Unit** |
|---|---|---|---|
| US Refinery Utilization % | `WPULEUS3` | Weekly | Percent |
| PADD 1 Refinery Utilization % | `W_NA_YUP_R10_PER` | Weekly | Percent |
| PADD 2 Refinery Utilization % | `W_NA_YUP_R20_PER` | Weekly | Percent |
| PADD 3 Refinery Utilization % | `W_NA_YUP_R30_PER` | Weekly | Percent |
| PADD 4 Refinery Utilization % | `W_NA_YUP_R40_PER` | Weekly | Percent |
| PADD 5 Refinery Utilization % | `W_NA_YUP_R50_PER` | Weekly | Percent |
| US Crude Oil Inputs to Refineries | `WCRRIUS2` | Weekly | Thousand bbl/day |
| US Finished Motor Gasoline Production | `WGFRPUS2` | Weekly | Thousand bbl/day |
| US Distillate Fuel Production | `WDIIRPUS2` | Weekly | Thousand bbl/day |
| US Total Motor Gasoline Stocks | `WGTSTUS1` | Weekly | Thousand barrels |
| US Distillate Fuel Stocks | `WDISTUS1` | Weekly | Thousand barrels |
| US Operable Refinery Capacity | `MOPRCPUS2` | Monthly | Thousand bbl/day |

**Why refinery data matters for consumer impact:** Refinery utilization is one of the strongest leading indicators for retail price spikes. When utilization drops below ~90% due to unplanned outages (equipment failure, hurricanes, fires) or planned seasonal turnarounds, the supply squeeze typically hits retail prices within 1–2 weeks. The 2022 PADD 5 outages saw wholesale gasoline premiums spike to record highs within days of FCC unit shutdowns. By tracking utilization alongside inventory drawdown rates and comparing both to 5-year seasonal averages, FuelRipple can issue supply stress alerts *before* consumers see the price at the pump climb.

## 3.2 FRED API

**Base URL:** https://api.stlouisfed.org/fred/

**Authentication:** API key (free registration)

**Rate Limit:** 120 requests/minute

FRED mirrors EIA crude oil data through a cleaner REST interface and provides essential economic context series. The node-fred npm package simplifies integration.

| **Series**            | **FRED ID**  | **Use Case**                       |
|-----------------------|--------------|------------------------------------|
| WTI Crude Daily       | DCOILWTICO   | Crude oil correlation analysis     |
| Brent Crude Daily     | DCOILBRENTEU | International benchmark comparison |
| CPI All Urban         | CPIAUCSL     | Downstream consumer goods impact   |
| PPI Truck Transport   | PCU484484    | Freight cost pass-through tracking |
| US Regular Gas Weekly | GASREGW      | Cross-validation with EIA data     |

## 3.3 OilPriceAPI (Optional)

**Tier:** $0–$9/month, 5-minute update frequency

Provides near-real-time crude oil quotes for sub-daily resolution. Useful for intraday crude-to-pump lag analysis but not required for the MVP, which can rely on EIA daily spot prices.

## 3.4 API Alternatives Evaluated

| **Source**    | **Coverage**                  | **Cost**                                | **Verdict**                                |
|---------------|-------------------------------|-----------------------------------------|--------------------------------------------|
| GasBuddy      | Station-level, real-time      | No public API (unofficial GraphQL only) | Not viable – reverse-engineered, may break |
| AAA           | Daily national/state averages | No public API (sourced from OPIS)       | Not viable – scraping only                 |
| OPIS (ICE)    | 150K+ stations, intraday      | Enterprise pricing ($$$)             | Future upgrade path for station-level data |
| CollectAPI    | US gas averages               | 10 free req/month                       | Unusable at any scale                      |
| Alpha Vantage | WTI/Brent crude               | 25 free calls/day                       | Too limited; FRED is superior              |

# 4. Consumer Impact Engine

The Consumer Impact Engine is the application’s core differentiator. It transforms raw price data into five distinct consumer-facing metrics, each backed by federal data sources and peer-reviewed economic research.

## 4.1 Annual Fuel Cost Sensitivity

### 4.1.1 Core Formula

> Annual_Fuel_Cost = (Annual_Miles / Vehicle_MPG) × Price_Per_Gallon
>
> Price_Sensitivity = Annual_Miles / Vehicle_MPG
>
> = 13,500 / 25.4
>
> = 531.5 gallons/year
>
> ∴ Every $1/gallon increase costs the average driver $531/year

### 4.1.2 Default Constants

| **Constant**                    | **Value**  | **Source**                               |
|---------------------------------|------------|------------------------------------------|
| Average annual miles driven     | 13,500 mi  | FHWA Highway Statistics Table VM-1       |
| On-road fleet fuel economy      | 25.4 MPG   | EPA Automotive Trends Report (fleet avg) |
| Average one-way commute         | 20.5 miles | Census LEHD / ACS Table S0801            |
| Working days per year           | 250        | Standard assumption                      |
| Commute-only annual miles       | 10,250 mi  | 20.5 mi × 2 × 250 days                   |
| Commute sensitivity per $1/gal | $404/year | 10,250 / 25.4 × $1.00                   |

### 4.1.3 User Customization

Users can override defaults with their actual commute distance, vehicle MPG (or select from common vehicle models), and annual mileage. The frontend recalculates in real-time as the user adjusts sliders, showing the personalized cost impact of current prices versus their historical baseline.

## 4.2 Disruption Score (Volatility Index)

### 4.2.1 Z-Score Calculation

> weekly_change = (price_current - price_previous) / price_previous
>
> disruption_score = (weekly_change - mean(weekly_changes)) / stddev(weekly_changes)
>
> // Rolling window: 52 weeks for baseline statistics
>
> // Recalculated every data refresh cycle

### 4.2.2 Score Interpretation

| **Score Range** | **Classification** | **Color** | **Historical Example**                        |
|-----------------|--------------------|-----------|-----------------------------------------------|
| ±0 to ±1.0      | Normal fluctuation | Green     | Typical week-to-week variation                |
| ±1.0 to ±2.0    | Elevated activity  | Yellow    | Seasonal demand shifts, minor refinery issues |
| ±2.0 to ±3.0    | High disruption    | Orange    | Hurricane-related supply disruptions          |
| Beyond ±3.0     | Crisis-level event | Red       | 2008 oil shock, 2022 Russia-Ukraine invasion  |

### 4.2.3 Annualized Volatility

> rolling_vol = stddev(log_returns, window=30) × sqrt(252) × 100
>
> Benchmarks:
>
> \< 30% = Calm market
>
> 30-60% = Moderate volatility
>
> > 60% = Significant market stress

## 4.3 Crude Oil Correlation & Lag Analysis

### 4.3.1 Price Transmission Rule of Thumb

A $10/barrel change in crude oil corresponds to approximately $0.25/gallon at the pump. Crude oil accounts for roughly 50% of the retail gasoline price, with refining (~15%), distribution/marketing (~15%), and federal/state taxes (~20%) making up the remainder.

### 4.3.2 Cross-Correlation Function

> CCF(k) = correlation(Gas_Price_t, Oil_Price\_{t-k})
>
> for k = 0, 1, 2, ... 12 weeks
>
> Peak CCF value reveals optimal lag (typically 1-2 weeks for increases)

### 4.3.3 Rockets and Feathers Asymmetry

Retail gasoline prices rise within 1–2 weeks of crude oil increases but take 4–8 weeks to fully decline after crude drops. An FTC study found pump prices rise more than four times as fast as they fall. The application implements an asymmetric error correction model that splits oil price changes into positive and negative components to quantify this effect visually.

> // Asymmetric Error Correction Model
>
> delta_gas_t = alpha + beta_pos \* delta_oil_pos_t + beta_neg \* delta_oil_neg_t
>
> \+ gamma \* ECT\_{t-1} + epsilon_t
>
> // Where beta_pos >> beta_neg demonstrates the asymmetry
>
> // ECT = Error Correction Term (long-run equilibrium deviation)

## 4.4 Regional Price Comparison

The regional comparison module displays current and historical price differentials across PADD regions, states, and metros. Key analytics include the price spread between the cheapest (PADD 3, Gulf Coast) and most expensive (PADD 5, West Coast) regions, historical percentile rankings for each region’s current price, and the tax component breakdown by state.

## 4.5 Downstream Consumer Goods Impact

### 4.5.1 Diesel-to-Freight Transmission

> Fuel_Surcharge_Per_Mile = (Current_Diesel - Baseline) / Truck_MPG
>
> Defaults:
>
> Baseline = $1.25/gallon (industry standard DOE reference)
>
> Truck_MPG = 6.5 (Class 8 average: 6.0-7.5 MPG)
>
> Example: Diesel at $4.15/gal
>
> Surcharge = ($4.15 - $1.25) / 6.5 = $0.446/mile

### 4.5.2 Pass-Through Chain

| **Stage**                | **Impact**                                 | **Data Source**                |
|--------------------------|--------------------------------------------|--------------------------------|
| $1/gal diesel increase  | 15–17¢/mile trucking cost increase         | ATRI operational costs study   |
| Trucking cost increase   | 5–10% freight rate increase via surcharges | DAT / FreightWaves SONAR       |
| Freight rate increase    | 0.5–2% consumer goods price increase       | BLS PPI for Truck Transport    |
| Food specifically        | ~9% of retail food cost is transportation  | USDA Economic Research Service |
| Macro-level pass-through | 1% gas price increase → 0.04% CPI increase | IMF Working Paper 2021/271     |

### 4.5.3 BLS Series for Tracking

| **Metric**                         | **BLS Series ID**     | **Update Frequency** |
|------------------------------------|-----------------------|----------------------|
| PPI – Truck Transportation         | PCU484484             | Monthly              |
| PPI – Freight Trucking (commodity) | WPU3012               | Monthly              |
| CPI – All Urban Consumers          | CPIAUCSL              | Monthly              |
| CPI – Food at Home                 | CUSR0000SAF11         | Monthly              |
| DOE Diesel Price (benchmark)       | EIA On-Highway Diesel | Weekly (Monday)      |

## 4.6 Supply Health Monitor

The Supply Health Monitor tracks the upstream refinery supply chain to detect conditions that historically precede retail price spikes. This is a leading indicator layer that complements the lagging price-based disruption score.

### 4.6.1 Refinery Utilization Stress Index

```
utilization_delta = current_utilization - five_year_avg_utilization_for_week
stress_level = utilization_delta / stddev(historical_utilization_for_week)

Thresholds:
  > -0.5σ   = Normal operations
  -0.5σ to -1.5σ = Elevated risk (seasonal turnarounds, minor outages)
  -1.5σ to -2.5σ = Supply stress (significant unplanned outages)
  < -2.5σ   = Critical supply disruption (major hurricane, multi-refinery event)
```

This metric is calculated per PADD region, since localized outages (e.g., PADD 5 FCC shutdowns) can cause severe regional price spikes without affecting the national average significantly.

### 4.6.2 Inventory Health Score

```
days_of_supply = gasoline_stocks / (product_supplied_4wk_avg)
inventory_health = (days_of_supply - five_year_avg_days_of_supply) / stddev

Gasoline stock levels below the 5-year seasonal average by more than 1σ
combined with utilization below 90% triggers a "supply squeeze" alert.
```

Inventory data is compared against 5-year seasonal norms to account for the natural build/draw cycle (inventories build in winter when demand is low, draw down in summer driving season). A drawdown that exceeds seasonal norms by more than one standard deviation — especially when paired with declining refinery utilization — is the strongest predictor of near-term price increases.

### 4.6.3 Production Trend Analysis

Weekly gasoline production (WGFRPUS2) and distillate production (WDIIRPUS2) are tracked as 4-week rolling averages by PADD region. The application calculates week-over-week and year-over-year production changes, flagging significant declines (>5% below 4-week average or >10% below year-ago levels) as supply alerts. These production metrics pair with utilization data to distinguish between planned maintenance (gradual, predictable utilization decline) and unplanned outages (sudden drops in both utilization and production).

# 5. Database Design

## 5.1 Why PostgreSQL + TimescaleDB

Gas price data is moderate-volume time-series: approximately 50,000 weekly data points across all regions over 30+ years. Dedicated time-series databases like InfluxDB or QuestDB are overkill for this scale. TimescaleDB runs as a PostgreSQL extension, adding three critical capabilities: hypertables for automatic time-based partitioning, continuous aggregates that pre-compute averages without application logic, and compression achieving 90–95% storage reduction on older data. Benchmarks show approximately 4× faster aggregation queries versus plain PostgreSQL.

## 5.2 Core Schema

> -- Primary time-series table
>
> CREATE TABLE energy_prices (
>
> time TIMESTAMPTZ NOT NULL,
>
> source TEXT NOT NULL, -- 'eia', 'fred', 'oilprice'
>
> metric TEXT NOT NULL, -- 'gas_regular', 'crude_wti', 'diesel'
>
> region TEXT DEFAULT 'US',
>
> value DOUBLE PRECISION NOT NULL,
>
> unit TEXT NOT NULL -- 'usd_per_gallon', 'usd_per_barrel'
>
> );
>
> SELECT create_hypertable('energy_prices', 'time');
>
> -- Indexes
>
> CREATE INDEX idx_prices_metric_region ON energy_prices (metric, region, time DESC);
>
> CREATE INDEX idx_prices_source ON energy_prices (source, time DESC);
>
> -- Geopolitical events for chart annotations
>
> CREATE TABLE geo_events (
>
> id SERIAL PRIMARY KEY,
>
> event_date DATE NOT NULL,
>
> category TEXT NOT NULL, -- 'opec', 'sanctions', 'hurricane', 'policy'
>
> title TEXT NOT NULL,
>
> description TEXT,
>
> impact TEXT -- 'bullish', 'bearish', 'neutral'
>
> );
>
> -- Downstream economic indicators
>
> CREATE TABLE economic_indicators (
>
> time TIMESTAMPTZ NOT NULL,
>
> indicator TEXT NOT NULL, -- 'cpi', 'ppi_trucking', 'freight_rate'
>
> value DOUBLE PRECISION NOT NULL,
>
> source TEXT NOT NULL
>
> );
>
> SELECT create_hypertable('economic_indicators', 'time');

> -- Refinery operations & supply data
>
> CREATE TABLE refinery_operations (
>
> time TIMESTAMPTZ NOT NULL,
>
> region TEXT NOT NULL, -- 'US', 'PADD1', 'PADD2', 'PADD3', 'PADD4', 'PADD5'
>
> utilization_pct DOUBLE PRECISION, -- % of operable capacity
>
> crude_inputs DOUBLE PRECISION, -- thousand bbl/day
>
> gasoline_production DOUBLE PRECISION, -- thousand bbl/day
>
> distillate_production DOUBLE PRECISION, -- thousand bbl/day
>
> gasoline_stocks DOUBLE PRECISION, -- thousand barrels
>
> distillate_stocks DOUBLE PRECISION, -- thousand barrels
>
> operable_capacity DOUBLE PRECISION -- thousand bbl/day (monthly)
>
> );
>
> SELECT create_hypertable('refinery_operations', 'time');
>
> CREATE INDEX idx_refinery_region ON refinery_operations (region, time DESC);

## 5.3 Continuous Aggregates

TimescaleDB continuous aggregates automatically maintain pre-computed views that refresh incrementally. This eliminates application-level aggregation logic for the four time granularities the frontend requires.

> -- Weekly averages (auto-refreshed)
>
> CREATE MATERIALIZED VIEW weekly_prices
>
> WITH (timescaledb.continuous) AS
>
> SELECT
>
> time_bucket('7 days', time) AS bucket,
>
> metric, region,
>
> AVG(value) AS avg_price,
>
> MIN(value) AS min_price,
>
> MAX(value) AS max_price,
>
> STDDEV(value) AS stddev_price,
>
> COUNT(\*) AS sample_count
>
> FROM energy_prices
>
> GROUP BY bucket, metric, region;
>
> -- Monthly averages
>
> CREATE MATERIALIZED VIEW monthly_prices
>
> WITH (timescaledb.continuous) AS
>
> SELECT
>
> time_bucket('30 days', time) AS bucket,
>
> metric, region,
>
> AVG(value) AS avg_price,
>
> MIN(value) AS min_price,
>
> MAX(value) AS max_price
>
> FROM energy_prices
>
> GROUP BY bucket, metric, region;

## 5.4 Compression Policy

> -- Compress data older than 6 months
>
> ALTER TABLE energy_prices SET (
>
> timescaledb.compress,
>
> timescaledb.compress_segmentby = 'metric, region',
>
> timescaledb.compress_orderby = 'time DESC'
>
> );
>
> SELECT add_compression_policy('energy_prices', INTERVAL '6 months');

> -- Compress refinery operations data
>
> ALTER TABLE refinery_operations SET (
>
> timescaledb.compress,
>
> timescaledb.compress_segmentby = 'region',
>
> timescaledb.compress_orderby = 'time DESC'
>
> );
>
> SELECT add_compression_policy('refinery_operations', INTERVAL '6 months');

## 5.5 Data Retention

No data retention policy is applied—all historical data is retained indefinitely. Compressed data from the 1990s through present occupies minimal storage (estimated \<500MB total for all regions and metrics). This enables deep historical analysis and long-term trend visualization.

# 6. API Layer Design

## 6.1 Technology Stack

| **Component**   | **Package**             | **Purpose**                                |
|-----------------|-------------------------|--------------------------------------------|
| Framework       | Express.js 4            | HTTP routing, middleware pipeline          |
| Language        | TypeScript 5            | Type safety across API boundaries          |
| Validation      | Zod 3                   | Runtime request/response schema validation |
| Database Client | pg 8 / Knex 3           | Connection pooling, query builder          |
| Cache Client    | ioredis 5               | Redis connection with cluster support      |
| Auth            | jsonwebtoken (optional) | JWT for future user accounts               |

## 6.2 REST Endpoint Design

| **Method** | **Endpoint**                  | **Description**                                                            |
|------------|-------------------------------|----------------------------------------------------------------------------|
| GET        | /api/v1/prices/current        | Current prices for all regions, with cache headers                         |
| GET        | /api/v1/prices/history        | Historical prices with ?metric, ?region, ?start, ?end, ?granularity params |
| GET        | /api/v1/prices/comparison     | Regional comparison for a given date range                                 |
| GET        | /api/v1/disruption/score      | Current disruption score with classification and trend                     |
| GET        | /api/v1/disruption/volatility | Rolling volatility index with configurable window                          |
| GET        | /api/v1/impact/fuel-cost      | Fuel cost calculator with customizable inputs                              |
| GET        | /api/v1/impact/downstream     | Diesel-to-CPI pass-through estimates                                       |
| GET        | /api/v1/correlation/crude-gas | Crude oil to gasoline correlation with lag analysis                        |
| GET        | /api/v1/events                | Geopolitical events for chart annotation overlays                          |
| GET        | /api/v1/supply/utilization    | Refinery utilization % by PADD with 5-year comparison and stress index     |
| GET        | /api/v1/supply/production     | Gasoline and distillate production volumes with rolling averages           |
| GET        | /api/v1/supply/inventories    | Gasoline and distillate stock levels with days-of-supply and seasonal norm |
| GET        | /api/v1/supply/health         | Composite supply health score combining utilization, inventory, production |

## 6.3 Caching Strategy

The application implements a two-tier caching architecture with stale-while-revalidate semantics. The in-process L1 cache (lru-cache) provides sub-millisecond reads for hot data, while Redis (L2) serves as the shared cache across API server instances.

| **Data Type**         | **L1 TTL** | **L2 (Redis) TTL** | **Refresh Trigger**                 |
|-----------------------|------------|--------------------|-------------------------------------|
| Weekly gas prices     | 5 min      | 24 hours           | BullMQ job after EIA Monday release |
| Daily crude oil       | 5 min      | 6 hours            | BullMQ daily job                    |
| Historical data       | 30 min     | 7 days             | Immutable; refresh only on backfill |
| Disruption score      | 1 min      | 1 hour             | Recalculated on new price data      |
| Downstream indicators | 15 min     | 24 hours           | BLS monthly release schedule        |
| Refinery/supply data  | 5 min      | 24 hours           | BullMQ job after EIA Monday release |
| Supply health score   | 1 min      | 1 hour             | Recalculated on new supply data     |

# 7. Data Ingestion Pipeline

## 7.1 BullMQ Job Architecture

BullMQ (v5+) backed by Redis provides persistent, retryable job scheduling with cron expressions. Each data source has a dedicated queue with source-specific retry logic and rate limit awareness.

> // Job Scheduler Configuration
>
> await dataQueue.upsertJobScheduler('eia-gas-weekly', {
>
> pattern: '0 18 \* \* 1', // Monday 6PM ET (after EIA release ~5PM)
>
> }, {
>
> name: 'fetch-eia-gas',
>
> data: { source: 'eia', metrics: \['gas_regular', 'gas_midgrade', 'gas_premium', 'diesel'\] },
>
> opts: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
>
> });
>
> await dataQueue.upsertJobScheduler('eia-crude-daily', {
>
> pattern: '0 19 \* \* 1-5', // Weekdays 7PM ET
>
> }, {
>
> name: 'fetch-eia-crude',
>
> data: { source: 'eia', metrics: \['crude_wti', 'crude_brent'\] },
>
> });
>
> await dataQueue.upsertJobScheduler('fred-economic', {
>
> pattern: '0 10 15 \* \*', // 15th of each month (BLS release)
>
> }, {
>
> name: 'fetch-fred-indicators',
>
> data: { source: 'fred', series: \['CPIAUCSL', 'PCU484484', 'GASREGW'\] },
>
> });
>
> await dataQueue.upsertJobScheduler('eia-refinery-weekly', {
>
> pattern: '0 18 \* \* 1', // Monday 6PM ET (same release as gas prices)
>
> }, {
>
> name: 'fetch-eia-refinery',
>
> data: { source: 'eia', metrics: \['utilization', 'production', 'stocks'\],
>
> regions: \['US', 'PADD1', 'PADD2', 'PADD3', 'PADD4', 'PADD5'\] },
>
> opts: { attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
>
> });

## 7.2 ETL Pipeline Stages

| **Stage** | **Operation**                                                           | **Error Handling**                                                                      |
|-----------|-------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| Extract   | HTTP GET to source API with retry/backoff                               | Exponential backoff (5s base, 5 attempts), circuit breaker after 3 consecutive failures |
| Transform | Normalize to unified schema (time, source, metric, region, value, unit) | Schema validation via Zod; invalid records logged and skipped                           |
| Load      | Upsert into TimescaleDB with ON CONFLICT deduplication                  | Transaction rollback on batch failure; dead-letter queue for manual review              |
| Validate  | Gap detection: compare expected vs actual data points per region/metric | Auto-trigger backfill job for missing date ranges                                       |
| Notify    | Emit events for cache invalidation and disruption score recalculation   | Redis pub/sub; failures are non-blocking                                                |

## 7.3 Gap Detection & Backfill

After each ingestion cycle, a validation job compares the count of data points per (metric, region) against expected counts based on the data frequency and date range. Missing data triggers a targeted backfill job that requests only the missing date range from the source API. This handles both API transient failures and late data publications.

# 8. Frontend Architecture

## 8.1 Technology Stack

| **Component**    | **Package**                       | **Justification**                                                       |
|------------------|-----------------------------------|-------------------------------------------------------------------------|
| Framework        | React 19 + Vite                   | Fast HMR, ESM-native bundling, tree-shaking                             |
| State/Cache      | TanStack Query v5                 | Server-state management with background refetch, stale-while-revalidate |
| Primary Charts   | TradingView Lightweight Charts v4 | ~45KB gzipped, Canvas-based, financial-grade crosshair/zoom/markers     |
| Secondary Charts | Recharts 2                        | Declarative JSX API for bar charts, area charts, comparisons            |
| Styling          | Tailwind CSS                      | Utility-first, consistent design system, no CSS overhead                |
| Routing          | React Router v7                   | File-based routing, lazy loading per dashboard view                     |
| Forms            | React Hook Form + Zod             | Fuel cost calculator inputs with runtime validation                     |

## 8.2 Dashboard Views

| **View**            | **Key Components**                                                            | **Data Sources**                                 |
|---------------------|-------------------------------------------------------------------------------|--------------------------------------------------|
| Price Overview      | National price card, 30/90/365-day sparklines, disruption score badge         | /api/v1/prices/current, /api/v1/disruption/score |
| Historical Trends   | TradingView candlestick/line chart with event markers, time range selector    | /api/v1/prices/history, /api/v1/events           |
| Regional Comparison | US heatmap (SVG), PADD region cards, state/metro drill-down                   | /api/v1/prices/comparison                        |
| Consumer Impact     | Fuel cost calculator with sliders, annual cost projection, commute cost delta | /api/v1/impact/fuel-cost                         |
| Market Correlation  | Dual-axis chart (crude + gas), lag analysis visualization, R² display         | /api/v1/correlation/crude-gas                    |
| Downstream Ripple   | Sankey/flow diagram: diesel → freight → CPI, freight surcharge calculator     | /api/v1/impact/downstream                        |
| Supply Health       | Refinery utilization gauge by PADD, inventory vs 5-year band, production trend, supply stress alerts | /api/v1/supply/health, /api/v1/supply/utilization, /api/v1/supply/inventories |

## 8.3 Chart Annotation System

Geopolitical events are overlaid on price charts using TradingView Lightweight Charts’ SeriesMarker API. Each event is rendered as a colored marker (triangle for bullish, inverted triangle for bearish, circle for neutral) with hover tooltips showing the event title and description. Users can toggle event categories (OPEC, sanctions, hurricanes, policy changes) on and off. The rockets-and-feathers visualization uses a dual-colored area chart showing the speed of price increases (red, steep) versus decreases (green, gradual).

# 9. Deployment & Infrastructure

## 9.1 Recommended Infrastructure

| **Component**            | **Service**                                      | **Specs / Tier**                                       |
|--------------------------|--------------------------------------------------|--------------------------------------------------------|
| Frontend Hosting         | Vercel or Cloudflare Pages                       | Free tier sufficient; global CDN edge caching          |
| API Server               | Railway, Render, or Azure App Service            | 1–2 instances, 512MB–1GB RAM                           |
| PostgreSQL + TimescaleDB | Timescale Cloud or Azure Database for PostgreSQL | Starter tier; ~1GB storage for full history            |
| Redis                    | Upstash (serverless) or Azure Cache for Redis    | Free/basic tier; \<100MB cache footprint               |
| Job Runner               | Co-located with API server                       | BullMQ workers in same process or separate worker dyno |
| Monitoring               | Sentry + Grafana Cloud (free tier)               | Error tracking, API latency, job success rates         |

## 9.2 Environment Configuration

> \# .env (never committed)
>
> EIA_API_KEY=your_eia_key
>
> FRED_API_KEY=your_fred_key
>
> OILPRICE_API_KEY=optional_key
>
> DATABASE_URL=postgresql://user:pass@host:5432/gastracker
>
> REDIS_URL=redis://host:6379
>
> NODE_ENV=production
>
> PORT=3001
>
> CORS_ORIGIN=https://fuelripple.com

## 9.3 Monorepo Structure

> fuelripple/
>
> ├── apps/
>
> │ ├── web/ \# React frontend (Vite)
>
> │ └── api/ \# Express.js backend
>
> ├── packages/
>
> │ ├── shared/ \# Zod schemas, types, constants
>
> │ ├── impact-engine/ \# Consumer impact calculation logic
>
> │ └── db/ \# Knex migrations, seeds, queries
>
> ├── turbo.json
>
> ├── package.json
>
> └── docker-compose.yml \# Local dev: Postgres, Redis, TimescaleDB

# 10. Development Roadmap

| **Phase**               | **Scope**                                                                                                       | **Duration** | **Deliverable**                                              |
|-------------------------|-----------------------------------------------------------------------------------------------------------------|--------------|--------------------------------------------------------------|
| Phase 1: Foundation     | Monorepo setup, DB schema (including refinery_operations table), EIA/FRED ingestion for prices + refinery data, basic Express API | 2–3 weeks    | API serving historical + current prices and refinery data for all regions |
| Phase 2: Core Dashboard | React app scaffolding, TradingView charts, price overview + historical trends views, TanStack Query integration | 2–3 weeks    | Interactive price dashboard with time range selection        |
| Phase 3: Impact Engine  | Fuel cost calculator, disruption score, volatility index, user-customizable inputs                              | 2 weeks      | Consumer impact dashboard with personalized cost projections |
| Phase 4: Supply Health  | Refinery utilization stress index, inventory health score, production trend analysis, supply stress alerts, Supply Health dashboard view | 2 weeks      | Supply health dashboard with PADD-level utilization gauges and inventory bands |
| Phase 5: Correlation    | Crude-oil correlation, lag analysis, rockets-and-feathers visualization, event annotation system                | 2 weeks      | Market correlation view with geopolitical event overlay      |
| Phase 6: Downstream     | Diesel-freight-CPI pass-through model, BLS data integration, Sankey flow diagram                                | 2 weeks      | Downstream ripple effects dashboard                          |
| Phase 7: Polish & SEO   | Regional heatmap, mobile responsive, performance optimization, error handling, monitoring, SEO keywords, LLM data integration | 2–3 weeks    | Production-ready application with SEO and LLM API endpoints  |

# 11. Security Considerations

API keys for EIA, FRED, and OilPriceAPI are stored in environment variables, never committed to source control. The Express API implements Helmet.js for HTTP security headers, express-rate-limit for per-IP rate limiting (100 req/15min for public endpoints), and CORS restricted to the frontend origin. Database connections use SSL/TLS in production. Redis connections are authenticated and encrypted in transit. No user PII is collected in the MVP—the fuel cost calculator runs entirely client-side with user-provided inputs that are never persisted.

# 12. Key Architecture Decisions

| **Decision**            | **Choice**                                | **Rationale**                                                                                                                                |
|-------------------------|-------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Primary data source     | EIA API (free, authoritative)             | Government data eliminates API cost risk; 30+ years of history; station-level data deferred to OPIS upgrade                                  |
| Database                | PostgreSQL + TimescaleDB                  | Familiar Postgres tooling; continuous aggregates solve multi-frequency aggregation natively; compression handles historical data efficiently |
| Charting library        | TradingView Lightweight Charts + Recharts | TradingView for time-series price data (Canvas perf, markers API); Recharts for aggregate/comparison views (simpler JSX API)                 |
| Job scheduling          | BullMQ (not node-cron)                    | Redis persistence survives restarts; exponential backoff; dead-letter queues; dashboard UI (Bull Board)                                      |
| Caching                 | Redis L2 + lru-cache L1                   | Two-tier eliminates Redis round-trips for hot data; stale-while-revalidate prevents users from waiting on upstream APIs                      |
| Monorepo                | Turborepo                                 | Shared Zod schemas between frontend and API ensure type-safe contracts; impact engine as reusable package                                    |
| No real-time websockets | REST + polling via TanStack Query         | Data updates weekly/daily; websockets add complexity for no material UX benefit at this refresh rate                                         |
| Supply-side data        | EIA WPSR refinery series (same API)       | Refinery utilization is the strongest leading indicator for price spikes; same free EIA API key, no additional cost; enables predictive alerts |

# 13. SEO & LLM Integration Strategy

## 13.1 Search Engine Optimization (SEO)

### 13.1.1 Target Keywords

The application targets high-intent, low-competition keywords across three tiers:

**Tier 1: Branded**
- FuelRipple gas price tracker
- FuelRipple disruption index
- FuelRipple supply cost calculator

**Tier 2: Primary Industry**
- Gas price forecast by region
- Refinery utilization impact on prices
- PADD gasoline prices comparison
- Consumer fuel cost index
- Gasoline volatility tracker
- Supply chain energy dashboard
- Regional diesel price trends
- Crude oil to pump price lag

**Tier 3: Educational / Long-tail**
- Why gas prices spike | Why are gas prices so high
- How do refinery outages affect gas prices
- Rockets and feathers gas pricing asymmetry
- Should I buy gas today | Best time to buy gas
- Diesel price impact on food costs
- OPEC decisions oil price correlation
- Fuel surcharge trucking costs

### 13.1.2 On-Page SEO Implementation

**Meta Tags & Structured Data:**
- Dynamic `<title>` and `<meta description>` per route (regional pages, correlation view, supply dashboard)
- Schema.org structured data (Organization, NewsArticle for geopolitical events, Dataset for historical prices)
- Open Graph tags for social sharing (dashboard screenshots, price alert cards)
- Open Graph: `og:image`, `og:title`, `og:description`, `og:url`
- Twitter Card: `twitter:card`, `twitter:image`, `twitter:title`

**Heading Hierarchy (H1–H3):**
- H1 per page: "US Gasoline Price Tracker & Consumer Disruption Index"
- H2 per view: "Regional Price Comparison", "Supply Chain Health Monitor", "Fuel Cost Calculator"
- H3 for subsections: PADD region names, metric explanations

**Internal Linking:**
- Related articles linked contextually (e.g., "See how refinery utilization impacts prices" → /supply view)
- Breadcrumb navigation for regional drill-down
- Contextual link strategy: Price spike → Supply Health view, Crude oil news → Correlation view

**Content Optimization:**
- Image alt text for all charts describing the data shown ("US weekly gasoline prices since 1990")
- Video explainers embedded on Dashboard view (e.g., "How are PADD regions defined?", "Why West Coast prices are highest")
- FAQ schema for common questions ("What is a PADD?", "What causes gas price spikes?", "How accurate is the disruption score?")

### 13.1.3 Technical SEO

- **Sitemap:** Dynamically generated sitemap.xml with regional pages + static content pages
- **Robots.txt:** Allow all, disallow /api (prevent indexing of JSON endpoints)
- **Performance:** Core Web Vitals optimizations (LCP < 2.5s, CLS < 0.1) via code splitting, image lazy-loading
- **Mobile-first indexing:** Responsive design verified; touch-friendly interactive elements
- **Canonical URLs:** Self-referential to avoid duplicate content issues on shareable dashboard links

### 13.1.4 Content Strategy

**Blog Posts (external content hub):**
- "Why Gas Prices Spike When Refineries Go Down" (targets: "refinery outages gas prices", "supply disruption")
- "PADD Regions Explained: Why California Pays More" (targets: "PADD regions", "why are West Coast gas prices higher")
- "The 2022 Energy Crisis: How Geopolitics Rippled Through US Fuel Prices" (targets: "oil price correlation events")
- "Rockets and Feathers: Why Prices Rise Fast, Fall Slow" (targets: "gas price asymmetry", "FTC fuel pricing")
- "Monthly Fuel Cost Tracker" (targets: "fuel cost index", "consumer fuel expenses")

**Backlink Strategy:**
- Outreach to energy news outlets, consumer advocacy sites, transportation blogs
- Partnerships with EIA, FRED documentation pages (mutual links)
- Reddit communities: r/energy, r/economics, r/personalfinance (organic discussion, no spam)

## 13.2 LLM Integration for Data Access

FuelRipple provides a dedicated API tier for Large Language Models (ChatGPT plugins, Claude connectors, custom agents) to query real-time energy market data as context for analysis, forecasting, and consumer advice.

### 13.2.1 LLM API Endpoints

All LLM endpoints return JSON suitable for embedding in LLM context windows, with automatic rate limiting and token usage tracking.

| **Endpoint**                      | **Purpose**                                                             | **Response Format**                                   |
|-----------------------------------|-------------------------------------------------------------------------|-------------------------------------------------------|
| GET /api/v1/llm/prices/summary    | Current US average + regional overview                                  | JSON: price, direction, disruption_score, trend_emoji |
| GET /api/v1/llm/prices/regional   | Current prices + YoY change for all PADD regions and selected states   | JSON array: region, price, pct_change_vs_week_ago, pct_change_vs_year_ago |
| POST /api/v1/llm/impact/calculate | LLM submits custom vehicle/commute parameters; receives personalized cost impact | JSON: annual_cost, weekly_cost, commute_cost, alerts |
| GET /api/v1/llm/correlation/crude-gas | Cross-correlation lag, current crude → gas transmission, rockets-and-feathers asymmetry | JSON: correlation_coeff, optimal_lag_weeks, asymmetry_index |
| GET /api/v1/llm/supply/health     | Refinery utilization %, inventory levels, production trends, composite supply stress score | JSON: utilization_by_padd, inventory_health_score, production_trend, supply_stress_alert |
| GET /api/v1/llm/events/recent     | Last 30 days of geopolitical energy events with impact classification   | JSON array: date, category, title, impact_direction, price_effect_estimate |
| POST /api/v1/llm/forecast/naive   | Simple 2-week price forecast based on recent volatility + seasonal baseline | JSON: forecast_price_low, forecast_price_high, confidence_level, methodology |

### 13.2.2 LLM Context Window Optimization

Response payloads are designed for efficient embedding in LLM context:

1. **Concise JSON structure** — No verbose explanations; machine-readable only
2. **Emoji indicators** for quick semantic parsing (🔴 crisis, 🟡 alert, 🟢 normal)
3. **Trend arrows** for price direction (↑ up > 2%, → flat, ↓ down > 2%)
4. **Confidence scores** (0–1) on forecasts and correlations
5. **Source attribution metadata** for each value (EIA, FRED, computed, timestamp)

### 13.2.3 Example LLM Query Flow

```
User (via ChatGPT):
"I drive a fuel-inefficient truck 40 miles round-trip daily. How much extra 
will I spend on gas this year if prices stay at current levels?"

ChatGPT Plugin:
1. POST /api/v1/llm/impact/calculate
   {
     "annual_miles": 10400,  // 40 miles/day × 250 working days
     "vehicle_mpg": 12,
     "current_price_per_gallon": 3.45,
     "baseline_price_per_gallon": 2.88  // Prior year average
   }

2. Response:
   {
     "annual_cost_current": 2992,
     "annual_cost_baseline": 2502,
     "delta_annual_cost": 490,
     "delta_per_week": 9.42,
     "commute_cost_per_day": 3.73,
     "pct_increase": "19.5%"
   }

3. ChatGPT responds: "At current prices of $3.45/gal, you'd spend ~$490 more 
   this year compared to last year's $2.88/gal average. That's an extra $9.42 
   per week, or about $3.73 per commute day."
```

### 13.2.4 Authentication & Rate Limiting

LLM endpoints use optional API key authentication (for ChatGPT plugin, etc.) with tier-based rate limits:

| **Tier**                | **Rate Limit**        | **Use Case**                      |
|-------------------------|-----------------------|-----------------------------------|
| Public (no key)         | 10 req/min per IP     | Browser-based dashboard access    |
| LLM Plugin (with key)   | 100 req/min per key   | ChatGPT, Claude, custom agents    |
| Premium/Enterprise      | 500 req/min           | Institutional energy analysis     |

### 13.2.5 LLM Safety & Disclaimers

Each LLM API response includes a `disclaimer` field:

```json
{
  "data": { ... },
  "disclaimer": "This data is for informational purposes. Historical prices and correlations are not predictive. Actual prices may differ. See fuelripple.com for full terms."
}
```

Also embedded in the LLM system prompt to ensure language models caveat their advice appropriately.

# Appendix A: Reference Projects

| **Project**                       | **Stack**                          | **Relevance**                                                     |
|-----------------------------------|------------------------------------|-------------------------------------------------------------------|
| Baldo431/Gasoline_Price_Dashboard | Node.js, Express, Plotly.js        | Gas + crude oil regression analysis, closest architectural match  |
| zachagreenberg/GasPrices          | Python, SQL, ARIMA/SARIMA          | EIA + FRED + Geopolitical Risk Index for time-series forecasting  |
| OpenEnergyDashboard/OED           | Node.js, React, Plotly, PostgreSQL | Production-grade energy dashboard; best structural reference      |
| jfoclpf/autocosts                 | Node.js                            | Comprehensive vehicle cost calculation logic across 30+ countries |
| datasets/oil-prices               | CSV auto-updated from EIA          | Pre-formatted Brent/WTI historical CSVs for seeding               |
| datasets/cpi-us                   | CSV auto-updated from BLS          | US CPI data for downstream impact correlation                     |