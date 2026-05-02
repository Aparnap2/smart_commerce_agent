// apps/agent/src/__tests__/tools/customer-tools.test.ts
import { describe, it, expect, vi } from 'vitest'

// Mock the handler imports — these come from web app
vi.mock('../../tools/handlers-bridge.js', () => ({
  searchProductsHandler: vi.fn().mockResolvedValue([
    { id: 1, name: 'Sony WH-1000XM5', price: 26990, stock: 5 }
  ]),
  addToCartHandler: vi.fn().mockResolvedValue({ success: true, cartId: 'c1' }),
  viewCartHandler: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  getOrdersHandler: vi.fn().mockResolvedValue([]),
  initiateReturnHandler: vi.fn().mockResolvedValue({ eligible: true, options: [] }),
  trackOrderHandler: vi.fn().mockResolvedValue({ orderId: 'o1', status: 'SHIPPED' }),
}))

import { customerTools } from '../../tools/customer-tools.js'

describe('customerTools', () => {
  it('exports array of 6 tools', () => {
    expect(customerTools).toHaveLength(6)
  })

  it('every tool has name, description, schema', () => {
    customerTools.forEach(tool => {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.schema).toBeDefined()
    })
  })

  it('searchProducts tool has query param', () => {
    const tool = customerTools.find(t => t.name === 'searchProducts')
    expect(tool).toBeDefined()
    const result = tool!.schema.safeParse({ query: 'headphones' })
    expect(result.success).toBe(true)
  })

  it('addToCart tool has productId + quantity', () => {
    const tool = customerTools.find(t => t.name === 'addToCart')
    expect(tool).toBeDefined()
    const result = tool!.schema.safeParse({ productId: 1, quantity: 2 })
    expect(result.success).toBe(true)
  })

  it('tools reject invalid input', () => {
    const tool = customerTools.find(t => t.name === 'searchProducts')!
    const result = tool.schema.safeParse({})
    expect(result.success).toBe(false)
  })
})
