import 'dotenv/config';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { getKnex, closeConnection } from '@fuelripple/db';

async function main() {
  const knex = getKnex();
  try {
    const tables = [
      'aaa_state_aggregates',
      'aaa_national_averages',
      'aaa_padd_aggregates',
    ];

    console.log('=== AAA Aggregate Table Counts ===\n');

    for (const table of tables) {
      const exists = await knex.schema.hasTable(table);
      if (!exists) {
        console.log(`${table}: TABLE DOES NOT EXIST`);
        continue;
      }
      const [{ count }] = await knex(table).count('* as count');
      const range = await knex(table)
        .select(knex.raw('MIN(time) as earliest'), knex.raw('MAX(time) as latest'))
        .first();
      console.log(`${table}: ${count} rows  (${range?.earliest?.toISOString?.().split('T')[0] ?? 'N/A'} → ${range?.latest?.toISOString?.().split('T')[0] ?? 'N/A'})`);
    }

    // State agg spot-check: CO last 3 entries
    console.log('\n--- aaa_state_aggregates: CO last 3 rows ---');
    const coRows = await knex('aaa_state_aggregates')
      .where('state', 'CO')
      .orderBy('time', 'desc')
      .limit(3)
      .select('time', 'state', 'regular', 'mid_grade', 'premium', 'diesel');
    console.table(coRows.map(r => ({ ...r, time: new Date(r.time).toISOString().split('T')[0] })));

    // National spot-check: last 3 entries
    console.log('--- aaa_national_averages: last 3 rows ---');
    const natRows = await knex('aaa_national_averages')
      .orderBy('time', 'desc')
      .limit(3)
      .select('time', 'regular', 'mid_grade', 'premium', 'diesel', 'state_count');
    console.table(natRows.map(r => ({ ...r, time: new Date(r.time).toISOString().split('T')[0] })));

    await closeConnection();
  } catch (e) {
    console.error('Error:', e);
    await closeConnection();
    process.exit(1);
  }
}

main();
