// Upstash Redis + QStash client
// Uses dynamic imports to handle missing packages gracefully

const NOTIFICATIONS_ENABLED =
  process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED !== 'false'
  && !!process.env.UPSTASH_REDIS_REST_URL

let _redis: any = null
let _qstash: any = null

async function getRedis() {
  if (!NOTIFICATIONS_ENABLED || _redis) return _redis
  try {
    const Redis = (await import('@upstash/redis')).default
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    return _redis
  } catch {
    return null
  }
}

async function getQStash() {
  if (!NOTIFICATIONS_ENABLED || _qstash) return _qstash
  try {
    const { Client } = await import('@upstash/qstash')
    _qstash = new Client({ token: process.env.QSTASH_TOKEN! })
    return _qstash
  } catch {
    return null
  }
}

export const redis = {
  async sadd(key: string, ...members: string[]) {
    const r = await getRedis()
    if (!r) return
    return r.sadd(key, ...members)
  },
  async lpush(key: string, ...elements: string[]) {
    const r = await getRedis()
    if (!r) return
    return r.lpush(key, ...elements)
  },
  async ltrim(key: string, start: number, stop: number) {
    const r = await getRedis()
    if (!r) return
    return r.ltrim(key, start, stop)
  },
  async lrange<T = string>(key: string, start: number, stop: number): Promise<T[]> {
    const r = await getRedis()
    if (!r) return []
    return r.lrange(key, start, stop)
  },
  async del(key: string) {
    const r = await getRedis()
    if (!r) return
    return r.del(key)
  },
  async rpush(key: string, ...elements: string[]) {
    const r = await getRedis()
    if (!r) return
    return r.rpush(key, ...elements)
  },
}

export const qstash = {
  async publish(args: any) {
    const q = await getQStash()
    if (!q) return
    return q.publish(args)
  },
}

export const notificationsEnabled = NOTIFICATIONS_ENABLED

export const prChannel = (employeeId: string) => `pr:approval:${employeeId}`
export const prSeenKey = (prId: string) => `pr:seen:${prId}`