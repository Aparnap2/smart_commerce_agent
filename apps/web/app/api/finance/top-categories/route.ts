import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'

export async function GET(request: Request) {
  const role = request.headers.get('x-role')
  if (!role || !['FINANCE', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ category: string; total: bigint; count: bigint }>>`
      SELECT
        ci."category"::text as category,
        COALESCE(SUM(pli."totalPrice"), 0) as total,
        COUNT(DISTINCT pli."prId") as count
      FROM "PRLineItem" pli
      JOIN "CatalogItem" ci ON ci.id = pli."catalogItemId"
      GROUP BY ci."category"
      ORDER BY total DESC
    `

    const data = rows.map(r => ({
      category: r.category,
      total: Number(r.total),
      prCount: Number(r.count),
    }))

    return NextResponse.json({ categories: data })
  } catch (error) {
    console.error('Error fetching top categories:', error)
    return NextResponse.json({ error: 'Failed to fetch category data' }, { status: 500 })
  }
}
