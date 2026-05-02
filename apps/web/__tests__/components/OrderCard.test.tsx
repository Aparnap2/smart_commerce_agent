import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import OrderCard from '@/components/genui/OrderCard'

const mockOrder = {
  id: 'ord_abc123xyz',
  status: 'SHIPPED',
  total: 32989,
  orderDate: '2025-03-15',
  items: [
    { productId: 1, name: 'Sony WH-1000XM5', price: 26990, quantity: 1 },
    { productId: 2, name: 'USB-C Cable', price: 599, quantity: 2 },
    { productId: 3, name: 'Phone Case', price: 999, quantity: 1 },
  ],
  trackingNumber: 'TRK123456',
  estimatedDelivery: '25 Mar 2025',
}

describe('OrderCard', () => {
  it('renders order card', () => {
    render(<OrderCard order={mockOrder} />)
    expect(screen.getByTestId('order-card')).toBeInTheDocument()
  })

  it('shows status badge', () => {
    render(<OrderCard order={mockOrder} />)
    expect(screen.getByTestId('order-status-badge')).toHaveTextContent('SHIPPED')
  })

  it('displays order items with prices', () => {
    render(<OrderCard order={mockOrder} />)
    expect(screen.getByText('Sony WH-1000XM5 × 1')).toBeInTheDocument()
    expect(screen.getByText('USB-C Cable × 2')).toBeInTheDocument()
  })

  it('shows "more items" indicator when order has more than 2 items', () => {
    render(<OrderCard order={mockOrder} />)
    expect(screen.getByText('+1 more items')).toBeInTheDocument()
  })

  it('displays total price in INR format', () => {
    render(<OrderCard order={mockOrder} />)
    expect(screen.getByText('₹32,989')).toBeInTheDocument()
  })

  it('shows tracking number when available', () => {
    render(<OrderCard order={mockOrder} />)
    expect(screen.getByText('Tracking: TRK123456')).toBeInTheDocument()
  })

  it('shows estimated delivery when available', () => {
    render(<OrderCard order={mockOrder} />)
    expect(screen.getByText('Est. delivery: 25 Mar 2025')).toBeInTheDocument()
  })

  it('shows Track Order button for SHIPPED status', () => {
    const onTrack = vi.fn()
    render(<OrderCard order={mockOrder} onTrack={onTrack} />)
    expect(screen.getByTestId('track-order-button')).toBeInTheDocument()
  })

  it('shows Reorder button for DELIVERED status', () => {
    const onReorder = vi.fn()
    const deliveredOrder = { ...mockOrder, status: 'DELIVERED' }
    render(<OrderCard order={deliveredOrder} onReorder={onReorder} />)
    expect(screen.getByTestId('reorder-button')).toBeInTheDocument()
  })

  it('shows Cancel button for PENDING status', () => {
    const onCancel = vi.fn()
    const pendingOrder = { ...mockOrder, status: 'PENDING' }
    render(<OrderCard order={pendingOrder} onCancel={onCancel} />)
    expect(screen.getByTestId('cancel-order-button')).toBeInTheDocument()
  })

  it('shows Cancel button for PAID status', () => {
    const onCancel = vi.fn()
    const paidOrder = { ...mockOrder, status: 'PAID' }
    render(<OrderCard order={paidOrder} onCancel={onCancel} />)
    expect(screen.getByTestId('cancel-order-button')).toBeInTheDocument()
  })

  it('hides action buttons when handlers not provided', () => {
    render(<OrderCard order={mockOrder} />)
    expect(screen.queryByTestId('track-order-button')).not.toBeInTheDocument()
  })

  it('calls onTrack when Track Order button clicked', () => {
    const onTrack = vi.fn()
    render(<OrderCard order={mockOrder} onTrack={onTrack} />)
    screen.getByTestId('track-order-button').click()
    expect(onTrack).toHaveBeenCalledTimes(1)
  })

  it('calls onReorder when Reorder button clicked', () => {
    const onReorder = vi.fn()
    const deliveredOrder = { ...mockOrder, status: 'DELIVERED' }
    render(<OrderCard order={deliveredOrder} onReorder={onReorder} />)
    screen.getByTestId('reorder-button').click()
    expect(onReorder).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn()
    const pendingOrder = { ...mockOrder, status: 'PENDING' }
    render(<OrderCard order={pendingOrder} onCancel={onCancel} />)
    screen.getByTestId('cancel-order-button').click()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('shows truncated order ID', () => {
    render(<OrderCard order={mockOrder} />)
    expect(screen.getByText('#bc123xyz')).toBeInTheDocument()
  })
})
