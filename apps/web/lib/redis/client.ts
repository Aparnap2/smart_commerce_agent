import Redis from 'ioredis'

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined
}

function createRedisClient(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL
    ?? 'redis://localhost:6379'

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) =>
      Math.min(times * 100, 3000),
    lazyConnect: true,
    enableOfflineQueue: false,
  })

  client.on('error', (err) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[Redis] connection error:', err.message)
    }
  })

  return client
}

// Singleton — one connection per process
export const redis: Redis =
  globalThis.__redis ?? createRedisClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__redis = redis
}
