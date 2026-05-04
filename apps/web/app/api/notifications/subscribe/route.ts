import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redis, prChannel, notificationsEnabled } from '@/lib/upstash'

export async function POST(req: NextRequest) {
  if (!notificationsEnabled || !redis) {
    return NextResponse.json({ disabled: true })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { employeeId } = await req.json()
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId required' }, { status: 400 })
  }

  const channel = prChannel(employeeId)
  await redis.sadd(channel, session.user.email)

  return NextResponse.json({ success: true, channel })
}