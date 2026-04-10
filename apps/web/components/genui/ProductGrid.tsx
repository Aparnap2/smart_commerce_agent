'use client'

import React, { type FC } from 'react'

type Product = {
  id: number
  name: string
  price: number
  stock: number
  category: string
  brand?: string | null
  rating?: number | null
  description?: string | null
}

type Props = {
  products: Product[]
  loading?: boolean
  onAddToCart?: (productId: number) => void
}

const ProductGrid: FC<Props> = ({ products, loading, onAddToCart }) => {
  if (loading) {
    return (
      <div data-testid="product-grid-loading" className="grid grid-cols-2 gap-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-48" />
        ))}
      </div>
    )
  }

  if (!products?.length) {
    return (
      <div data-testid="product-grid-empty" className="p-4 text-center text-gray-500">
        No products found. Try a different search.
      </div>
    )
  }

  return (
    <div data-testid="product-grid" className="grid grid-cols-2 gap-3 p-4">
      {products.map(product => (
        <div key={product.id} data-testid="product-card"
          className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">

          <div className="text-sm font-semibold text-gray-900 leading-tight">
            {product.name}
          </div>

          {product.brand && (
            <div className="text-xs text-gray-500">{product.brand}</div>
          )}

          <div data-testid="product-price" className="text-base font-bold text-indigo-600">
            ₹{product.price.toLocaleString('en-IN')}
          </div>

          {product.rating && (
            <div className="text-xs text-amber-500">
              {'★'.repeat(Math.round(product.rating))} ({product.rating.toFixed(1)})
            </div>
          )}

          <button
            data-testid="add-to-cart-button"
            onClick={() => onAddToCart?.(product.id)}
            disabled={product.stock === 0}
            className="mt-auto w-full py-1.5 px-3 rounded-lg text-sm font-medium
              bg-indigo-600 text-white disabled:bg-gray-200 disabled:text-gray-400
              hover:bg-indigo-700 transition-colors">
            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>

        </div>
      ))}
    </div>
  )
}

export default ProductGrid
