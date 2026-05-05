'use client'

import React, { type FC } from 'react'

export interface CatalogGridProps {
  items?: Array<{
    id: string
    name: string
    vendor?: string
    unitPrice?: number | null
    leadDays?: number
  }>
  loading?: boolean
}

const CatalogGrid: FC<CatalogGridProps> = ({ items, loading }) => {
  if (loading) {
    return (
      <div data-testid="catalog-grid-loading" className="grid grid-cols-2 gap-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-48" />
        ))}
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div data-testid="catalog-grid-empty" className="p-4 text-center text-gray-500">
        No items found. Try a different search.
      </div>
    )
  }

  return (
    <div data-testid="catalog-grid" className="grid grid-cols-2 gap-3 p-4">
      {items.map(item => (
        <div key={item.id} data-testid="catalog-item-card"
          className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">

          <div className="text-sm font-semibold text-gray-900 leading-tight">
            {item.name}
          </div>

          <div className="text-xs text-gray-500">Vendor: {item.vendor}</div>

          <div data-testid="item-price" className="text-base font-bold text-indigo-600">
            ₹{item.unitPrice != null ? Number(item.unitPrice).toLocaleString('en-IN') : 'N/A'}
          </div>

          <div className="text-xs text-gray-500">
            Lead time: {item.leadDays ?? 'N/A'} days
          </div>

          <button 
            data-testid="add-to-request-btn"
            className="mt-2 bg-indigo-600 text-white text-sm py-2 px-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Add to Request
          </button>
        </div>
      ))}
    </div>
  )
}

export default CatalogGrid