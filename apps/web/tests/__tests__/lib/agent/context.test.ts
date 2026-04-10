import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/redis/memory', () => ({
  getUserContext: vi.fn(),
}))

vi.mock('@/lib/db/client', () => ({
  prisma: {
    cart: {
      findUnique: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    order: {
      findFirst: vi.fn(),
    },
  }
}))

import { getUserContext } from '@/lib/redis/memory'
import { prisma } from '@/lib/db/client'
import {
  buildSystemContext,
  compactToolResult,
} from '@/lib/agent/context'

beforeEach(() => { vi.clearAllMocks() })

describe('buildSystemContext', () => {
  it('returns empty string when all sources miss', async () => {
    vi.mocked(getUserContext).mockResolvedValue(null)
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)

    const result = await buildSystemContext('user-1')
    expect(result).toBe('')
  })

  it('injects last search when context exists', async () => {
    vi.mocked(getUserContext).mockResolvedValue({
      lastSearch: 'Sony headphones'
    })
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)

    const result = await buildSystemContext('user-1')
    expect(result).toContain('Sony headphones')
  })

  it('injects cart total when cart exists with items', async () => {
    vi.mocked(getUserContext).mockResolvedValue(null)
    vi.mocked(prisma.cart.findUnique).mockResolvedValue({
      id: 'cart-1',
      customerId: 'user-1',
    } as any)
    vi.mocked(prisma.cartItem.findMany).mockResolvedValue([
      { price: 9999, quantity: 1 }
    ])
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)

    const result = await buildSystemContext('user-1')
    expect(result).toContain('9,999')
  })

  it('injects order status when last order exists', async () => {
    vi.mocked(getUserContext).mockResolvedValue(null)
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findFirst).mockResolvedValue({
      id: 42,
      status: 'SHIPPED',
      orderDate: new Date(),
      total: 9999,
    } as any)

    const result = await buildSystemContext('user-1')
    expect(result).toContain('SHIPPED')
  })

  it('never crashes when Redis throws', async () => {
    vi.mocked(getUserContext).mockRejectedValue(
      new Error('ECONNREFUSED')
    )
    vi.mocked(prisma.cart.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.order.findFirst).mockResolvedValue(null)

    await expect(buildSystemContext('user-1')).resolves.toBeDefined()
  })
})

describe('compactToolResult', () => {
  it('summarises searchProducts result under 200 chars', () => {
    const products = Array(6).fill({
      id: 1, name: 'Sony WH-1000XM5', price: 26990
    })
    const result = compactToolResult('searchProducts', products)
    expect(result.length).toBeLessThanOrEqual(200)
    expect(result).toContain('6')
  })

  it('summarises empty searchProducts as "No products found"', () => {
    const result = compactToolResult('searchProducts', [])
    expect(result).toContain('No products found')
  })

  it('summarises addToCart result with total', () => {
    const cart = { items: [{ name: 'Sony', price: 9999, quantity: 1 }],
                   total: 9999 }
    const result = compactToolResult('addToCart', cart)
    expect(result).toContain('9,999')
  })

  it('summarises getOrders result with count', () => {
    const orders = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = compactToolResult('getOrders', orders)
    expect(result).toContain('3')
  })

  it('never exceeds 200 characters for any input', () => {
    const bigResult = { data: 'x'.repeat(1000) }
    const result = compactToolResult('unknownTool', bigResult)
    expect(result.length).toBeLessThanOrEqual(200)
  })
})
