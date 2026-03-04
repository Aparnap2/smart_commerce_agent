import { describe, it, expect } from 'vitest'
import type { Product, Cart, Order, UserContext } from '@smart-commerce/types'

describe('@smart-commerce/types shape contracts', () => {
  it('Product type has required fields', () => {
    const p: Product = {
      id: 'p1',
      name: 'Test Product',
      price: 999,
      stock: 10,
    }
    expect(p.id).toBeDefined()
    expect(p.price).toBeTypeOf('number')
    expect(p.stock).toBeTypeOf('number')
  })

  it('Cart has correct structure', () => {
    const cart: Cart = {
      id: 'c1',
      items: [{
        id: 'ci1',
        productId: 'p1',
        quantity: 1,
        priceAt: 999,
      }],
      total: 999,
      discount: 0,
    }
    expect(cart.items[0].priceAt).toBe(999)
    expect(cart.total).toBe(999)
  })

  it('Order has required fields', () => {
    const order: Order = {
      id: 'o1',
      customerId: 'u1',
      total: 999,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      createdAt: new Date().toISOString(),
    }
    expect(order.status).toBe('PENDING')
    expect(order.paymentStatus).toBe('UNPAID')
  })

  it('UserContext has all required fields', () => {
    const ctx: UserContext = {
      cart: {
        id: 'c1',
        items: [],
        total: 0,
        discount: 0,
      },
      recentOrders: [],
      tasteVector: [],
      pendingNotifications: [],
      preferences: {},
    }
    expect(ctx.cart).toBeDefined()
    expect(ctx.recentOrders).toBeDefined()
    expect(ctx.tasteVector).toBeDefined()
  })
})
