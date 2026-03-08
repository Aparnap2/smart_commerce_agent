// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { CartDrawer } from '../../../app/dashboard/components/genui/cart-drawer'
import { describe, it, expect, vi } from 'vitest'
import type { Cart, CartItem } from '@smart-commerce/types'

const makeCart = (overrides: Partial<Cart> = {}): Cart => ({
  id:         'cart-1',
  items: [
    {
      id:           'ci-1',
      productId:    'p-1',
      quantity:     2,
      priceAt:      999,
      product:      { id:'p-1', name:'Headphones', price:999, stock:10 },
    } as CartItem
  ],
  total:      1998,
  discount:   0,
  ...overrides,
})

describe('CartDrawer', () => {
  it('renders all cart items', () => {
    render(<CartDrawer cart={makeCart()} />)
    expect(screen.getByTestId('cart-drawer')).toBeTruthy()
    expect(screen.getByTestId('cart-item-p-1')).toBeTruthy()
  })

  it('shows price-changed-badge when priceChanged is true', () => {
    const cart = makeCart()
    cart.items[0].priceChanged = true
    render(<CartDrawer cart={cart} />)
    expect(screen.getByTestId('price-changed-badge-p-1')).toBeTruthy()
  })

  it('does not show price-changed-badge when priceChanged is false', () => {
    render(<CartDrawer cart={makeCart()} />)
    expect(screen.queryByTestId('price-changed-badge-p-1')).toBeNull()
  })

  it('total accounts for discount', () => {
    const cart = makeCart({ discount: 200 })
    render(<CartDrawer cart={cart} />)
    expect(screen.getByText('₹1,798')).toBeTruthy()
  })

  it('onClose fires when close button clicked', () => {
    const onClose = vi.fn()
    render(<CartDrawer cart={makeCart()} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close cart'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('checkout button fires onCheckout', () => {
    const onCheckout = vi.fn()
    render(<CartDrawer cart={makeCart()} onCheckout={onCheckout} />)
    fireEvent.click(screen.getByTestId('checkout-btn'))
    expect(onCheckout).toHaveBeenCalledOnce()
  })
})
