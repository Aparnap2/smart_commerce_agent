import { redis } from '@/lib/redis/client'

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

export async function rateLimit(
  identifier: string,
  opts: {
    window: number
    max: number
    prefix?: string
  }
): Promise<RateLimitResult> {
  const { window, max, prefix = 'rl' } = opts
  const key = `${prefix}:${identifier}`
  const now = Math.floor(Date.now() / 1000)

  try {
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, window)
    }
    const ttl = await redis.ttl(key)

    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      resetAt: now + (ttl > 0 ? ttl : window),
    }
  } catch {
    if (process.env.NODE_ENV !== 'test') {
      console.error('[ratelimit] Redis unavailable — failing open')
    }
    return { allowed: true, remaining: max, resetAt: now + window }
  }
}

export const chatRateLimit = (userId: string) =>
  rateLimit(userId, {
    window: 60,
    max: 20,
    prefix: 'rl:chat',
  })

export const apiRateLimit = (ip: string) =>
  rateLimit(ip, {
    window: 60,
    max: 100,
    prefix: 'rl:api',
  })
