# FuelRipple — US Gas Price Tracker & Consumer Disruption Index

[![Tests](https://github.com/WFord26/FuelRipple/actions/workflows/tests.yml/badge.svg)](https://github.com/WFord26/FuelRipple/actions/workflows/tests.yml)
[![Build & Deploy](https://github.com/WFord26/FuelRipple/actions/workflows/deploy.yml/badge.svg)](https://github.com/WFord26/FuelRipple/actions/workflows/deploy.yml)
![Version](https://img.shields.io/badge/version-1.0.1-blue)

**Live site:** [www.fuelripple.com](https://www.fuelripple.com)

FuelRipple tracks US gasoline prices and translates price volatility into real household-level cost impacts through a **Consumer Disruption Index**. It pulls live data from the EIA and FRED, processes it through a custom impact engine, and surfaces it as an interactive dashboard.

## What It Does

- **Tracks weekly US gas prices** by region using EIA data
- **Monitors crude oil, diesel, refinery utilization, and fuel stocks** in near real-time
- **Computes a Consumer Disruption Index** — a score that converts price swings into estimated annual household cost changes
- **Correlates fuel prices** with macroeconomic indicators (CPI, unemployment, GDP) and upstream drivers (WTI crude, refinery utilization)
- **Maps geopolitical events** to price movements on an interactive timeline

## Data Sources

| Source | Data |
|---|---|
| [EIA Open Data](https://www.eia.gov/opendata/) | US gasoline prices, crude oil, diesel, refinery utilization, fuel stocks |
| [FRED (St. Louis Fed)](https://fred.stlouisfed.org/) | CPI, unemployment, GDP, WTI crude spot price |

All data is ingested automatically each week and stored in a TimescaleDB hypertable for fast time-series queries.

## Contributing

See [DEVELOPMENT.md](DEVELOPMENT.md) for local setup, scripts, and the CI/CD pipeline.
See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT
