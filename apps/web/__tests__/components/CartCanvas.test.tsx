import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CartCanvas from '@/components/genui/CartCanvas'

const mockCartItems = [
  {
    id: 'item_1',
    productId: 'prod_1',
    name: 'Sony WH-1000XM5 Headphones',
    price: 26990,
    quantity: 1,
    image: '/images/headphones.jpg',
  },
  {
    id: 'item_2',
    productId: 'prod_2',
    name: 'USB-C Cable',
    price: 599,
    quantity: 2,
    originalPrice: 799,
  },
]

describe('CartCanvas', () => {
  it('renders cart canvas with items', () => {
    render(<CartCanvas items={mockCartItems} />)
    expect(screen.getByTestId('cart-canvas')).toBeInTheDocument()
  })

  it('shows empty state when cart is empty', () => {
    render(<CartCanvas items={[]} />)
    expect(screen.getByTestId('cart-canvas-empty')).toBeInTheDocument()
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument()
  })

  it('displays cart header with item count', () => {
    render(<CartCanvas items={mockCartItems} />)
    expect(screen.getByTestId('cart-header')).toHaveTextContent('Your Cart (2 items)')
  })

  it('shows cart items with names and prices', () => {
    render(<CartCanvas items={mockCartItems} />)
    expect(screen.getByTestId('cart-item-item_1')).toBeInTheDocument()
    expect(screen.getByTestId('cart-item-name-item_1')).toHaveTextContent('Sony WH-1000XM5 Headphones')
    expect(screen.getByTestId('cart-item-price-item_1')).toHaveTextContent('$26990.00')
  })

  it('displays quantity controls for each item', () => {
    render(<CartCanvas items={mockCartItems} />)
    expect(screen.getByTestId('cart-item-quantity-item_1')).toHaveTextContent('1')
    expect(screen.getByTestId('cart-item-quantity-item_2')).toHaveTextContent('2')
    expect(screen.getByTestId('cart-item-increment-item_1')).toBeInTheDocument()
    expect(screen.getByTestId('cart-item-decrement-item_1')).toBeInTheDocument()
  })

  it('shows remove button for each item', () => {
    render(<CartCanvas items={mockCartItems} />)
    expect(screen.getByTestId('cart-item-remove-item_1')).toBeInTheDocument()
    expect(screen.getByTestId('cart-item-remove-item_2')).toBeInTheDocument()
  })

  it('displays price reduction for discounted items', () => {
    render(<CartCanvas items={mockCartItems} />)
    expect(screen.getByTestId('cart-item-price-item_2')).toHaveTextContent('$599.00')
  })

  it('shows coupon code section', () => {
    render(<CartCanvas items={mockCartItems} />)
    expect(screen.getByTestId('cart-coupon-section')).toBeInTheDocument()
    expect(screen.getByTestId('cart-coupon-input')).toBeInTheDocument()
    expect(screen.getByTestId('cart-coupon-apply')).toBeInTheDocument()
  })

  it('displays price breakdown with subtotal and total', () => {
    render(<CartCanvas items={mockCartItems} />)
    expect(screen.getByTestId('cart-price-breakdown')).toBeInTheDocument()
    expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('$28188.00')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('$28188.00')
  })

  it('shows checkout button with total amount', () => {
    render(<CartCanvas items={mockCartItems} />)
    expect(screen.getByTestId('cart-checkout-section')).toBeInTheDocument()
    expect(screen.getByTestId('cart-checkout-button')).toHaveTextContent('Checkout - $28188.00')
  })

  it('calls onQuantityChange when increment button clicked', () => {
    const onQuantityChange = vi.fn()
    render(<CartCanvas items={mockCartItems} onQuantityChange={onQuantityChange} />)
    fireEvent.click(screen.getByTestId('cart-item-increment-item_1'))
    expect(onQuantityChange).toHaveBeenCalledWith('item_1', 2)
  })

  it('calls onQuantityChange when decrement button clicked', () => {
    const onQuantityChange = vi.fn()
    const itemsWithHigherQty = mockCartItems.map(item => ({ ...item, quantity: 3 }))
    render(<CartCanvas items={itemsWithHigherQty} onQuantityChange={onQuantityChange} />)
    fireEvent.click(screen.getByTestId('cart-item-decrement-item_1'))
    expect(onQuantityChange).toHaveBeenCalledWith('item_1', 2)
  })

  it('calls onRemove when remove button clicked', () => {
    const onRemove = vi.fn()
    render(<CartCanvas items={mockCartItems} onRemove={onRemove} />)
    fireEvent.click(screen.getByTestId('cart-item-remove-item_1'))
    setTimeout(() => {
      expect(onRemove).toHaveBeenCalledWith('item_1')
    }, 350)
  })

  it('calls onCheckout when checkout button clicked', () => {
    const onCheckout = vi.fn()
    render(<CartCanvas items={mockCartItems} onCheckout={onCheckout} />)
    fireEvent.click(screen.getByTestId('cart-checkout-button'))
    expect(onCheckout).toHaveBeenCalledTimes(1)
  })

  it('applies coupon code SAVE10 successfully', async () => {
    render(<CartCanvas items={mockCartItems} />)
    const couponInput = screen.getByTestId('cart-coupon-input')
    const applyButton = screen.getByTestId('cart-coupon-apply')

    fireEvent.change(couponInput, { target: { value: 'SAVE10' } })
    fireEvent.click(applyButton)

    await screen.findByText('Coupon "SAVE10" applied! (10% off)')
  })

  it('shows error for invalid coupon code', async () => {
    render(<CartCanvas items={mockCartItems} />)
    const couponInput = screen.getByTestId('cart-coupon-input')
    const applyButton = screen.getByTestId('cart-coupon-apply')

    fireEvent.change(couponInput, { target: { value: 'INVALID' } })
    fireEvent.click(applyButton)

    await screen.findByText('Invalid coupon code')
  })

  it('disables decrement button when quantity is 1', () => {
    render(<CartCanvas items={mockCartItems} />)
    expect(screen.getByTestId('cart-item-decrement-item_1')).toBeDisabled()
  })

  it('shows loading state on checkout button when isLoading is true', () => {
    render(<CartCanvas items={mockCartItems} isLoading />)
    expect(screen.getByTestId('cart-checkout-button')).toHaveTextContent('Processing...')
  })

  it('disables checkout button when isLoading is true', () => {
    render(<CartCanvas items={mockCartItems} isLoading />)
    expect(screen.getByTestId('cart-checkout-button')).toBeDisabled()
  })
})
