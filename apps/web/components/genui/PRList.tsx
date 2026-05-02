'use client'

import React, { type FC } from 'react'
import type { PRListProps } from '@/lib/ui-event-types'

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ORDERED: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-green-100 text-green-700',
  DISPUTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
}

const PRList: FC<PRListProps> = ({ purchaseRequests, loading }) => {
  if (loading) {
    return (
      <div data-testid="pr-list-loading" className="p-4">
        <div className="animate-pulse bg-gray-100 h-16 rounded-lg mb-2" />
        <div className="animate-pulse bg-gray-100 h-16 rounded-lg mb-2" />
      </div>
    )
  }

  if (!purchaseRequests?.length) {
    return (
      <div data-testid="pr-list-empty" className="p-4 text-center text-gray-500">
        No purchase requests found.
      </div>
    )
  }

  return (
    <div data-testid="pr-list" className="space-y-2 p-4">
      {purchaseRequests.map(pr => (
        <div key={pr.id} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-semibold text-gray-900">{pr.prNumber}</div>
              <div className="text-xs text-gray-500">
                {pr.requestorName && `from ${pr.requestorName} • `}
                {new Date(pr.createdAt).toLocaleDateString('en-IN')}
              </div>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded ${statusColors[pr.status] || 'bg-gray-100'}`}>
              {pr.status}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{pr.itemCount || 0} items</span>
            <span className="font-semibold text-indigo-600">₹{pr.totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default PRList