import { getKnex } from './packages/db/src';

async function clearMetroData() {
  try {
    const knex = getKnex();
    console.log('Clearing aaa_metro_aggregates table...');
    const deleted = await knex('aaa_metro_aggregates').del();
    console.log(`✅ Deleted ${deleted} metro records`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearMetroData();
