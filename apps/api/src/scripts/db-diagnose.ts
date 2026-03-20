import { getKnex, closeConnection } from '@fuelripple/db';

async function main() {
  const k = getKnex();

  // Count rows in aaa_state_aggregates for CO
  const coCount = await k('aaa_state_aggregates').where('state', 'CO').count('* as n').first();
  console.log('aaa_state_aggregates CO count:', coCount?.n);

  // Sample oldest/newest
  const newest = await k('aaa_state_aggregates').where('state', 'CO').orderBy('time', 'desc').limit(3).select('time', 'regular');
  const oldest = await k('aaa_state_aggregates').where('state', 'CO').orderBy('time', 'asc').limit(3).select('time', 'regular');
  console.log('Newest CO:', JSON.stringify(newest.map(r => ({ time: r.time, regular: r.regular }))));
  console.log('Oldest CO:', JSON.stringify(oldest.map(r => ({ time: r.time, regular: r.regular }))));

  // Count energy_prices wayback rows for SCO
  const epCount = await k('energy_prices').where('source', 'aaa_wayback').where('region', 'SCO').count('* as n').first();
  console.log('energy_prices aaa_wayback SCO count:', epCount?.n);

  const epOldest = await k('energy_prices').where('source', 'aaa_wayback').where('region', 'SCO').orderBy('time', 'asc').limit(1).select('time', 'value');
  const epNewest = await k('energy_prices').where('source', 'aaa_wayback').where('region', 'SCO').orderBy('time', 'desc').limit(1).select('time', 'value');
  console.log('EP oldest SCO:', JSON.stringify(epOldest));
  console.log('EP newest SCO:', JSON.stringify(epNewest));

  // All distinct states in aaa_state_aggregates
  const states = await k('aaa_state_aggregates').distinct('state').orderBy('state').select('state');
  console.log('All states in aaa_state_aggregates:', states.map(r => r.state).join(', '));

  await closeConnection();
}

main().catch(e => { console.error(e); process.exit(1); });
