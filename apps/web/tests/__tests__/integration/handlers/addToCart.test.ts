import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { addToCartHandler } from '@/lib/mcp/handlers'
import { createTestUser, createTestProduct, cleanupTestData } from '../helpers'

let userId: string
let productId: number
let outOfStockProductId: number

describe('addToCartHandler', () => {
  beforeAll(async () => {
    const user = await createTestUser()
    userId = user.id
    const product = await createTestProduct({ stock: 10, price: 9999 })
    productId = product.id
    const oos = await createTestProduct({ stock: 0, name: 'OOS Product' })
    outOfStockProductId = oos.id
  })

  afterAll(async () => {
    await cleanupTestData({
      userIds: [userId],
      productIds: [productId, outOfStockProductId],
      redisKeys: [
        `cart:${userId}:${productId}`,
        `cart:${userId}:${outOfStockProductId}`,
      ]
    })
  })

  it('adds product and returns cart with correct total', async () => {
    const cart = await addToCartHandler(
      { productId, quantity: 1 },
      userId
    )
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0].productId).toBe(productId)
    expect(cart.total).toBe(9999)
  })

  it('throws "Product not found" for fake productId', async () => {
    await expect(
      addToCartHandler({ productId: 999999, quantity: 1 }, userId)
    ).rejects.toThrow('Product not found')
  })

  it('throws "out of stock" when stock is 0', async () => {
    await expect(
      addToCartHandler(
        { productId: outOfStockProductId, quantity: 1 },
        userId
      )
    ).rejects.toThrow('out of stock')
  })

  it('rejects quantity less than 1', async () => {
    await expect(
      addToCartHandler({ productId, quantity: 0 }, userId)
    ).rejects.toThrow()
  })

  it('rejects quantity greater than 99', async () => {
    await expect(
      addToCartHandler({ productId, quantity: 100 }, userId)
    ).rejects.toThrow()
  })
})
