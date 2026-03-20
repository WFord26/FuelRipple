import { getKnex } from '@fuelripple/db';
import Redis from 'ioredis';

async function main() {
  const knex = getKnex();
  let redis: Redis | null = null;

  try {
    console.log('🔄 Computing AAA State Changes Cache');
    console.log('   Computing 7d, 30d, 90d, and 1y price changes for all states\n');

    // Get all unique states with AAA data
    const states = await knex('aaa_state_aggregates')
      .distinct('state')
      .pluck('state')
      .orderBy('state');

    console.log(`📊 Found ${states.length} states with AAA data`);

    // For each state, compute changes for each grade
    const grades = ['regular', 'mid_grade', 'premium', 'diesel'];
    const allChanges: Array<{
      state: string;
      grade: string;
      current_price: number | null;
      week_ago_price: number | null;
      week_change_pct: number | null;
      month_ago_price: number | null;
      month_change_pct: number | null;
      three_month_ago_price: number | null;
      three_month_change_pct: number | null;
      year_ago_price: number | null;
      year_change_pct: number | null;
      as_of: Date;
    }> = [];

    for (const state of states) {
      for (const grade of grades) {
        // Get the latest and historical prices
        const records = await knex
          .raw(
            `
            SELECT 
              time, 
              "${grade}"
            FROM aaa_state_aggregates
            WHERE state = ?
            ORDER BY time DESC
            LIMIT 366
          `,
            [state]
          )
          .then(result => result.rows);

        if (!records || records.length === 0) continue;

        const recordsByDate: Record<string, number | null> = Object.fromEntries(
          records.map((r: any) => [r.time.toISOString().split('T')[0], r[grade]])
        );

        const dates = Object.keys(recordsByDate).sort().reverse();
        const today = dates[0];
        const currentPrice = recordsByDate[today];

        // Compute 7d, 30d, 90d, 1y changes
        const week7d = dates[7];
        const month30d = dates[30];
        const quarter90d = dates[90];
        const year365d = dates[365];

        const weekAgoPrice = week7d ? recordsByDate[week7d] : null;
        const monthAgoPrice = month30d ? recordsByDate[month30d] : null;
        const quarterAgoPrice = quarter90d ? recordsByDate[quarter90d] : null;
        const yearAgoPrice = year365d ? recordsByDate[year365d] : null;

        const weekPct = currentPrice && weekAgoPrice 
          ? ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100 
          : null;
        const monthPct = currentPrice && monthAgoPrice 
          ? ((currentPrice - monthAgoPrice) / monthAgoPrice) * 100 
          : null;
        const quarterPct = currentPrice && quarterAgoPrice 
          ? ((currentPrice - quarterAgoPrice) / quarterAgoPrice) * 100 
          : null;
        const yearPct = currentPrice && yearAgoPrice 
          ? ((currentPrice - yearAgoPrice) / yearAgoPrice) * 100 
          : null;

        allChanges.push({
          state,
          grade,
          current_price: currentPrice ?? null,
          week_ago_price: weekAgoPrice ?? null,
          week_change_pct: weekPct ?? null,
          month_ago_price: monthAgoPrice ?? null,
          month_change_pct: monthPct ?? null,
          three_month_ago_price: quarterAgoPrice ?? null,
          three_month_change_pct: quarterPct ?? null,
          year_ago_price: yearAgoPrice ?? null,
          year_change_pct: yearPct ?? null,
          as_of: new Date(today),
        });
      }
    }

    // Log sample before inserting
    if (allChanges.length > 0) {
      console.log('\n📋 Sample of data to insert (first 2):');
      allChanges.slice(0, 2).forEach(record => {
        console.log(`   ${record.state}/${record.grade}:`, {
          current: record.current_price,
          week_ago: record.week_ago_price,
          week_pct: record.week_change_pct,
          month_ago: record.month_ago_price,
          month_pct: record.month_change_pct,
          year_ago: record.year_ago_price,
          year_pct: record.year_change_pct,
          as_of: record.as_of,
        });
      });
    }

    // Delete old cache and insert new
    await knex('aaa_state_changes_cache').del();
    if (allChanges.length > 0) {
      await knex('aaa_state_changes_cache').insert(allChanges);
    }

    console.log(`✅ Inserted ${allChanges.length} state price change records\n`);

    // Invalidate Redis cache for all states (changes and history)
    if (process.env.REDIS_URL) {
      console.log('🔄 Invalidating Redis cache...');
      redis = new Redis(process.env.REDIS_URL);
      
      const keysToDelete: string[] = [];
      for (const state of states) {
        // Invalidate changes cache
        keysToDelete.push(`aaa:state:${state.toUpperCase()}:changes`);
        // Invalidate history cache for all limit values
        keysToDelete.push(`aaa:state:${state.toUpperCase()}:90`);
        keysToDelete.push(`aaa:state:${state.toUpperCase()}:365`);
      }

      if (keysToDelete.length > 0) {
        const deleted = await redis.del(...keysToDelete);
        console.log(`   ✓ Deleted ${deleted} cache keys`);
      }

      await redis.quit();
      redis = null;
    }

    console.log('\nCache ready:');
    console.log(`  - States: ${states.length}`);
    console.log(`  - Grades per state: ${grades.length}`);
    console.log(`  - Total records: ${allChanges.length}`);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    if (redis) {
      await redis.quit();
    }
    await knex.destroy();
  }
}

main();
