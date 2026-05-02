import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }
  const order = await prisma.order.findFirst({
    where: {
      status: 'DELIVERED',
      orderDate: {
        gte: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      }
    },
    select: { id: true }
  })
  return NextResponse.json({ orderId: order?.id ?? null })
}
