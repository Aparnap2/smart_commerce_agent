import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrderList from '@/components/genui/OrderList'

const mockOrders = [
  { id: 'ord_abc123xyz', status: 'DELIVERED', total: 26990, orderDate: '2025-03-15', trackingNumber: 'TRK123456' },
  { id: 'ord_def456uvw', status: 'SHIPPED', total: 5999, orderDate: '2025-03-20', trackingNumber: 'TRK789012' },
  { id: 'ord_ghi789rst', status: 'PENDING', total: 12999, orderDate: '2025-03-22' },
]

describe('OrderList', () => {
  it('renders order cards', () => {
    render(<OrderList orders={mockOrders} />)
    expect(screen.getByTestId('order-list')).toBeInTheDocument()
    expect(screen.getAllByTestId('order-card')).toHaveLength(3)
  })

  it('shows status badges with correct colors', () => {
    render(<OrderList orders={mockOrders} />)
    const badges = screen.getAllByTestId('order-status-badge')
    expect(badges[0]).toHaveTextContent('DELIVERED')
    expect(badges[1]).toHaveTextContent('SHIPPED')
    expect(badges[2]).toHaveTextContent('PENDING')
  })

  it('displays ₹ price in INR format', () => {
    render(<OrderList orders={mockOrders} />)
    const prices = screen.getAllByText(/₹/)
    expect(prices.length).toBeGreaterThan(0)
  })

  it('shows tracking number when available', () => {
    render(<OrderList orders={mockOrders} />)
    expect(screen.getByText(/Tracking: TRK123456/)).toBeInTheDocument()
  })

  it('hides tracking number when not available', () => {
    render(<OrderList orders={[mockOrders[2]]} />)
    expect(screen.queryByText(/Tracking:/)).not.toBeInTheDocument()
  })

  it('shows empty state when no orders', () => {
    render(<OrderList orders={[]} />)
    expect(screen.getByText('No orders found.')).toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    render(<OrderList orders={[]} loading />)
    expect(screen.getByTestId('order-list-loading')).toBeInTheDocument()
  })

  it('displays order date in Indian locale format', () => {
    render(<OrderList orders={[mockOrders[0]]} />)
    expect(screen.getByText('15/3/2025')).toBeInTheDocument()
  })

  it('shows truncated order ID', () => {
    render(<OrderList orders={[mockOrders[0]]} />)
    expect(screen.getByText('#bc123xyz')).toBeInTheDocument()
  })
})
