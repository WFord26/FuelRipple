import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import { CACHE_TTL } from '@fuelripple/shared';

let redis: Redis | null = null;

// L1 cache (in-memory LRU)
const l1Cache = new LRUCache<string, any>({
  max: 500, // Maximum 500 items
  ttl: 5 * 60 * 1000, // 5 minutes default TTL
});

/**
 * Initialize Redis connection for L2 cache
 */
export function initializeCache() {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    redis.on('connect', () => {
      console.log('✅ Redis L2 cache connected');
    });
    redis.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });
  } else {
    console.warn('⚠️  Redis URL not configured, using L1 cache only');
  }
}

/**
 * Get item from cache (checks L1 then L2)
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  // Check L1 cache first
  const l1Value = l1Cache.get(key);
  if (l1Value !== undefined) {
    return l1Value as T;
  }

  // Check L2 (Redis) if available
  if (redis) {
    try {
      const l2Value = await redis.get(key);
      if (l2Value) {
        const parsed = JSON.parse(l2Value) as T;
        // Populate L1 cache
        l1Cache.set(key, parsed);
        return parsed;
      }
    } catch (err) {
      console.error('Redis get error:', err);
    }
  }

  return null;
}

/**
 * Set item in cache (both L1 and L2)
 */
export async function setInCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
  // Set in L1
  l1Cache.set(key, value);

  // Set in L2 (Redis) if available
  if (redis && ttlSeconds) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      console.error('Redis set error:', err);
    }
  }
}

/**
 * Clear cache for a specific key or pattern
 */
export async function clearCache(pattern?: string): Promise<void> {
  l1Cache.clear();
  
  if (redis && pattern) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      console.error('Redis clear error:', err);
    }
  }
}

/**
 * Get or set pattern with stale-while-revalidate
 */
export async function cacheOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Try to get from cache
  const cached = await getFromCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const fresh = await fetchFn();
  
  // Store in cache
  await setInCache(key, fresh, ttlSeconds);
  
  return fresh;
}

export { redis };
