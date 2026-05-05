'use client'

import React, { type FC } from 'react'

interface LineItem {
  id: string
  name: string
  quantity: number
  unitPrice?: number | null
  totalPrice?: number | null
}

interface Props {
  prNumber?: string
  lineItems?: LineItem[]
  items?: LineItem[]  // Support both prop names
  total?: number
  status?: string
}

const PurchaseRequestDraft: FC<Props> = ({ prNumber, lineItems, items: itemsProp, total, status }) => {
  const items = lineItems ?? itemsProp ?? []
  const safeTotal = total ?? 0
  
  return (
    <div data-testid="pr-draft" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Purchase Request Draft</h3>
        <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded">
          {prNumber ?? 'New PR'}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-gray-500 text-center py-4">No items added yet</div>
      ) : (
        <div className="space-y-2 mb-4">
          {items.map(item => (
            <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100">
              <div>
                <div className="text-sm font-medium text-gray-900">{item.name}</div>
                <div className="text-xs text-gray-500">Qty: {item.quantity ?? 0} × ₹{item.unitPrice != null ? Number(item.unitPrice).toLocaleString('en-IN') : 'N/A'}</div>
              </div>
              <div className="text-sm font-semibold text-indigo-600">
                ₹{item.totalPrice != null ? Number(item.totalPrice).toLocaleString('en-IN') : 'N/A'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
        <span className="text-gray-600 font-medium">Total</span>
        <span className="text-xl font-bold text-indigo-600">₹{total.toLocaleString('en-IN')}</span>
      </div>

      <button 
        data-testid="submit-for-approval-btn"
        className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
      >
        Submit for Manager Approval
      </button>

      <p className="text-xs text-gray-500 text-center mt-2">
        Your manager will be notified immediately. Typical approval time: 24–48 hours.
      </p>
    </div>
  )
}

export default PurchaseRequestDraft