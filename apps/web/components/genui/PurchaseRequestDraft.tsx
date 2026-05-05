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
  items?: LineItem[]
  total?: number
  status?: string
}

const PurchaseRequestDraft: FC<Props> = ({ prNumber, lineItems, items: itemsProp, total, status }) => {
  const items = lineItems ?? itemsProp ?? []
  const safeTotal = total ?? 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Purchase Request</h2>
          <p className="text-sm text-gray-500">{prNumber ?? 'Draft'}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          status === 'DRAFT' ? 'bg-gray-100 text-gray-700' :
          status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
          status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {status ?? 'DRAFT'}
        </span>
      </div>

      <div className="p-6">
        {items.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No items added</p>
            <p className="text-gray-400 text-sm mt-1">Search catalog to add items</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    {item.quantity ?? 0} × ₹{item.unitPrice != null ? Number(item.unitPrice).toLocaleString('en-IN') : '0'}
                  </p>
                </div>
                <span className="font-semibold text-gray-900">
                  ₹{item.totalPrice != null ? Number(item.totalPrice).toLocaleString('en-IN') : '0'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Total Amount</span>
        <span className="text-xl font-bold text-indigo-600">₹{safeTotal.toLocaleString('en-IN')}</span>
      </div>

      <div className="px-6 py-4 border-t border-gray-100">
        <button className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Submit for Approval
        </button>
        <p className="text-xs text-gray-500 text-center mt-2">
          Manager will be notified. Typically responds in 24-48 hours.
        </p>
      </div>
    </div>
  )
}

export default PurchaseRequestDraft