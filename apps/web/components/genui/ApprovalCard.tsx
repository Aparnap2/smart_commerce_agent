'use client'

import React, { useState } from 'react'
import type { FC } from 'react'

interface LineItem {
  id: string
  name: string
  quantity: number
  totalPrice?: number | null
}

interface Props {
  pr?: {
    id?: string
    prNumber?: string
    status?: string
    requestedBy?: string | null
    department?: string
    total?: number
    lineItems?: LineItem[]
    createdAt?: string
  }
  onApprove?: () => void
  onReject?: () => void
}

const urgencyColors: Record<string, string> = {
  LOW: 'border-gray-300 text-gray-500',
  NORMAL: 'border-gray-400 text-gray-700',
  HIGH: 'border-amber-400 text-amber-600',
  CRITICAL: 'border-red-500 text-red-600',
}

const ApprovalCard: FC<Props> = ({ pr, onApprove, onReject }) => {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(false)

  const safePr = pr ?? {}
  const safeTotal = safePr.total ?? 0
  const safeItems = safePr.lineItems ?? []
  const safeRequestor = safePr.requestedBy ?? 'Unknown'

  const handleDecide = async (d: 'APPROVED' | 'REJECTED') => {
    setLoading(true)
    console.log('Approving:', { prId: safePr.id, decision: d, comments })
    setDecision(d)
    setLoading(false)
    if (d === 'APPROVED') onApprove?.()
    else onReject?.()
  }

  if (decision) {
    return (
      <div data-testid="approval-card" className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-green-800 font-medium">
          {decision === 'APPROVED' ? '✓ Purchase request approved' : '✗ Purchase request rejected'}
        </p>
      </div>
    )
  }

  return (
    <div data-testid="approval-card" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Purchase Request #{safePr.prNumber ?? 'Pending'}
          </h3>
          <p className="text-sm text-gray-500">
            Requested by {safeRequestor} • {safePr.department ?? 'N/A'}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${urgencyColors[safePr.status ?? 'NORMAL']}`}>
          {safePr.status ?? 'PENDING'}
        </span>
      </div>

      {safeItems.length > 0 && (
        <div className="space-y-2 mb-4">
          {safeItems.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>{item.name} (×{item.quantity ?? 0})</span>
              <span className="text-gray-900">
                ₹{item.totalPrice != null ? Number(item.totalPrice).toLocaleString('en-IN') : '0'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-3 mb-4">
        <span className="text-lg font-bold text-indigo-600">
          ₹{safeTotal.toLocaleString('en-IN')}
        </span>
      </div>

      <textarea
        className="w-full border rounded-lg p-2 text-sm mb-3"
        placeholder="Comments (optional)"
        value={comments}
        onChange={(e) => setComments(e.target.value)}
      />

      <div className="flex gap-2">
        <button
          onClick={() => handleDecide('APPROVED')}
          disabled={loading}
          className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => handleDecide('REJECTED')}
          disabled={loading}
          className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  )
}

export default ApprovalCard