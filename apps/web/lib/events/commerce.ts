import { prisma } from '@/lib/db/client'
import { Prisma } from '@prisma/client'

export type CommerceEventType =
  | 'cart_abandoned'
  | 'stock_low'
  | 'price_drop'

export async function writeCommerceEvent(
  type: CommerceEventType,
  userId: string | null,
  payload: Record<string, unknown>
) {
  return prisma.commerceEvent.create({
    data: {
      event_type: type,
      userId,
      payload: payload as Prisma.InputJsonValue,
      processed: false,
    }
  })
}

export async function getUnprocessedEvents() {
  return prisma.commerceEvent.findMany({
    where: { processed: false },
    orderBy: { createdAt: 'asc' },
  })
}

export async function markEventProcessed(id: string) {
  await prisma.commerceEvent.update({
    where: { id },
    data: {
      processed: true,
      processedAt: new Date(),
    }
  })
}
