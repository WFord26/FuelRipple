# FuelRipple — US Gas Price Tracker & Consumer Disruption Index

[![Tests](https://github.com/WFord26/FuelRipple/actions/workflows/tests.yml/badge.svg)](https://github.com/WFord26/FuelRipple/actions/workflows/tests.yml)
[![Build & Deploy](https://github.com/WFord26/FuelRipple/actions/workflows/deploy.yml/badge.svg)](https://github.com/WFord26/FuelRipple/actions/workflows/deploy.yml)
![Version](https://img.shields.io/badge/version-1.1.5-blue)

**Live site:** [www.fuelripple.com](https://www.fuelripple.com)

FuelRipple tracks US gasoline prices and translates price volatility into real household-level cost impacts through a **Consumer Disruption Index**. It ingests daily AAA pump prices and live crude oil data, processes them through a custom impact engine, and surfaces them as an interactive dashboard.

## What It Does

- **Tracks daily US gas prices** for all 4 fuel grades (Regular, Mid-Grade, Premium, Diesel) via AAA — national, by PADD region, and by individual state (all 51)
- **Monitors crude oil, diesel, refinery utilization, and fuel stocks** in near real-time
- **Computes a Consumer Disruption Index** — a score that converts price swings into estimated annual household cost changes
- **Correlates fuel prices** with macroeconomic indicators (CPI, unemployment, GDP) and upstream drivers (WTI crude, refinery utilization), including daily intraday crude charts
- **Maps geopolitical events** to price movements on an interactive timeline
- **Historical price explorer** — drill down by grade, region, or state across any time window from 7 days to all-time

## Data Sources

| Source | Data | Frequency |
|---|---|---|
| [AAA Gas Prices](https://gasprices.aaa.com/) | Daily pump prices (Regular, Mid-Grade, Premium, Diesel) — all 51 states | Daily (9 AM ET) |
| [EIA Open Data](https://www.eia.gov/opendata/) | Crude oil, diesel, refinery utilization, fuel stocks | Weekly |
| [FRED (St. Louis Fed)](https://fred.stlouisfed.org/) | CPI, unemployment, GDP, WTI crude spot price | Monthly/weekly |
| Yahoo Finance | Daily WTI & Brent crude OHLC prices (15-min delayed) | Daily |

Daily AAA prices are scraped and stored in TimescaleDB. Historical data back to November 2017 is available via Wayback Machine backfill.

## Contributing

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup, scripts, and the CI/CD pipeline.
See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT
