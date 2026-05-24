// CatalogGrid - GenUI component for displaying catalog items
// Accepts both `items` and `products` prop aliases for agent SSE compatibility.
// Every edge case is handled: null/undefined props, loading, empty, error,
// long names, missing prices, missing vendors, out-of-stock items.

'use client'

import React from 'react'
import type { FC } from 'react'
import { safeString, safePrice, safeArray, safeNumber } from '@/lib/genui/safe-render'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CatalogItem {
  id: string
  name: string
  vendor?: string | null
  unitPrice?: number | null
  price?: number | null
  leadDays?: number | null
  category?: string | null
  inStock?: boolean
  description?: string | null
  imageUrl?: string | null
}

export interface CatalogGridProps {
  items?: CatalogItem[]
  products?: CatalogItem[]
  loading?: boolean
  error?: string | null
  onAddToPR?: (item: CatalogItem) => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OutOfStockBadge = () => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 ring-1 ring-gray-200">
    Out of Stock
  </span>
)

const InStockBadge = () => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
    In Stock
  </span>
)

const ImagePlaceholder = ({ name }: { name: string }) => (
  <div className="w-full h-36 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg flex items-center justify-center">
    <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
      <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <div data-testid="catalog-error" className="flex flex-col items-center justify-center py-12 text-center px-4">
    <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
      <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <p className="text-gray-700 font-medium">Something went wrong</p>
    <p className="text-gray-400 text-sm mt-1 max-w-xs">{message}</p>
  </div>
)

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

const LoadingSkeleton = () => (
  <div data-testid="catalog-skeleton" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4" role="status" aria-label="Loading products">
    {[1, 2, 3, 4, 5, 6].map(i => (
      <div key={i} className="animate-pulse bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-36 bg-gray-100" />
        <div className="p-4 space-y-3">
          <div className="h-4 bg-gray-100 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="flex justify-between pt-2">
            <div className="h-5 bg-gray-100 rounded w-1/3" />
            <div className="h-4 bg-gray-100 rounded w-1/4" />
          </div>
          <div className="h-9 bg-gray-100 rounded-lg w-full mt-2" />
        </div>
      </div>
    ))}
  </div>
)

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

const EmptyState = () => (
  <div data-testid="catalog-empty" className="flex flex-col items-center justify-center py-16 text-center px-4">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <p className="text-gray-500 font-medium">No products found</p>
    <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
  </div>
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CatalogGrid: FC<CatalogGridProps> = ({ items, products, loading, error, onAddToPR }) => {
  // Merge items from either prop alias
  const rawItems = safeArray<CatalogItem>(items ?? products)

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  // ── Error ───────────────────────────────────────────────────────────
  if (error) return <ErrorState message={error} />

  // ── Empty ───────────────────────────────────────────────────────────
  if (rawItems.length === 0) return <EmptyState />

  // ── Grid ────────────────────────────────────────────────────────────
  return (
    <div data-testid="catalog-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4" role="list">
      {rawItems.map((item, index) => {
        const isOutOfStock = item.inStock === false
        const itemPrice = safeNumber(safeNumber(item.unitPrice) || safeNumber(item.price))
        const itemId = safeString(item.id, `item-${index}`)

        return (
          <div
            key={itemId}
            role="listitem"
            data-testid="catalog-item"
            data-out-of-stock={isOutOfStock ? 'true' : 'false'}
            className={`
              group relative bg-white rounded-xl border overflow-hidden
              transition-all duration-200
              ${isOutOfStock
                ? 'border-gray-200 opacity-70 hover:opacity-90'
                : 'border-gray-200 hover:border-indigo-200 hover:shadow-lg'
              }
            `}
          >
            {/* Image placeholder */}
            <ImagePlaceholder name={safeString(item.name, 'Product')} />

            {/* Card body */}
            <div className="p-4">
              {/* Header row: name + stock badge */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3
                  className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors"
                  title={safeString(item.name)}
                >
                  {safeString(item.name, 'Unnamed Product')}
                </h3>
                {isOutOfStock ? <OutOfStockBadge /> : <InStockBadge />}
              </div>

              {/* Vendor */}
              <p className="text-xs text-gray-500 truncate mb-1">
                {safeString(item.vendor)}
              </p>

              {/* Category chip */}
              {item.category && (
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 mb-2">
                  {item.category}
                </span>
              )}

              {/* Price row */}
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-xl font-bold text-gray-900">
                  {safePrice(itemPrice > 0 ? itemPrice * 100 : null)}
                </span>
                {item.leadDays != null && (
                  <span className="text-[11px] text-gray-400">
                    {item.leadDays > 0 ? `${item.leadDays} day${item.leadDays > 1 ? 's' : ''}` : 'Today'}
                  </span>
                )}
              </div>

              {/* Description */}
              {safeString(item.description, '') && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{item.description}</p>
              )}

              {/* Add to PR button */}
              <button
                aria-label={isOutOfStock ? `Unavailable: ${safeString(item.name, 'Product')}` : `Add ${safeString(item.name, 'Product')} to purchase request`}
                data-testid={`add-to-pr-btn-${itemId}`}
                onClick={() => onAddToPR?.(item)}
                disabled={isOutOfStock}
                className={`
                  mt-3 w-full py-2.5 px-4 rounded-lg font-medium text-sm
                  transition-colors flex items-center justify-center gap-2
                  ${isOutOfStock
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white active:bg-indigo-800'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {isOutOfStock ? 'Unavailable' : 'Add to PR'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CatalogGrid
