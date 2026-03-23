import { getMetroAggregatesLatestByState } from './packages/db/src/queries/aaa';
import { getKnex } from './packages/db/src';

async function test() {
  try {
    console.log('Testing metro query...');
    const metros = await getMetroAggregatesLatestByState('CA');
    console.log(`Found ${metros.length} metros for CA`);
    console.log('First 3 metros:');
    console.log(JSON.stringify(metros.slice(0, 3), null, 2));
    
    // Also check raw table
    const knex = getKnex();
    const count = await knex('aaa_metro_aggregates').count('*').first();
    console.log(`\nTotal metros in table: ${count}`);
    
    const states = await knex('aaa_metro_aggregates')
      .select('state_abbr')
      .distinct()
      .orderBy('state_abbr');
    console.log(`States with metro data: ${states.map(s => s.state_abbr).join(', ')}`);
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

test();
