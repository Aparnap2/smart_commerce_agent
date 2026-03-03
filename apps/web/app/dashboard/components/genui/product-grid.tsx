'use client'
import React from 'react'
import { ProductCard } from './product-card'
import type { Product } from '@smart-commerce/types'

interface Props {
  products:    Product[]
  onAddToCart?: (productId: string, quantity: number) => void
}

export function ProductGrid({ products, onAddToCart }: Props) {
  if (!products.length) {
    return (
      <div
        data-testid="empty-state"
        className="flex flex-col items-center justify-center py-12 text-gray-400"
      >
        <span className="text-4xl mb-3">🔍</span>
        <p className="text-sm">No products found</p>
        <p className="text-xs mt-2">Try adjusting your search or filters</p>
      </div>
    )
  }
  return (
    <div
      data-testid="product-grid"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          showQuantitySelector
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  )
}
