import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db/client'
import {
  checkCartAbandonment,
  checkLowStock,
} from '@/lib/events/triggers'
import { createTestUser, createTestProduct, cleanupTestData } from '../helpers'

let abandonedUserId: string
let activeUserId: string
let lowStockProductId: number
let highStockProductId: number
const eventIds: string[] = []

describe('checkCartAbandonment', () => {
  beforeAll(async () => {
    const abandonedUser = await createTestUser('SHOPPER')
    abandonedUserId = abandonedUser.id

    const abandonedCart = await prisma.cart.upsert({
      where: { customerId: abandonedUserId },
      create: { customerId: abandonedUserId },
      update: {}
    })
    
    await prisma.cartItem.create({
      data: {
        cartId: abandonedCart.id,
        productId: 1,
        price: 9999,
        quantity: 1
      }
    })

    await prisma.cart.update({
      where: { id: abandonedCart.id },
      data: { updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) }
    })

    const activeUser = await createTestUser('MERCHANT')
    activeUserId = activeUser.id

    const activeCart = await prisma.cart.upsert({
      where: { customerId: activeUserId },
      create: { customerId: activeUserId },
      update: {}
    })

    await prisma.cartItem.create({
      data: {
        cartId: activeCart.id,
        productId: 1,
        price: 9999,
        quantity: 1
      }
    })

    await prisma.cart.update({
      where: { id: activeCart.id },
      data: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) }
    })

    const lowStock = await createTestProduct({ stock: 3 })
    lowStockProductId = lowStock.id

    const highStock = await createTestProduct({ stock: 50 })
    highStockProductId = highStock.id
  })

  afterAll(async () => {
    await prisma.commerceEvent.deleteMany({
      where: {
        OR: [
          { userId: abandonedUserId },
          { userId: activeUserId },
        ]
      }
    })
    await cleanupTestData({
      userIds: [abandonedUserId, activeUserId],
      productIds: [lowStockProductId, highStockProductId],
    })
  })

  it('creates cart_abandoned event for 2hr+ old cart with items', async () => {
    const before = await prisma.commerceEvent.count({
      where: { event_type: 'cart_abandoned', userId: abandonedUserId }
    })

    await checkCartAbandonment()

    const after = await prisma.commerceEvent.count({
      where: { event_type: 'cart_abandoned', userId: abandonedUserId }
    })

    expect(after).toBeGreaterThan(before)
  })

  it('does NOT create event for recently updated cart', async () => {
    const before = await prisma.commerceEvent.count({
      where: { event_type: 'cart_abandoned', userId: activeUserId }
    })

    await checkCartAbandonment()

    const after = await prisma.commerceEvent.count({
      where: { event_type: 'cart_abandoned', userId: activeUserId }
    })

    expect(after).toBe(before)
  })
})

describe('checkLowStock', () => {
  it('runs without error', async () => {
    await expect(checkLowStock()).resolves.not.toThrow()
  })
})
