import { describe, it, expect } from 'vitest'
import {
  isWithinReturnWindow,
  getRefundOptions,
  autoApprove,
} from '@/lib/policies/returns'

const orderDaysAgo = (days: number) => ({
  id: 1,
  customerId: 1,
  productId: 1,
  orderDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
  total: 11990,
  status: 'DELIVERED',
  quantity: 1,
  paymentStatus: 'PAID',
  shippingAddress: '123 Test St',
  trackingNumber: null,
})

describe('isWithinReturnWindow', () => {
  it('returns true for order 1 day ago', () => {
    expect(isWithinReturnWindow(orderDaysAgo(1))).toBe(true)
  })

  it('returns true for order 6 days ago', () => {
    expect(isWithinReturnWindow(orderDaysAgo(6))).toBe(true)
  })

  it('returns false for order 8 days ago', () => {
    expect(isWithinReturnWindow(orderDaysAgo(8))).toBe(false)
  })

  it('returns true for order today', () => {
    expect(isWithinReturnWindow(orderDaysAgo(0))).toBe(true)
  })
})

describe('getRefundOptions', () => {
  it('always returns exactly 3 options', () => {
    const options = getRefundOptions(orderDaysAgo(2))
    expect(options).toHaveLength(3)
  })

  it('returns replacement, refund, and store_credit types', () => {
    const options = getRefundOptions(orderDaysAgo(2))
    const types = options.map(o => o.type)
    expect(types).toContain('replacement')
    expect(types).toContain('refund')
    expect(types).toContain('store_credit')
  })

  it('store_credit amount is order total + 500 bonus', () => {
    const order = orderDaysAgo(2)
    const options = getRefundOptions(order)
    const credit = options.find(o => o.type === 'store_credit')
    expect(credit?.amount).toBe(order.total + 500)
    expect(credit?.bonus).toBe(500)
  })

  it('refund amount equals order total exactly', () => {
    const order = orderDaysAgo(2)
    const options = getRefundOptions(order)
    const refund = options.find(o => o.type === 'refund')
    expect(refund?.amount).toBe(order.total)
  })
})

describe('autoApprove', () => {
  it('returns true for order less than 3 days old', () => {
    expect(autoApprove(orderDaysAgo(2))).toBe(true)
  })

  it('returns false for order more than 3 days old', () => {
    expect(autoApprove(orderDaysAgo(4))).toBe(false)
  })

  it('returns false for order exactly 3 days old', () => {
    expect(autoApprove(orderDaysAgo(3))).toBe(false)
  })
})
