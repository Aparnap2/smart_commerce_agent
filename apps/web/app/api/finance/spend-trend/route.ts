import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'

const STATUS_FILTER = ['APPROVED', 'ORDERED', 'RECEIVED'] as const

export async function GET(request: Request) {
  const role = request.headers.get('x-role')
  if (!role || !['FINANCE', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const rows = await prisma.$queryRaw<Array<{ month: string; total: bigint; count: bigint }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
        COALESCE(SUM("totalAmount"), 0) as total,
        COUNT(*) as count
      FROM "PurchaseRequest"
      WHERE "createdAt" >= ${sixMonthsAgo}::timestamp
        AND "status" = ANY(${STATUS_FILTER}::text[])
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `

    const data = rows.map(r => ({
      month: r.month,
      total: Number(r.total),
      count: Number(r.count),
    }))

    return NextResponse.json({ months: data })
  } catch (error) {
    console.error('Error fetching spend trend:', error)
    return NextResponse.json({ error: 'Failed to fetch spend trend' }, { status: 500 })
  }
}
