import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET() {
  let postgresOk = false

  try {
    await prisma.$queryRaw`SELECT 1`
    postgresOk = true
  } catch { /* fall through */ }

  const allOk = postgresOk
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', postgres: postgresOk },
    { status: allOk ? 200 : 503 }
  )
}
