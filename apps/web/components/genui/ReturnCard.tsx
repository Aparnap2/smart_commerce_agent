'use client'

import React, { useState, type FC } from 'react'

type ReturnOption = {
  type: 'refund' | 'exchange' | 'store_credit'
  label: string
  description: string
  amount?: number
}

type Props = {
  eligible?: boolean
  options?: ReturnOption[]
  orderId?: string
  loading?: boolean
  onSelect?: (type: string) => void
}

const ReturnCard: FC<Props> = ({ eligible, options = [], orderId, loading, onSelect }) => {
  const [selected, setSelected] = useState<string | null>(null)

  if (loading) {
    return (
      <div data-testid="return-card-loading" className="p-4 space-y-3">
        <div className="animate-pulse bg-gray-100 rounded-lg h-32" />
      </div>
    )
  }

  if (!eligible) {
    return (
      <div data-testid="return-card-ineligible"
        className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
        This order is not eligible for return.
        Returns must be initiated within 7 days of delivery.
      </div>
    )
  }

  return (
    <div data-testid="return-card" className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Return Order #{orderId?.slice(-8)}</h3>
      <p className="text-sm text-gray-600">Choose your preferred resolution:</p>

      <div className="space-y-2">
        {options.map(opt => (
          <button
            key={opt.type}
            data-testid={`return-option-${opt.type}`}
            onClick={() => {
              setSelected(opt.type)
              onSelect?.(opt.type)
            }}
            className={`w-full text-left p-3 rounded-lg border transition-colors
              ${selected === opt.type
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-indigo-300'}`}>
            <div className="font-medium text-sm text-gray-900">
              {opt.label}
              {opt.type === 'store_credit' && opt.amount && (
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">
                  +₹{opt.amount} bonus
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ReturnCard
