// CatalogGrid - GenUI component for displaying catalog items
// Uses onAddToPR callback for agent integration (replaces direct fetch)

import React from 'react'
import type { FC } from 'react'

interface CatalogItem {
  id: string
  name: string
  vendor?: string
  unitPrice?: number | null
  leadDays?: number
  category?: string
  inStock?: boolean
}

interface Props {
  items?: CatalogItem[]
  loading?: boolean
  onAddToPR?: (item: CatalogItem) => Promise<void>
}

const statusBadge = (inStock: boolean) => inStock 
  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">In Stock</span>
  : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Out of Stock</span>

const CatalogGrid: FC<Props> = ({ items, loading, onAddToPR }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-56" />
        ))}
      </div>
    )
  }

  const safeItems = items ?? []
  
  if (!safeItems.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">No items found</p>
        <p className="text-gray-400 text-sm mt-1">Try adjusting your search</p>
      </div>
    )
  }

  return (
    <div data-testid="catalog-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {safeItems.map(item => (
        <div 
          key={item.id} 
          data-testid="catalog-item"
          className="group relative bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {item.name}
              </h3>
              <p className="text-sm text-gray-500">{item.vendor ?? 'Unknown Vendor'}</p>
            </div>
            {statusBadge(item.inStock !== false)}
          </div>

          <div className="flex items-baseline justify-between mt-4">
            <div>
              <span className="text-2xl font-bold text-gray-900">
                ₹{item.unitPrice != null ? Number(item.unitPrice).toLocaleString('en-IN') : 'N/A'}
              </span>
              {item.category && (
                <span className="ml-2 text-xs text-gray-400">{item.category}</span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              {item.leadDays ? `${item.leadDays} days` : 'N/A'}
            </span>
          </div>

          <button 
            data-testid={`add-to-pr-btn-${item.id}`}
            onClick={() => onAddToPR?.(item)}
            className="mt-4 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add to PR
          </button>
        </div>
      ))}
    </div>
  )
}

export default CatalogGrid