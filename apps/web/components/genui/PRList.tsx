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

const statusConfig: Record<string, { bg: string, text: string, label: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  PENDING_APPROVAL: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
  DISPUTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Disputed' },
}

const PRList: FC<Props> = ({ requests, loading }) => {
  const safeRequests = requests ?? []

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!safeRequests.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">No purchase requests</p>
        <p className="text-gray-400 text-sm mt-1">Create a new PR from the chat</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">PR #</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Requester</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {safeRequests.map(pr => {
            const safeStatus = pr.status ?? 'UNKNOWN'
            const config = statusConfig[safeStatus] || { bg: 'bg-gray-100', text: 'text-gray-700', label: safeStatus }
            const safeTotal = pr.total ?? pr.totalAmount ?? 0
            
            return (
              <tr key={pr.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium text-gray-900">#{pr.prNumber ?? 'N/A'}</span>
                  {pr.createdAt && (
                    <span className="ml-2 text-xs text-gray-400">
                      {new Date(pr.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{pr.requestedBy ?? 'Unknown'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{pr.department ?? 'N/A'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                    {config.label}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-semibold text-gray-900">₹{safeTotal.toLocaleString('en-IN')}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default PRList