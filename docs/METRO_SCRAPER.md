# AAA Metro Gas Price Scraper

## Overview

A new metro-level gas price scraper has been added to FuelRipple, enabling detailed regional analysis and heatmap visualizations on state maps.

## What's New

### Database
- **Table**: `aaa_metro_aggregates` (TimescaleDB hypertable, partitioned by time)
- **Fields**: `time`, `metro_id`, `metro_name`, `state_abbr`, `latitude`, `longitude`, `regular`, `mid_grade`, `premium`, `diesel`
- **Partitioning**: 30-day chunks on `time` column for performance

### Services
- **`aaaMetroClient.ts`** — Scrapes AAA metro pages for current prices
  - `fetchMetroList()` — Returns available metros (static list, ~100 metros)
  - `fetchMetroPrice(metroName)` — Fetches single metro from AAA
  - `fetchAllMetroPrices()` — Scrapes all metros sequentially (polite delays)

### Database Queries (`packages/db/src/queries/aaa.ts`)
- `upsertMetroAggregates(rows)` — Batch upsert with ON CONFLICT merge
- `getMetroAggregatesForState(state, date)` — Get metros for specific state/date
- `getMetroAggregatesLatestByState(state)` — Get latest metro prices for state map heatmap

### Scripts
| Script | Purpose | Usage |
|--------|---------|-------|
| `fetch-metro-today.ts` | Scrape today's metro prices | `npx tsx src/scripts/fetch-metro-today.ts` |
| `backfill-metro-wayback.ts` | Historical data from Internet Archive | `npx tsx src/scripts/backfill-metro-wayback.ts --start 2023-01-01 --end 2023-12-31` |

## Usage

### Manual Test: Scrape Today's Metro Data
```bash
cd apps/api
npx tsx src/scripts/fetch-metro-today.ts
```

Output: Scrapes ~100 metros, inserts into `aaa_metro_aggregates`, clears caches.

### Backfill Historical Metro Data
```bash
cd apps/api
npx tsx src/scripts/backfill-metro-wayback.ts --start 2023-01-01 --end 2023-12-31 --dry-run
# Remove --dry-run to actually write to DB
```

Uses Wayback Machine snapshots from Internet Archive for historical prices.

### Query Metro Data (API Route)
```typescript
// In an API route handler:
import { getMetroAggregatesLatestByState } from '@fuelripple/db';

const metros = await getMetroAggregatesLatestByState('CA');
// Returns all metros in CA with prices, lat/lng for heatmap
```

## Integration with State Maps

### Example: Add Metro Heatmap Layer to State Page

```tsx
// apps/web/src/pages/State.tsx (or new StatePriceMap.tsx)
import { getMetroAggregatesLatestByState } from '@fuelripple/db';

async function loadMetroData(stateAbbr: string) {
  const metros = await fetch(
    `/api/v1/metros/${stateAbbr}/latest`
  ).then(r => r.json());
  
  // metros = [
  //   { metro_name: "Los Angeles-Long Beach-Anaheim, CA", latitude: 34.05, longitude: -118.24, regular: 5.79, ... },
  //   { metro_name: "San Francisco Bay Area, CA", latitude: 37.77, longitude: -122.41, regular: 5.45, ... },
  //   ...
  // ]
  
  return metros;
}

// Render as circles or heatmap on map
// Circle color/size based on price — expensive = red, cheap = blue
```

## Metro List (Current Coverage)

~100 major US metros across all 50 states + DC:

**Example metros**:
- Los Angeles-Long Beach-Anaheim, CA
- Chicago, IL
- New York, NY
- Dallas-Fort Worth, TX
- San Francisco Bay Area, CA
- Houston, TX
- Phoenix, AZ
- Philadelphia, PA
- Boston, MA
- Seattle, WA
- Denver, CO
- Las Vegas, NV
- Portland, OR
- Miami-Fort Lauderdale, FL
- Atlanta, GA
- ... and ~80 more

**To add more metros**, update the static list in `aaaMetroClient.ts` `fetchMetroList()`.

## Scheduling (Future)

To automate daily metro scrapes, add to `jobQueue.ts`:

```typescript
// Schedule daily metro scrape at same time as state scrape (6 PM ET)
await dataQueue.upsertJobScheduler('aaa-metro-daily', {
  pattern: '0 18 * * 1', // Monday 6 PM ET (weekly like state scrape)
}, {
  name: 'fetch-aaa-metro',
  data: { type: 'metro' },
  opts: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
  },
});
```

Then add handler:
```typescript
case 'fetch-aaa-metro':
  await processMertoData(); // new function
  break;
```

## Future Enhancements

1. **Dynamic Metro List** — Scrape metro availability from AAA dropdown
2. **Lat/Long Auto-Lookup** — Geocode metros to lat/lng for maps
3. **CBSA Mapping** — Link metros to Census Bureau CBSA codes
4. **Historical Extend** — Wayback backfill for 5+ years
5. **API Endpoint** — `/api/v1/metros/:state/latest` for frontend
6. **Metro Detail Page** — `/metros/los-angeles-ca` with history
7. **Heatmap Component** — Reusable React component for state maps

## Architecture Notes

- **Scraper is fragile**: AAA can change site markup → parsing will break
- **Wayback precision**: Internet Archive snapshots may vary in completeness
- **Rate limiting**: 600ms delay between requests to be polite
- **Storage**: Metro records are small (~1KB/day per metro), ~100 metros = ~100KB/day
- **ON CONFLICT merge**: Allows safe re-runs if scrape succeeds partially

## Files Modified/Created

✅ **Created**:
- `packages/db/migrations/20260323000001_create_aaa_metro_aggregates.ts`
- `apps/api/src/services/aaaMetroClient.ts`
- `apps/api/src/scripts/fetch-metro-today.ts`
- `apps/api/src/scripts/backfill-metro-wayback.ts`

✏️ **Modified**:
- `packages/db/src/queries/aaa.ts` — Added metro upsert/query functions

## Testing

```bash
# Verify table created
npm run db:migrate

# Test metro scraper (dry run output only)
cd apps/api && npx tsx src/scripts/fetch-metro-today.ts

# Query from DB manually
psql -U postgres -d fuelripple -c "SELECT COUNT(*) FROM aaa_metro_aggregates;"
```
