// ApprovalCard - GenUI component for PR approval workflow
// Uses onSubmitDecision callback for agent integration (replaces direct fetch)

import React from 'react'
import type { FC } from 'react'

interface LineItem {
  id: string
  name: string
  quantity: number
  totalPrice?: number | null
}

interface Props {
  // Main PR data object
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
  // Direct B2B prop interface for easier usage
  prId?: string
  prNumber?: string
  requestorName?: string
  totalAmount?: number
  lineItems?: LineItem[]
  justification?: string
  urgency?: string
  threadId?: string
  // Callbacks
  onApprove?: () => void
  onReject?: () => void
  // Agent submission callback (replaces direct fetch)
  onSubmitDecision?: (decision: 'APPROVED' | 'REJECTED', prNumber: string, total: number, comments: string) => Promise<void>
}

const urgencyColors: Record<string, string> = {
  LOW: 'border-gray-300 text-gray-500',
  NORMAL: 'border-gray-400 text-gray-700',
  HIGH: 'border-amber-400 text-amber-600',
  CRITICAL: 'border-red-500 text-red-600',
}

const ApprovalCard: FC<Props> = ({ 
  pr, 
  onApprove, 
  onReject, 
  prId, 
  prNumber, 
  requestorName, 
  totalAmount, 
  lineItems, 
  justification, 
  urgency, 
  threadId,
  onSubmitDecision 
}) => {
  const [decision, setDecision] = React.useState<'APPROVED' | 'REJECTED' | null>(null)
  const [comments, setComments] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  
  // Support both pr object and individual props
  const safePr = pr ?? {}
  const safeId = safePr.id ?? prId ?? ''
  const safePrNumber = safePr.prNumber ?? prNumber ?? 'Pending'
  const safeRequestor = safePr.requestedBy ?? requestorName ?? 'Unknown'
  const safeDepartment = safePr.department ?? 'N/A'
  const safeTotal = safePr.total ?? totalAmount ?? 0
  const safeItems = safePr.lineItems ?? lineItems ?? []
  const safeUrgency = safePr.status ?? urgency ?? 'NORMAL'

  const handleDecide = async (d: 'APPROVED' | 'REJECTED') => {
    setLoading(true)
    console.log(`Decision: ${d}`, { prId: safeId, comments, threadId })
    
    try {
      // Use onSubmitDecision callback for agent integration
      // This REPLACES direct fetch() calls - agent communication via callback
      if (onSubmitDecision) {
        await onSubmitDecision(d, safePrNumber, safeTotal, comments)
      }
      
      setDecision(d)
      if (d === 'APPROVED') onApprove?.()
      else onReject?.()
    } catch (error) {
      console.error('Failed to submit decision:', error)
    } finally {
      setLoading(false)
    }
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
            Purchase Request #{safePrNumber}
          </h3>
          <p className="text-sm text-gray-500">
            Requested by {safeRequestor} • {safeDepartment}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${urgencyColors[safeUrgency] ?? urgencyColors.NORMAL}`}>
          {safeUrgency}
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
          data-testid="approve-pr-btn"
          onClick={() => handleDecide('APPROVED')}
          disabled={loading}
          className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          data-testid="reject-pr-btn"
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