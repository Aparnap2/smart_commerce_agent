import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReturnCard from '@/components/genui/ReturnCard'

const mockReturnOptions = [
  {
    type: 'refund' as const,
    label: 'Refund to Original Payment',
    description: 'Refund will be processed within 5-7 business days',
    amount: 26990,
  },
  {
    type: 'exchange' as const,
    label: 'Exchange for Another Product',
    description: 'Free exchange with no additional charges',
  },
  {
    type: 'store_credit' as const,
    label: 'Store Credit',
    description: 'Instant store credit with bonus amount',
    amount: 28990,
  },
]

describe('ReturnCard', () => {
  it('renders return card', () => {
    render(
      <ReturnCard
        eligible
        options={mockReturnOptions}
        orderId="ord_abc123xyz"
      />
    )
    expect(screen.getByTestId('return-card')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<ReturnCard eligible options={[]} loading />)
    expect(screen.getByTestId('return-card-loading')).toBeInTheDocument()
  })

  it('shows ineligible message when not eligible', () => {
    render(
      <ReturnCard
        eligible={false}
        options={[]}
        orderId="ord_abc123xyz"
      />
    )
    expect(screen.getByTestId('return-card-ineligible')).toBeInTheDocument()
    expect(
      screen.getByText(/This order is not eligible for return/)
    ).toBeInTheDocument()
  })

  it('displays order ID in header', () => {
    render(
      <ReturnCard
        eligible
        options={mockReturnOptions}
        orderId="ord_abc123xyz"
      />
    )
    expect(screen.getByText('Return Order #bc123xyz')).toBeInTheDocument()
  })

  it('shows return option buttons', () => {
    render(
      <ReturnCard
        eligible
        options={mockReturnOptions}
        orderId="ord_abc123xyz"
      />
    )
    expect(screen.getByTestId('return-option-refund')).toBeInTheDocument()
    expect(screen.getByTestId('return-option-exchange')).toBeInTheDocument()
    expect(screen.getByTestId('return-option-store_credit')).toBeInTheDocument()
  })

  it('displays option labels and descriptions', () => {
    render(
      <ReturnCard
        eligible
        options={mockReturnOptions}
        orderId="ord_abc123xyz"
      />
    )
    expect(
      screen.getByText('Refund to Original Payment')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Exchange for Another Product')
    ).toBeInTheDocument()
    expect(screen.getByText('Store Credit')).toBeInTheDocument()
  })

  it('shows bonus badge for store credit option', () => {
    render(
      <ReturnCard
        eligible
        options={mockReturnOptions}
        orderId="ord_abc123xyz"
      />
    )
    expect(screen.getByText('+₹28990 bonus')).toBeInTheDocument()
  })

  it('calls onSelect when option is clicked', () => {
    const onSelect = vi.fn()
    render(
      <ReturnCard
        eligible
        options={mockReturnOptions}
        orderId="ord_abc123xyz"
        onSelect={onSelect}
      />
    )
    fireEvent.click(screen.getByTestId('return-option-refund'))
    expect(onSelect).toHaveBeenCalledWith('refund')
  })

  it('highlights selected option', () => {
    render(
      <ReturnCard
        eligible
        options={mockReturnOptions}
        orderId="ord_abc123xyz"
      />
    )
    fireEvent.click(screen.getByTestId('return-option-exchange'))
    const exchangeButton = screen.getByTestId('return-option-exchange')
    expect(exchangeButton).toHaveClass('border-indigo-500')
    expect(exchangeButton).toHaveClass('bg-indigo-50')
  })

  it('shows instruction text', () => {
    render(
      <ReturnCard
        eligible
        options={mockReturnOptions}
        orderId="ord_abc123xyz"
      />
    )
    expect(
      screen.getByText('Choose your preferred resolution:')
    ).toBeInTheDocument()
  })

  it('handles option without amount', () => {
    const optionsWithoutAmount = [
      {
        type: 'exchange' as const,
        label: 'Exchange',
        description: 'Exchange product',
      },
    ]
    render(
      <ReturnCard
        eligible
        options={optionsWithoutAmount}
        orderId="ord_abc123xyz"
      />
    )
    expect(screen.getByTestId('return-option-exchange')).toBeInTheDocument()
    expect(
      screen.queryByText(/\+₹.*bonus/)
    ).not.toBeInTheDocument()
  })

  it('renders multiple options correctly', () => {
    render(
      <ReturnCard
        eligible
        options={mockReturnOptions}
        orderId="ord_abc123xyz"
      />
    )
    const optionButtons = screen.getAllByTestId(/return-option-/)
    expect(optionButtons).toHaveLength(3)
  })
})
