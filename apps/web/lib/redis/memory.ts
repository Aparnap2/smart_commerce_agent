import { redis } from '@/lib/redis/client'

type UserContext = {
  lastSearch?: string
  lastAction?: string
  lastProductId?: number
  lastOrderId?: number
}

export async function setUserContext(
  userId: string,
  context: UserContext
): Promise<void> {
  try {
    await redis.setex(
      `user:${userId}:context`,
      86400, // 24 hours
      JSON.stringify(context)
    )
  } catch {
    // Non-fatal — context is best-effort
  }
}

export async function getUserContext(
  userId: string
): Promise<UserContext | null> {
  try {
    const raw = await redis.get(`user:${userId}:context`)
    if (!raw) return null
    return JSON.parse(raw) as UserContext
  } catch {
    return null // Fail open — missing context is fine
  }
}

export async function setIdempotencyKey(key: string): Promise<void> {
  try {
    await redis.setex(`idem:${key}`, 30, 'done')
  } catch {
    // If we can't set the key, we allow the operation
  }
}

export async function checkIdempotencyKey(
  key: string
): Promise<boolean> {
  try {
    const val = await redis.get(`idem:${key}`)
    return val !== null
  } catch {
    return false // Fail open on Redis error
  }
}

export async function incrementProactiveCount(
  userId: string
): Promise<void> {
  try {
    const key = `proactive:${userId}:count`
    await redis.incr(key)
    await redis.expire(key, 14400) // 4 hours
  } catch {
    // Non-fatal
  }
}

export async function getProactiveCount(
  userId: string
): Promise<number> {
  try {
    const val = await redis.get(`proactive:${userId}:count`)
    return val ? parseInt(val, 10) : 0
  } catch {
    return 0
  }
}
