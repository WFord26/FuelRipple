import type { Knex } from 'knex';

/**
 * Seed geopolitical events for chart annotations
 */
export async function seed(knex: Knex): Promise<void> {
  // Clear existing entries
  await knex('geo_events').del();

  // Insert sample events
  await knex('geo_events').insert([
    // ── Historical ──────────────────────────────────────────────────────────
    {
      event_date: '1990-08-02',
      category: 'other',
      title: 'Iraq Invades Kuwait',
      description: 'Iraq\'s invasion of Kuwait triggers Gulf War and oil supply disruption fears',
      impact: 'bullish',
    },
    {
      event_date: '2001-09-11',
      category: 'other',
      title: '9/11 Attacks',
      description: 'Terrorist attacks initially depress demand; oil markets spike then fall',
      impact: 'bearish',
    },
    {
      event_date: '2003-03-20',
      category: 'other',
      title: 'Iraq War Begins',
      description: 'US-led invasion of Iraq destabilizes Middle East oil supply',
      impact: 'bullish',
    },
    {
      event_date: '2005-08-29',
      category: 'hurricane',
      title: 'Hurricane Katrina',
      description: 'Major hurricane disrupts Gulf Coast refining capacity, knocking out 25% of US refinery output',
      impact: 'bullish',
    },
    {
      event_date: '2008-07-11',
      category: 'other',
      title: 'Oil Hits $147/Barrel',
      description: 'All-time high crude oil prices before the financial crisis-led collapse',
      impact: 'bullish',
    },
    {
      event_date: '2008-09-15',
      category: 'other',
      title: 'Lehman Brothers Collapse',
      description: 'Global financial crisis triggers demand destruction and historic crude oil price crash',
      impact: 'bearish',
    },
    // ── 2010s ────────────────────────────────────────────────────────────────
    {
      event_date: '2011-03-11',
      category: 'other',
      title: 'Fukushima Nuclear Disaster',
      description: 'Japan nuclear crisis increases oil demand for power generation',
      impact: 'bullish',
    },
    {
      event_date: '2011-02-15',
      category: 'other',
      title: 'Arab Spring — Libya',
      description: 'Libyan civil war removes ~1.4 Mbpd from global supply',
      impact: 'bullish',
    },
    {
      event_date: '2014-06-01',
      category: 'other',
      title: 'US Shale Boom Peak',
      description: 'US shale production peaks, contributing to global oversupply',
      impact: 'bearish',
    },
    {
      event_date: '2014-11-27',
      category: 'opec',
      title: 'OPEC Maintains Production',
      description: 'OPEC decides not to cut production despite falling prices, triggering a price war with US shale',
      impact: 'bearish',
    },
    {
      event_date: '2016-11-30',
      category: 'opec',
      title: 'OPEC Production Cut',
      description: 'OPEC agrees to first production cut since 2008, joined by Russia (OPEC+)',
      impact: 'bullish',
    },
    {
      event_date: '2017-08-25',
      category: 'hurricane',
      title: 'Hurricane Harvey',
      description: 'Cat 4 hurricane causes major refinery disruptions along Texas coast, ~25% of US refining capacity offline',
      impact: 'bullish',
    },
    {
      event_date: '2018-11-05',
      category: 'sanctions',
      title: 'Iran Sanctions Reimposed',
      description: 'Trump administration reimposed sanctions on Iran after withdrawing from JCPOA, cutting ~1 Mbpd from supply',
      impact: 'bullish',
    },
    {
      event_date: '2019-09-14',
      category: 'other',
      title: 'Saudi Aramco Attack',
      description: 'Drone and cruise missile attacks on Abqaiq and Khurais facilities disrupt 5% of global oil supply',
      impact: 'bullish',
    },
    // ── 2020s ────────────────────────────────────────────────────────────────
    {
      event_date: '2020-01-20',
      category: 'other',
      title: 'COVID-19 Pandemic Begins',
      description: 'Global pandemic declared; aviation and transport demand collapses driving historic oil price crash',
      impact: 'bearish',
    },
    {
      event_date: '2020-03-09',
      category: 'opec',
      title: 'Saudi-Russia Price War',
      description: 'OPEC+ talks collapse; Saudi Arabia and Russia flood market with oil as demand craters from COVID-19',
      impact: 'bearish',
    },
    {
      event_date: '2020-04-20',
      category: 'other',
      title: 'WTI Crude Goes Negative',
      description: 'Historic negative oil prices due to COVID-19 demand collapse, storage constraints, and May contract expiry',
      impact: 'bearish',
    },
    {
      event_date: '2020-04-12',
      category: 'opec',
      title: 'OPEC+ Historic 9.7 Mbpd Cut',
      description: 'OPEC+ agrees to largest production cut in history to stabilize markets after COVID price crash',
      impact: 'bullish',
    },
    {
      event_date: '2021-02-10',
      category: 'hurricane',
      title: 'Winter Storm Uri',
      description: 'Severe cold snap cripples Texas energy infrastructure, shutting ~4 Mbpd of production',
      impact: 'bullish',
    },
    {
      event_date: '2021-11-23',
      category: 'policy',
      title: 'US SPR Release',
      description: 'Biden administration announces 50M barrel release from Strategic Petroleum Reserve to combat high gas prices',
      impact: 'bearish',
    },
    {
      event_date: '2022-02-24',
      category: 'sanctions',
      title: 'Russia-Ukraine War Begins',
      description: 'Russia invades Ukraine; Western nations impose sweeping sanctions on Russian oil exports (~10% of global supply)',
      impact: 'bullish',
    },
    {
      event_date: '2022-03-01',
      category: 'policy',
      title: 'IEA Coordinated SPR Release',
      description: 'IEA member nations agree to release 60M barrels from strategic reserves to offset Russian supply disruption',
      impact: 'bearish',
    },
    {
      event_date: '2022-06-01',
      category: 'other',
      title: 'US Gas Price Record High',
      description: 'National average gas price exceeds $5/gallon for first time, driven by Russia-Ukraine war and tight supply',
      impact: 'bullish',
    },
    {
      event_date: '2022-10-05',
      category: 'opec',
      title: 'OPEC+ 2 Mbpd Production Cut',
      description: 'OPEC+ announces large production cut over US objections, defying Biden SPR strategy',
      impact: 'bullish',
    },
    // ── 2023 ────────────────────────────────────────────────────────────────
    {
      event_date: '2023-04-02',
      category: 'opec',
      title: 'Surprise OPEC+ Cut 1.65 Mbpd',
      description: 'Saudi Arabia leads surprise voluntary cut of 1.65 Mbpd, shocking markets expecting no change',
      impact: 'bullish',
    },
    {
      event_date: '2023-06-04',
      category: 'opec',
      title: 'Saudi Arabia Extends Unilateral 1 Mbpd Cut',
      description: 'Saudi Arabia extends voluntary 1 Mbpd production cut through July 2023',
      impact: 'bullish',
    },
    {
      event_date: '2023-08-01',
      category: 'opec',
      title: 'Saudi Arabia Extends Cut into September',
      description: 'Saudi Arabia extends and deepens unilateral production cut through September, joined by Russia export cut',
      impact: 'bullish',
    },
    {
      event_date: '2023-10-07',
      category: 'other',
      title: 'Hamas Attack on Israel',
      description: 'Hamas attack on Israel raises fears of broader Middle East conflict and supply disruption',
      impact: 'bullish',
    },
    {
      event_date: '2023-11-30',
      category: 'opec',
      title: 'OPEC+ Extends Cuts into 2024',
      description: 'OPEC+ extends existing cuts and announces fresh voluntary cuts totaling ~2.2 Mbpd for Q1 2024',
      impact: 'bullish',
    },
    // ── 2024 ────────────────────────────────────────────────────────────────
    {
      event_date: '2024-01-12',
      category: 'other',
      title: 'Red Sea Shipping Crisis',
      description: 'Houthi attacks on Red Sea shipping disrupt global trade routes; tankers rerouted around Africa',
      impact: 'bullish',
    },
    {
      event_date: '2024-04-01',
      category: 'opec',
      title: 'OPEC+ Extends Cuts through Q2 2024',
      description: 'OPEC+ extends voluntary cuts of 2.2 Mbpd into second quarter 2024',
      impact: 'bullish',
    },
    {
      event_date: '2024-06-02',
      category: 'opec',
      title: 'OPEC+ Extends Cuts to 2025',
      description: 'OPEC extends core cuts to end of 2025; voluntary cuts extended to end of Q3 2024 with phased unwind plan',
      impact: 'neutral',
    },
    {
      event_date: '2024-09-05',
      category: 'opec',
      title: 'OPEC+ Delays Unwind',
      description: 'OPEC+ delays planned output increase by 2 months amid weak demand and falling prices',
      impact: 'bullish',
    },
    // ── 2025 ────────────────────────────────────────────────────────────────
    {
      event_date: '2025-01-20',
      category: 'policy',
      title: 'Trump Returns — Energy Dominance Policy',
      description: 'Trump declared national energy emergency, fast-tracked LNG exports, withdrew from Paris Agreement; bearish for oil prices',
      impact: 'bearish',
    },
    {
      event_date: '2025-02-04',
      category: 'sanctions',
      title: 'Expanded Iran Sanctions',
      description: 'Trump administration reimposed and expanded maximum pressure campaign on Iran oil exports',
      impact: 'bullish',
    },
    {
      event_date: '2025-03-04',
      category: 'policy',
      title: 'Trump Tariffs on Canada/Mexico',
      description: 'US imposes 25% tariffs on Canadian and Mexican imports; oil market volatility on supply chain disruption fears',
      impact: 'bullish',
    },
    {
      event_date: '2025-04-03',
      category: 'opec',
      title: 'OPEC+ Surprise Output Increase',
      description: 'OPEC+ unexpectedly accelerates production unwind, adding 411,000 bpd; market interprets as Saudi Arabia losing patience',
      impact: 'bearish',
    },
    {
      event_date: '2025-09-16',
      category: 'hurricane',
      title: 'Hurricane Francine',
      description: 'Hurricane makes landfall in Louisiana, temporarily shutting Gulf of Mexico production',
      impact: 'bullish',
    },
    // ── 2026 ────────────────────────────────────────────────────────────────
    {
      event_date: '2026-01-15',
      category: 'opec',
      title: 'OPEC+ Resumes Full Unwind',
      description: 'OPEC+ begins phased return of 2.2 Mbpd in voluntary cuts; bearish amid weak China demand outlook',
      impact: 'bearish',
    },
    {      event_date: '2026-02-28',
      category: 'other',
      title: 'US–Iran Military Conflict Begins',
      description: 'Full US–Iran military conflict erupts; Iran threatens to close the Strait of Hormuz — through which ~20% of global oil supply transits — sending crude prices sharply higher',
      impact: 'bullish',
    },
    {      event_date: '2026-02-20',
      category: 'sanctions',
      title: 'Russia Sanctions Tightened',
      description: 'EU and G7 tighten Russian oil price cap enforcement; secondary sanctions on shadow fleet tankers',
      impact: 'bullish',
    },
  ]);

  console.log('✅ Seeded geo_events table with sample data');
}
