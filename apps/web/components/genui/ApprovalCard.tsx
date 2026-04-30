'use client'

import React, { useState } from 'react'
import type { FC } from 'react'
import type { ApprovalCardProps } from '@/lib/ui-event-types'

const urgencyColors: Record<string, string> = {
  LOW: 'border-gray-300 text-gray-500',
  NORMAL: 'border-gray-400 text-gray-700',
  HIGH: 'border-amber-400 text-amber-600',
  CRITICAL: 'border-red-500 text-red-600',
}

const ApprovalCard: FC<ApprovalCardProps> = ({
  prId, prNumber, requestorName, totalAmount, lineItems, justification, urgency, threadId
}) => {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(false)

  const handleDecide = async (d: 'APPROVED' | 'REJECTED') => {
    setLoading(true)
    // In real implementation, this would call the approval API
    console.log('Approving:', { prId, decision: d, comments })
    setDecision(d)
    setLoading(false)
  }

  if (decision) {
    return (
      <div data-testid="approval-decided" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{decision === 'APPROVED' ? '✅' : '❌'}</span>
          <span className="font-medium">{prNumber} {decision.toLowerCase()}</span>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="approval-card" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-semibold text-gray-900">{prNumber}</div>
          <div className="text-sm text-gray-500">from {requestorName}</div>
        </div>
        <div className={`border px-2 py-1 rounded text-xs font-medium ${urgencyColors[urgency]}`}>
          {urgency}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs font-medium text-gray-500 mb-1">Justification</div>
        <div className="text-sm text-gray-700">{justification}</div>
      </div>

      <div className="mb-3">
        <div className="text-xs font-medium text-gray-500 mb-1">Items ({lineItems.length})</div>
        {lineItems.map((item, i) => (
          <div key={i} className="flex justify-between text-sm py-1">
            <span className="text-gray-700">{item.quantity} × {item.name}</span>
            <span className="text-gray-900">₹{item.totalPrice.toLocaleString('en-IN')}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-gray-200 mb-3">
        <span className="font-medium text-gray-600">Total</span>
        <span className="text-lg font-bold text-indigo-600">₹{totalAmount.toLocaleString('en-IN')}</span>
      </div>

      {!threadId ? (
        <div className="text-center text-gray-500 text-sm py-2">
          ⏳ Waiting for employee to submit…
        </div>
      ) : (
        <>
          <textarea
            data-testid="approval-comments"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm mb-3"
            placeholder="Add a comment (optional)"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <button
              data-testid="reject-pr-btn"
              onClick={() => handleDecide('REJECTED')}
              disabled={loading}
              className="flex-1 border border-red-300 text-red-600 py-2 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50"
            >
              ✕ Reject
            </button>
            <button
              data-testid="approve-pr-btn"
              onClick={() => handleDecide('APPROVED')}
              disabled={loading}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            >
              ✓ Approve
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default ApprovalCard