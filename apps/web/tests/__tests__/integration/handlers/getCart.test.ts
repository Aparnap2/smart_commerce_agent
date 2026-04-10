import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db/client'
import { getCartHandler } from '@/lib/mcp/handlers'
import { createTestUser, cleanupTestData } from '../helpers'

let userId: string

describe('getCartHandler', () => {
  beforeAll(async () => {
    const user = await createTestUser()
    userId = user.id
  })

  afterAll(async () => {
    if (userId) {
      await cleanupTestData({ userIds: [userId] })
    }
  })

  it('returns empty cart object for user with no cart', async () => {
    const cart = await getCartHandler(userId)
    expect(cart).toBeDefined()
    expect(cart).not.toBeNull()
    expect(cart.items).toEqual([])
    expect(cart.total).toBe(0)
  })

  it('returns existing cart for user who has one', async () => {
    await prisma.cart.create({
      data: { customerId: userId }
    })
    const cart = await getCartHandler(userId)
    expect(cart).toBeDefined()
    expect(cart.customerId).toBe(userId)
  })
})
