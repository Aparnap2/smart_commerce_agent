import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma/client'

export async function GET(request: Request) {
  const role = request.headers.get('x-role')
  if (!role || !['FINANCE', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const rows = await prisma.$queryRaw<Array<{
      id: string; name: string; sku: string; unitPrice: number;
      category: string; vendor: string; vendorCode: string;
      marketMedianPrice: number | null; pricingFlaggedAt: Date | null;
    }>>`
      SELECT id, name, sku, "unitPrice", category, vendor,
             "vendorCode", "marketMedianPrice", "pricingFlaggedAt"
      FROM "CatalogItem"
      WHERE "pricingFlag" = true
      ORDER BY "pricingFlaggedAt" DESC NULLS LAST
    `

    const items = rows.map(r => {
      const unitPrice = Number(r.unitPrice)
      const marketMedian = r.marketMedianPrice ? Number(r.marketMedianPrice) : null
      let premiumPct = 0
      if (marketMedian && marketMedian > 0) {
        premiumPct = Math.round(((unitPrice - marketMedian) / marketMedian) * 100 * 10) / 10
      }

      return {
        id: r.id,
        name: r.name,
        sku: r.sku,
        vendor: r.vendor,
        vendorCode: r.vendorCode || '',
        category: r.category,
        unitPrice,
        marketMedianPrice: marketMedian,
        pricePremiumPct: premiumPct,
        flaggedAt: r.pricingFlaggedAt?.toISOString() ?? null,
      }
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error('Error fetching flagged items:', error)
    return NextResponse.json({ error: 'Failed to fetch flagged items' }, { status: 500 })
  }
}
