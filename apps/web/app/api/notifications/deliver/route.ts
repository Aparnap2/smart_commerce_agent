import { NextRequest, NextResponse } from 'next/server'
import { redis, prChannel, notificationsEnabled } from '@/lib/upstash'

interface NotificationPayload {
  prId: string
  prNumber: string
  employeeId: string
  type: 'PR_SUBMITTED' | 'PR_APPROVED' | 'PR_REJECTED' | 'PR_NEEDS_REVISION'
  message: string
  amount?: number
}

export async function POST(req: NextRequest) {
  if (!notificationsEnabled || !redis) {
    return NextResponse.json({ disabled: true })
  }

  const payload: NotificationPayload = await req.json()
  const { prId, prNumber, employeeId, type, message, amount } = payload

  if (!prId || !employeeId || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const channel = prChannel(employeeId)
  const notification = JSON.stringify({
    id: crypto.randomUUID(),
    prId,
    prNumber,
    type,
    message,
    amount,
    timestamp: new Date().toISOString(),
    read: false,
  })

  await redis.lpush(`notifications:${employeeId}`, notification)
  await redis.ltrim(`notifications:${employeeId}`, 0, 99)

  return NextResponse.json({ success: true })
}