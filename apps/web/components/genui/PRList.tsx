'use client'

import React, { type FC } from 'react'

interface PRItem {
  id?: string
  prNumber?: string
  status?: string
  total?: number
  totalAmount?: number
  department?: string
  requestedBy?: string
  createdAt?: string
}

interface Props {
  requests?: PRItem[]
  loading?: boolean
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-amber-100 text-amber-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  ORDERED: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-green-100 text-green-700',
  DISPUTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
}

const PRList: FC<Props> = ({ requests, loading }) => {
  const safeRequests = requests ?? []

  if (loading) {
    return (
      <div data-testid="pr-list-loading" className="p-4">
        <div className="animate-pulse bg-gray-100 h-16 rounded-lg mb-2" />
        <div className="animate-pulse bg-gray-100 h-16 rounded-lg mb-2" />
      </div>
    )
  }

  if (!safeRequests.length) {
    return (
      <div data-testid="pr-list-empty" className="p-4 text-center text-gray-500">
        No purchase requests found.
      </div>
    )
  }

  return (
    <div data-testid="pr-list" className="space-y-3">
      {safeRequests.map(pr => {
        const safeStatus = pr.status ?? 'UNKNOWN'
        const safeTotal = pr.total ?? pr.totalAmount ?? 0
        return (
          <div key={pr.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-semibold text-gray-900">#{pr.prNumber ?? 'N/A'}</h4>
                <p className="text-xs text-gray-500">
                  {pr.requestedBy ?? 'Unknown'} • {pr.department ?? 'N/A'}
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[safeStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                {safeStatus}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-500">
                {pr.createdAt ? new Date(pr.createdAt).toLocaleDateString() : ''}
              </span>
              <span className="font-semibold text-indigo-600">
                ₹{safeTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default PRList