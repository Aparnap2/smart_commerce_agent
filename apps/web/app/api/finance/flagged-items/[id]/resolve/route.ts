import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = _request.headers.get('x-role')
  if (!role || !['FINANCE', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { id } = await params

    await prisma.$executeRaw`
      UPDATE "CatalogItem"
      SET "pricingFlag" = false, "pricingFlaggedAt" = NULL
      WHERE id = ${id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resolving flagged item:', error)
    return NextResponse.json({ error: 'Failed to resolve item' }, { status: 500 })
  }
}
