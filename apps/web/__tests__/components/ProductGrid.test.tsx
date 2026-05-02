import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductGrid from '@/components/genui/ProductGrid'

const mockProducts = [
  { id: 1, name: 'Sony WH-1000XM5', price: 26990, stock: 5, category: 'headphones', brand: 'Sony', rating: 4.5 },
  { id: 2, name: 'JBL Tune 760', price: 5999, stock: 0, category: 'headphones', brand: 'JBL' },
]

describe('ProductGrid', () => {
  it('renders product cards', () => {
    render(<ProductGrid products={mockProducts} />)
    expect(screen.getByTestId('product-grid')).toBeInTheDocument()
    expect(screen.getAllByTestId('product-card')).toHaveLength(2)
  })

  it('shows ₹ price in INR format', () => {
    render(<ProductGrid products={mockProducts} />)
    expect(screen.getAllByTestId('product-price')[0].textContent).toContain('₹')
  })

  it('disables Add to Cart for out-of-stock', () => {
    render(<ProductGrid products={mockProducts} />)
    const buttons = screen.getAllByTestId('add-to-cart-button')
    expect(buttons[1]).toBeDisabled()
  })

  it('shows empty state when no products', () => {
    render(<ProductGrid products={[]} />)
    expect(screen.getByTestId('product-grid-empty')).toBeInTheDocument()
  })

  it('shows loading skeleton', () => {
    render(<ProductGrid products={[]} loading />)
    expect(screen.getByTestId('product-grid-loading')).toBeInTheDocument()
  })
})
