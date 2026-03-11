import type { Knex } from 'knex';
import axios from 'axios';

/**
 * Seed initial energy prices from EIA API
 * This provides historical data for the dashboard
 */
export async function seed(knex: Knex): Promise<void> {
  const EIA_API_KEY = process.env.EIA_API_KEY;
  
  if (!EIA_API_KEY) {
    console.log('⚠️  EIA_API_KEY not set, skipping price seeding');
    return;
  }

  console.log('📊 Fetching historical gas prices from EIA...');

  try {
    // Fetch national gas price (last 365 days)
    const response = await axios.get('https://api.eia.gov/v2/petroleum/pri/gnd/data/', {
      params: {
        api_key: EIA_API_KEY,
        frequency: 'daily',
        'data[0]': 'value',
        'facets[product][]': 'EPM0',
        'facets[duoarea][]': 'NUS',
        sort: [{ column: 'period', direction: 'desc' }],
        offset: 0,
        length: 365,
      },
    });

    if (!response.data?.response?.data) {
      console.log('⚠️  No data returned from EIA API');
      return;
    }

    const prices = response.data.response.data.map((row: any) => ({
      timestamp: new Date(row.period),
      product: row.product === 'EPM0' ? 'gasoline' : row.product,
      geography_type: 'national',
      geography_code: row.duoarea,
      price: parseFloat(row.value),
      unit: 'USD/gallon',
      data_source: 'EIA',
      series_id: row.series_id || 'PET.EMM_EPM0_PTE_NUS_DPG.D',
    }));

    if (prices.length > 0) {
      await knex('energy_prices').insert(prices);
      console.log(`✅ Seeded ${prices.length} energy price records`);
    }
  } catch (error: any) {
    console.error('❌ Error seeding prices:', error.response?.data?.error || error.message);
  }
}
