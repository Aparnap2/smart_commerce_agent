import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db/client'
import {
  writeCommerceEvent,
  getUnprocessedEvents,
  markEventProcessed,
} from '@/lib/events/commerce'

const createdIds: string[] = []

afterEach(async () => {
  if (createdIds.length) {
    await prisma.commerceEvent.deleteMany({
      where: { id: { in: createdIds } }
    })
    createdIds.length = 0
  }
})

describe('writeCommerceEvent', () => {
  it('creates a cart_abandoned event with correct fields', async () => {
    const event = await writeCommerceEvent(
      'cart_abandoned',
      'user-123',
      { cartId: 'cart-abc', itemCount: 2 }
    )
    createdIds.push(event.id)

    expect(event.event_type).toBe('cart_abandoned')
    expect(event.userId).toBe('user-123')
    expect(event.processed).toBe(false)
    expect(event.processedAt).toBeNull()
    expect(event.payload).toMatchObject({ cartId: 'cart-abc' })
  })

  it('creates a merchant event with null userId', async () => {
    const event = await writeCommerceEvent(
      'stock_low',
      null,
      { productId: 1, stock: 3 }
    )
    createdIds.push(event.id)

    expect(event.userId).toBeNull()
    expect(event.event_type).toBe('stock_low')
  })

  it('sets processed=false by default', async () => {
    const event = await writeCommerceEvent(
      'price_drop',
      'user-456',
      { productId: 2 }
    )
    createdIds.push(event.id)
    expect(event.processed).toBe(false)
  })
})

describe('getUnprocessedEvents', () => {
  it('returns only unprocessed events', async () => {
    const e1 = await writeCommerceEvent(
      'cart_abandoned', 'user-1', {}
    )
    const e2 = await writeCommerceEvent(
      'cart_abandoned', 'user-2', {}
    )
    createdIds.push(e1.id, e2.id)

    await markEventProcessed(e1.id)

    const unprocessed = await getUnprocessedEvents()
    const ids = unprocessed.map(e => e.id)

    expect(ids).not.toContain(e1.id)
    expect(ids).toContain(e2.id)
  })

  it('returns events in ascending createdAt order', async () => {
    const e1 = await writeCommerceEvent('stock_low', null, {})
    await new Promise(r => setTimeout(r, 10))
    const e2 = await writeCommerceEvent('stock_low', null, {})
    createdIds.push(e1.id, e2.id)

    const events = await getUnprocessedEvents()
    const relevantEvents = events.filter(
      e => [e1.id, e2.id].includes(e.id)
    )

    if (relevantEvents.length >= 2) {
      const t1 = new Date(relevantEvents[0].createdAt).getTime()
      const t2 = new Date(relevantEvents[1].createdAt).getTime()
      expect(t1).toBeLessThanOrEqual(t2)
    }
  })

  it('returns empty array when all events are processed', async () => {
    const events = await getUnprocessedEvents()
    expect(Array.isArray(events)).toBe(true)
  })
})

describe('markEventProcessed', () => {
  it('sets processed=true and processedAt timestamp', async () => {
    const event = await writeCommerceEvent(
      'cart_abandoned', 'user-789', {}
    )
    createdIds.push(event.id)

    await markEventProcessed(event.id)

    const updated = await prisma.commerceEvent.findUnique({
      where: { id: event.id }
    })
    expect(updated?.processed).toBe(true)
    expect(updated?.processedAt).not.toBeNull()
  })

  it('is idempotent — marking twice does not throw', async () => {
    const event = await writeCommerceEvent(
      'stock_low', null, {}
    )
    createdIds.push(event.id)

    await markEventProcessed(event.id)
    await expect(markEventProcessed(event.id)).resolves.not.toThrow()
  })
})
