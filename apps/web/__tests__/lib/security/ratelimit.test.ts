import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/redis/client', () => ({
  redis: {
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  }
}))

import { redis } from '@/lib/redis/client'
import { rateLimit } from '@/lib/security/ratelimit'

beforeEach(() => vi.clearAllMocks())

describe('rateLimit', () => {
  it('allows requests under the limit', async () => {
    vi.mocked(redis.incr).mockResolvedValue(1)
    vi.mocked(redis.expire).mockResolvedValue(1)
    vi.mocked(redis.ttl).mockResolvedValue(60)

    const result = await rateLimit('user-1', { window: 60, max: 20 })

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(19)
  })

  it('blocks requests over the limit', async () => {
    vi.mocked(redis.incr).mockResolvedValue(21)
    vi.mocked(redis.expire).mockResolvedValue(1)
    vi.mocked(redis.ttl).mockResolvedValue(30)

    const result = await rateLimit('user-1', { window: 60, max: 20 })

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('fails open when Redis is unavailable', async () => {
    vi.mocked(redis.incr).mockRejectedValue(new Error('connection refused'))

    const result = await rateLimit('user-1', { window: 60, max: 20 })

    expect(result.allowed).toBe(true)
  })

  it('sets expire only on first request', async () => {
    vi.mocked(redis.incr).mockResolvedValue(1)
    vi.mocked(redis.expire).mockResolvedValue(1)
    vi.mocked(redis.ttl).mockResolvedValue(60)

    await rateLimit('user-1', { window: 60, max: 20 })
    expect(redis.expire).toHaveBeenCalledOnce()

    vi.mocked(redis.incr).mockResolvedValue(2)
    await rateLimit('user-1', { window: 60, max: 20 })
    expect(redis.expire).toHaveBeenCalledOnce()
  })
})
