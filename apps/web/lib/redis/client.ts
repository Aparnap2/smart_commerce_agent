import { Redis } from 'ioredis';

/**
 * Get Redis client (works for both local and Upstash)
 * @returns Configured Redis instance with retry strategy
 */
const getRedisClient = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || 'redis://localhost:6379';

  return new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    lazyConnect: true,
    showFriendlyErrorStack: true,
  });
};

/**
 * Singleton pattern - one connection, not one per request
 * Prevents connection exhaustion in development with HMR
 */
const globalForRedis = global as unknown as { redis: ReturnType<typeof getRedisClient> };
export const redis = globalForRedis.redis ?? getRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/**
 * Health check function for Redis connectivity
 * @returns Promise with health status and optional DB size
 */
export async function checkRedisHealth(): Promise<{ ok: boolean; size?: number }> {
  try {
    const ping = await redis.ping();
    const size = await redis.dbsize();
    return { ok: ping === 'PONG', size };
  } catch (error) {
    return { ok: false };
  }
}
