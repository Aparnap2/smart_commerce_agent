import { describe, it, expect } from 'vitest'

describe('Redis client', () => {
  it('exports a singleton redis instance', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'redis://localhost:6379'
    const { redis } = await import('@/lib/redis/client')
    expect(redis).toBeDefined()
    expect(typeof redis.get).toBe('function')
    expect(typeof redis.set).toBe('function')
    expect(typeof redis.setex).toBe('function')
    expect(typeof redis.del).toBe('function')
  })

  it('returns the same instance on multiple imports (singleton)', async () => {
    const { redis: r1 } = await import('@/lib/redis/client')
    const { redis: r2 } = await import('@/lib/redis/client')
    expect(r1).toBe(r2)
  })
})
