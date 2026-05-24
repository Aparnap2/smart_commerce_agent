'use client'

import React, { type FC } from 'react'
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

export interface PRLineItem {
  id: string
  name: string
  quantity?: number
  unitPrice?: number | null
  totalPrice?: number | null
}

export interface PRDraftProps {
  /** PR number / identifier */
  prNumber?: string
  /** Current workflow status */
  status?: string
  /** Person who created this request */
  requestor?: string
  /** Alias for requestor */
  requestedBy?: string
  /** Line items (can be `lineItems`, `items`, or `products`) */
  lineItems?: PRLineItem[]
  items?: PRLineItem[]
  products?: PRLineItem[]
  /** Grand total in paise */
  total?: number
  /** Business justification */
  justification?: string
  /** Creation date (ISO string) */
  createdAt?: string
  /** Loading state */
  loading?: boolean
  /** Error message */
  error?: string | null
}

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT:             { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Draft' },
  PENDING:           { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'Pending' },
  PENDING_APPROVAL:  { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'Pending Approval' },
  APPROVED:          { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
  REJECTED:          { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Rejected' },
  DISPUTED:          { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Disputed' },
  CANCELLED:         { bg: 'bg-gray-100',  text: 'text-gray-600',  label: 'Cancelled' },
}

const getStatusConfig = (status?: string) => {
  const key = safeString(status, 'DRAFT').toUpperCase()
  return STATUS_CONFIG[key] || { bg: 'bg-gray-100', text: 'text-gray-700', label: key }
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

const LoadingSkeleton = () => (
  <div data-testid="pr-draft-skeleton" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse" role="status" aria-label="Loading purchase request">
    <div className="px-6 py-4 border-b border-gray-100 flex justify-between">
      <div className="space-y-2">
        <div className="h-5 bg-gray-100 rounded w-36" />
        <div className="h-3 bg-gray-100 rounded w-20" />
      </div>
      <div className="h-6 bg-gray-100 rounded-full w-16" />
    </div>
    <div className="p-6 space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex justify-between">
          <div className="space-y-1">
            <div className="h-4 bg-gray-100 rounded w-32" />
            <div className="h-3 bg-gray-100 rounded w-20" />
          </div>
          <div className="h-4 bg-gray-100 rounded w-16" />
        </div>
      ))}
    </div>
    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between">
      <div className="h-4 bg-gray-100 rounded w-20" />
      <div className="h-6 bg-gray-100 rounded w-24" />
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

const EmptyItemsState = () => (
  <div data-testid="pr-draft-empty" className="text-center py-8">
    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
    </div>
    <p className="text-gray-500 font-medium text-sm">No items added</p>
    <p className="text-gray-400 text-xs mt-1">Search the catalog to add items</p>
  </div>
)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PurchaseRequestDraft: FC<PRDraftProps> = ({
  prNumber,
  status,
  requestor,
  requestedBy,
  lineItems,
  items: itemsProp,
  products,
  total,
  justification,
  createdAt,
  loading,
  error,
}) => {
  // Merge items from any alias
  const rawItems = safeArray<PRLineItem>(lineItems ?? itemsProp ?? products)
  const totalPaise = safeNumber(total, 0)
  const requestorName = safeString(requestor || requestedBy)

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  // ── Error ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div data-testid="pr-draft-error" className="bg-white rounded-xl border border-red-200 shadow-sm p-6 text-center">
        <p className="text-gray-700 font-medium text-sm">Failed to load purchase request</p>
        <p className="text-gray-400 text-xs mt-1">{error}</p>
      </div>
    )
  }

  // Empty overall (no items) — still show the draft shell if we have a PR number
  const hasItems = rawItems.length > 0
  const statusCfg = getStatusConfig(status)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="pr-draft">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Purchase Request</h2>
          <p data-testid="pr-number" className="text-xs sm:text-sm text-gray-500 truncate">
            {safeString(prNumber, 'Draft')}
            {requestorName && ` • ${requestorName}`}
          </p>
        </div>
        <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 sm:px-6 py-4">
        {/* Justification */}
        {safeString(justification, '') && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-medium mb-1">Justification</p>
            <p className="text-sm text-gray-700">{justification}</p>
          </div>
        )}

        {/* Date */}
        {createdAt && safeDate(createdAt) !== '—' && (
          <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Created {safeDate(createdAt)}</span>
          </div>
        )}

        {/* Items or Empty */}
        {!hasItems ? (
          <EmptyItemsState />
        ) : (
          <div className="divide-y divide-gray-100">
            {rawItems.map((item, index) => {
              const qty = safeNumber(item.quantity, 1)
              const unitPrice = safeNumber(item.unitPrice, 0)
              const lineTotal = safeNumber(item.totalPrice, qty * unitPrice)

              return (
                <div key={safeString(item.id, `item-${index}`)} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate" title={safeString(item.name)}>
                      {safeString(item.name, 'Unnamed Item')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {qty} × {safePrice(unitPrice * 100)}
                    </p>
                  </div>
                  <span className="font-semibold text-gray-900 text-sm shrink-0">
                    {safePrice(lineTotal * 100)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Total row */}
      <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Total Amount</span>
        <span className="text-lg sm:text-xl font-bold text-indigo-600">
          {safePrice(totalPaise)}
        </span>
      </div>

      {/* Submit button */}
      <div className="px-4 sm:px-6 py-4 border-t border-gray-100">
        <button
          data-testid="submit-pr-btn"
          disabled={!hasItems}
          className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
            hasItems
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:bg-indigo-800'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {hasItems ? 'Submit for Approval' : 'Add items to submit'}
        </button>
        {hasItems && (
          <p className="text-xs text-gray-500 text-center mt-2">
            Manager will be notified. Typically responds in 24-48 hours.
          </p>
        )}
      </div>
    </div>
  )
}

export default PurchaseRequestDraft
