// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { OrderTimeline } from '../../../app/dashboard/components/genui/order-timeline'
import { describe, it, expect } from 'vitest'
import type { Order, OrderStatus } from '@smart-commerce/types'

const makeOrder = (status: OrderStatus): Order => ({
  id:            'order-abc123def',
  customerId:    'user-1',
  total:         2999,
  status,
  paymentStatus: 'PAID',
  createdAt:     new Date().toISOString(),
})

describe('OrderTimeline', () => {
  it('renders all 4 steps', () => {
    render(<OrderTimeline order={makeOrder('CONFIRMED')} />)
    expect(screen.getByTestId('timeline-step-pending')).toBeTruthy()
    expect(screen.getByTestId('timeline-step-confirmed')).toBeTruthy()
    expect(screen.getByTestId('timeline-step-shipped')).toBeTruthy()
    expect(screen.getByTestId('timeline-step-delivered')).toBeTruthy()
  })

  it('shows last 8 chars of order id', () => {
    render(<OrderTimeline order={makeOrder('PENDING')} />)
    expect(screen.getByText(/BC123DEF/i)).toBeTruthy()
  })

  it('shows CANCELLED status badge for cancelled order', () => {
    render(<OrderTimeline order={makeOrder('CANCELLED')} />)
    expect(screen.getByText('CANCELLED')).toBeTruthy()
  })

  it('shows total and creation date', () => {
    render(<OrderTimeline order={makeOrder('SHIPPED')} />)
    expect(screen.getByText(/2,999/)).toBeTruthy()
  })
})
