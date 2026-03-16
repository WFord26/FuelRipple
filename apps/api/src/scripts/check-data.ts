import 'dotenv/config';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { getKnex } from '@fuelripple/db';

async function main() {
  const knex = getKnex();

  // Check raw energy_prices for diesel
  const dieselRaw = await knex('energy_prices')
    .select('source', 'region')
    .count('* as cnt')
    .where({ metric: 'diesel' })
    .groupBy('source', 'region')
    .orderBy('source')
    .orderBy('region');

  console.log('\n=== Diesel records in energy_prices (raw) ===');
  for (const r of dieselRaw) {
    console.log(`  ${r.source} / ${r.region}: ${r.cnt}`);
  }

  // Check weekly_prices materialized view for diesel
  const dieselViews = await knex('weekly_prices')
    .select('region')
    .count('* as cnt')
    .where({ metric: 'diesel' })
    .groupBy('region')
    .orderBy('region');

  console.log('\n=== Diesel records in weekly_prices (materialized view) ===');
  for (const r of dieselViews) {
    console.log(`  ${r.region}: ${r.cnt}`);
  }

  // Check gas in materialized view for comparison
  const gasViews = await knex('weekly_prices')
    .select('region')
    .count('* as cnt')
    .where({ metric: 'gas_regular' })
    .groupBy('region')
    .orderBy('region');

  console.log('\n=== Gas records in weekly_prices (materialized view) ===');
  for (const r of gasViews) {
    console.log(`  ${r.region}: ${r.cnt}`);
  }

  await knex.destroy();
}

main().catch(e => { console.error(e); process.exit(1); });
