import type { Knex } from 'knex';

/**
 * Seed file for aaa_state_averages table
 * Populates sample AAA state prices for development/testing
 */

export async function seed(knex: Knex): Promise<void> {
  // Generate 365+ days of AAA sample data for representative states
  // This ensures 1-year lookback comparisons have historical data
  const generatePriceTimeSeries = (
    state: string, 
    baseRegular: number,
    baseDiesel: number,
    days: number = 365
  ) => {
    const records = [];
    const today = new Date('2026-03-19');
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Add realistic seasonal and daily variation
      // Seasonal trend: prices tend to rise then fall through year
      const seasonalFactor = Math.sin((days - i) / 100) * 0.15;
      const dailyVariation = Math.sin(i * 0.3) * 0.03 + (Math.random() - 0.5) * 0.02;
      const variation = seasonalFactor + dailyVariation;
      
      records.push({
        time: dateStr,
        state,
        regular: parseFloat((baseRegular + variation).toFixed(3)),
        mid_grade: parseFloat((baseRegular + 0.15 + variation).toFixed(3)),
        premium: parseFloat((baseRegular + 0.35 + variation).toFixed(3)),
        diesel: parseFloat((baseDiesel + variation).toFixed(3)),
      });
    }
    return records;
  };

  // Sample AAA data for selected states (365 days each)
  // This gives 1+ year of history for 1-year price comparison
  const allRecords = [
    ...generatePriceTimeSeries('CO', 3.380, 3.880, 365),
    ...generatePriceTimeSeries('WY', 3.600, 4.100, 365),
    ...generatePriceTimeSeries('CA', 5.590, 5.340, 365),
    ...generatePriceTimeSeries('NY', 3.710, 3.610, 365),
    ...generatePriceTimeSeries('TX', 3.560, 4.060, 365),
    ...generatePriceTimeSeries('FL', 3.930, 4.030, 365),
    ...generatePriceTimeSeries('AK', 4.400, 4.700, 365),
    ...generatePriceTimeSeries('HI', 5.040, 5.340, 365),
  ];

  // Convert to database format  
  const records = allRecords.map(row => ({
    time: new Date(`${row.time}T00:00:00Z`),
    state: row.state,
    regular: row.regular,
    mid_grade: row.mid_grade,
    premium: row.premium,
    diesel: row.diesel,
  }));

  // Delete existing data and insert
  await knex('aaa_state_aggregates').del();
  await knex('aaa_state_aggregates').insert(records);

  console.log(`✅ Seeded aaa_state_aggregates table with ${records.length} AAA price records (365 days x 8 states)`);
}
