import { getKnex } from './packages/db/src';

async function checkMetros() {
  const knex = getKnex();
  
  try {
    // Check total count
    const total = await knex('aaa_metro_aggregates').count('* as cnt').first();
    console.log('\n=== Metro Data Status ===');
    console.log('Total metros:', total?.cnt);
    
    // Check CA metros
    const ca = await knex('aaa_metro_aggregates')
      .where('state_abbr', 'CA')
      .select('metro_name', 'latitude', 'longitude', 'regular')
      .limit(3);
    console.log('\nCA metros sample:');
    ca.forEach(m => console.log(`  ${m.metro_name}: lat=${m.latitude}, lng=${m.longitude}`));
    
    // Check if any have coordinates
    const withCoords = await knex('aaa_metro_aggregates')
      .whereNotNull('latitude')
      .count('* as cnt')
      .first();
    console.log('\nMetros with coordinates:', withCoords?.cnt);
    
    // Check without coordinates
    const withoutCoords = await knex('aaa_metro_aggregates')
      .whereNull('latitude')
      .count('* as cnt')
      .first();
    console.log('Metros WITHOUT coordinates:', withoutCoords?.cnt);
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

checkMetros();
