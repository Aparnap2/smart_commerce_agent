import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/redis/client', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  }
}))

import { redis } from '@/lib/redis/client'
import {
  setUserContext,
  getUserContext,
  setIdempotencyKey,
  checkIdempotencyKey,
  incrementProactiveCount,
  getProactiveCount,
} from '@/lib/redis/memory'

beforeEach(() => { vi.clearAllMocks() })

describe('setUserContext', () => {
  it('writes with 24hr TTL', async () => {
    vi.mocked(redis.setex).mockResolvedValue('OK')
    await setUserContext('user-1', { lastSearch: 'headphones' })
    expect(redis.setex).toHaveBeenCalledWith(
      'user:user-1:context',
      86400,
      JSON.stringify({ lastSearch: 'headphones' })
    )
  })
})

describe('getUserContext', () => {
  it('returns parsed object on cache hit', async () => {
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({ lastSearch: 'headphones' })
    )
    const result = await getUserContext('user-1')
    expect(result).toEqual({ lastSearch: 'headphones' })
  })

  it('returns null on cache miss', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    const result = await getUserContext('user-1')
    expect(result).toBeNull()
  })

  it('returns null on Redis error (fails open)', async () => {
    vi.mocked(redis.get).mockRejectedValue(new Error('ECONNREFUSED'))
    const result = await getUserContext('user-1')
    expect(result).toBeNull()
  })
})

describe('setIdempotencyKey', () => {
  it('writes with 30 second TTL', async () => {
    vi.mocked(redis.setex).mockResolvedValue('OK')
    await setIdempotencyKey('cart:user-1:prod-1')
    expect(redis.setex).toHaveBeenCalledWith(
      'idem:cart:user-1:prod-1',
      30,
      'done'
    )
  })
})

describe('checkIdempotencyKey', () => {
  it('returns true when key exists', async () => {
    vi.mocked(redis.get).mockResolvedValue('done')
    const result = await checkIdempotencyKey('cart:user-1:prod-1')
    expect(result).toBe(true)
  })

  it('returns false when key missing', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    const result = await checkIdempotencyKey('cart:user-1:prod-1')
    expect(result).toBe(false)
  })
})

describe('incrementProactiveCount', () => {
  it('increments and sets 4hr TTL on first call', async () => {
    vi.mocked(redis.incr).mockResolvedValue(1)
    vi.mocked(redis.expire).mockResolvedValue(1)
    await incrementProactiveCount('user-1')
    expect(redis.incr).toHaveBeenCalledWith('proactive:user-1:count')
    expect(redis.expire).toHaveBeenCalledWith(
      'proactive:user-1:count',
      14400
    )
  })
})

describe('getProactiveCount', () => {
  it('returns 0 when no key exists', async () => {
    vi.mocked(redis.get).mockResolvedValue(null)
    const result = await getProactiveCount('user-1')
    expect(result).toBe(0)
  })

  it('returns count when key exists', async () => {
    vi.mocked(redis.get).mockResolvedValue('1')
    const result = await getProactiveCount('user-1')
    expect(result).toBe(1)
  })
})
