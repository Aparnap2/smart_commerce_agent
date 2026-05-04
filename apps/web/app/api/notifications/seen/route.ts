import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redis, notificationsEnabled } from '@/lib/upstash'

export async function POST(req: NextRequest) {
  if (!notificationsEnabled || !redis) {
    return NextResponse.json({ disabled: true })
  }
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { notificationIds } = await req.json()
  if (!notificationIds || !Array.isArray(notificationIds)) {
    return NextResponse.json({ error: 'notificationIds array required' }, { status: 400 })
  }

  const employeeId = session.user.email
  const key = `notifications:${employeeId}`

  const all = await redis.lrange<string>(key, 0, -1)
  const updated = all.map((n) => {
    const parsed = JSON.parse(n)
    if (notificationIds.includes(parsed.id)) {
      parsed.read = true
    }
    return parsed
  })

  await redis.del(key)
  if (updated.length > 0) {
    await redis.rpush(key, ...updated.map((n) => JSON.stringify(n)))
  }

  return NextResponse.json({ success: true })
}

export async function GET() {
  if (!notificationsEnabled || !redis) {
    return NextResponse.json({ disabled: true })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const employeeId = session.user.email
  const key = `notifications:${employeeId}`
  const all = await redis.lrange<string>(key, 0, 49)

  const notifications = all.map((n) => JSON.parse(n))
  return NextResponse.json({ notifications })
}