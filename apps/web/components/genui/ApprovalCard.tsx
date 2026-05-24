// ApprovalCard - GenUI component for PR approval workflow
// Uses onSubmitDecision callback for agent integration (replaces direct fetch).
// Handles: null/undefined props, loading state, empty items, long names, missing data.

'use client'

import React from 'react'
import type { FC } from 'react'
import {
  safeString,
  safePrice,
  safeArray,
  safeNumber,
  safeDate,
} from '@/lib/genui/safe-render'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineItem {
  id?: string
  name?: string
  quantity?: number
  totalPrice?: number | null
}

interface PRObject {
  id?: string
  prNumber?: string
  status?: string
  requestedBy?: string | null
  department?: string
  total?: number
  lineItems?: LineItem[]
  createdAt?: string
}

export interface ApprovalCardProps {
  /** Main PR data object */
  pr?: PRObject
  /** Direct prop interface for simpler usage */
  prId?: string
  prNumber?: string
  requestorName?: string
  totalAmount?: number
  lineItems?: LineItem[]
  justification?: string
  urgency?: string
  threadId?: string
  /** Loading state */
  loading?: boolean
  /** Error message */
  error?: string | null
  /** Callbacks */
  onApprove?: () => void
  onReject?: () => void
  /** Agent submission callback (replaces direct fetch) */
  onSubmitDecision?: (decision: 'APPROVED' | 'REJECTED', prNumber: string, total: number, comments: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Urgency config
// ---------------------------------------------------------------------------

const URGENCY_STYLES: Record<string, string> = {
  LOW:      'border-gray-300 text-gray-500 bg-gray-50',
  NORMAL:   'border-gray-400 text-gray-700 bg-gray-50',
  HIGH:     'border-amber-400 text-amber-600 bg-amber-50',
  CRITICAL: 'border-red-500 text-red-600 bg-red-50',
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

const LoadingSkeleton = () => (
  <div data-testid="approval-card-skeleton" className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm animate-pulse" role="status" aria-label="Loading approval request">
    <div className="flex justify-between mb-4">
      <div className="space-y-2">
        <div className="h-5 bg-gray-100 rounded w-44" />
        <div className="h-3 bg-gray-100 rounded w-32" />
      </div>
      <div className="h-6 bg-gray-100 rounded-full w-16" />
    </div>
    <div className="space-y-2 mb-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex justify-between">
          <div className="h-4 bg-gray-100 rounded w-40" />
          <div className="h-4 bg-gray-100 rounded w-16" />
        </div>
      ))}
    </div>
    <div className="h-6 bg-gray-100 rounded w-24 mb-4" />
    <div className="h-16 bg-gray-100 rounded mb-3" />
    <div className="flex gap-2">
      <div className="flex-1 h-10 bg-gray-100 rounded-lg" />
      <div className="flex-1 h-10 bg-gray-100 rounded-lg" />
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <div data-testid="approval-card-error" className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
    <p className="text-red-700 font-medium text-sm">Failed to load approval request</p>
    <p className="text-red-500 text-xs mt-1">{message}</p>
  </div>
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ApprovalCard: FC<ApprovalCardProps> = ({
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
  onSubmitDecision,
  loading,
  error,
}) => {
  const [decision, setDecision] = React.useState<'APPROVED' | 'REJECTED' | null>(null)
  const [comments, setComments] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  // Support both `pr` object and individual props
  const safePr = pr ?? ({} as PRObject)
  const safeId = safeString(safePr.id ?? prId)
  const safePrNumber = safeString(safePr.prNumber ?? prNumber, 'PR-000')
  const safeRequestor = safeString(safePr.requestedBy ?? requestorName, 'Unknown')
  const safeDepartment = safeString(safePr.department, '—')
  const safeTotal = safeNumber(safePr.total ?? totalAmount, 0)
  const safeItems = safeArray<LineItem>(safePr.lineItems ?? lineItems)
  const safeJustification = safeString(justification)
  const safeUrgencyKey = safeString(safePr.status ?? urgency, 'NORMAL').toUpperCase()
  const safeUrgency = URGENCY_STYLES[safeUrgencyKey] || URGENCY_STYLES.NORMAL

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  // ── Error ───────────────────────────────────────────────────────────
  if (error) return <ErrorState message={error} />

  // ── Decision made (post-submission) ─────────────────────────────────
  if (decision) {
    return (
      <div data-testid="approval-card-done" className="bg-green-50 border border-green-200 rounded-xl p-4 sm:p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-green-800 font-medium">
          {decision === 'APPROVED' ? 'Purchase request approved ✓' : 'Purchase request rejected ✗'}
        </p>
      </div>
    )
  }

  // ── Active approval card ────────────────────────────────────────────
  const handleDecide = async (d: 'APPROVED' | 'REJECTED') => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      if (onSubmitDecision) {
        await onSubmitDecision(d, safePrNumber, safeTotal, comments)
      }
      // Also call legacy callbacks
      setDecision(d)
      if (d === 'APPROVED') onApprove?.()
      else onReject?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit decision'
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div data-testid="approval-card" className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
      {/* Header */}
      <div className="flex justify-between items-start gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
            Purchase Request #{safePrNumber}
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 truncate">
            {safeRequestor}{safeDepartment !== '—' ? ` • ${safeDepartment}` : ''}
          </p>
          {safePr.createdAt && safeDate(safePr.createdAt) !== '—' && (
            <p className="text-xs text-gray-400 mt-0.5">{safeDate(safePr.createdAt)}</p>
          )}
        </div>
        <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium border ${safeUrgency}`}>
          {safeUrgencyKey}
        </span>
      </div>

      {/* Justification */}
      {safeJustification && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-xs text-gray-500 font-medium mb-0.5">Justification</p>
          <p className="text-sm text-gray-700">{safeJustification}</p>
        </div>
      )}

      {/* Line items */}
      {safeItems.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</p>
          <div className="divide-y divide-gray-100">
              {safeItems.map((item, index) => (
              <div key={safeString(item.id, `li-${index}`)} className="flex justify-between text-sm py-1.5 gap-2">
                <span className="text-gray-700 truncate">
                  {safeString(item.name, 'Item')}
                  {safeNumber(item.quantity, 0) > 0 && <span className="text-gray-400 ml-1">(×{item.quantity})</span>}
                </span>
                <span className="text-gray-900 font-medium shrink-0">
                  {safePrice(safeNumber(item.totalPrice, 0) * 100)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Total */}
      <div className="border-t border-gray-100 pt-3 mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Total</span>
        <span className="text-lg font-bold text-indigo-600">{safePrice(safeTotal)}</span>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600" role="alert">
          {submitError}
        </div>
      )}

      {/* Comments */}
      <textarea
        className="w-full border border-gray-200 rounded-lg p-2.5 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        placeholder="Comments (optional)"
        rows={2}
        value={comments}
        onChange={(e) => setComments(e.target.value)}
        disabled={submitting}
        aria-label="Approval comments"
      />

      {/* Action buttons */}
      <div className="flex gap-2 sm:gap-3">
        <button
          data-testid="approve-pr-btn"
          onClick={() => handleDecide('APPROVED')}
          disabled={submitting}
          className="flex-1 min-h-[44px] bg-emerald-600 text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
        >
          {submitting ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span>Approve</span>
        </button>
        <button
          data-testid="reject-pr-btn"
          onClick={() => handleDecide('REJECTED')}
          disabled={submitting}
          className="flex-1 min-h-[44px] bg-red-600 text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Reject</span>
        </button>
      </div>

      {/* Thread ID for agent correlation */}
      {threadId && <p className="text-[10px] text-gray-300 text-center mt-2">Thread: {threadId}</p>}
    </div>
  )
}

export default ApprovalCard
