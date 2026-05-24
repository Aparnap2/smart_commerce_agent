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

export interface PRItem {
  id?: string
  prNumber?: string
  status?: string
  total?: number
  totalAmount?: number
  department?: string
  requestedBy?: string
  createdAt?: string
}

export interface PRListProps {
  requests?: PRItem[]
  loading?: boolean
  error?: string | null
}

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT:            { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Draft' },
  PENDING:          { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'Pending' },
  PENDING_APPROVAL: { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'Pending' },
  APPROVED:         { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
  REJECTED:         { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Rejected' },
  DISPUTED:         { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Disputed' },
  CANCELLED:        { bg: 'bg-gray-100',  text: 'text-gray-600',  label: 'Cancelled' },
}

const getStatusConfig = (status?: string) => {
  const key = safeString(status, 'UNKNOWN').toUpperCase()
  return STATUS_CONFIG[key] || { bg: 'bg-gray-100', text: 'text-gray-700', label: key }
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

const LoadingSkeleton = () => (
  <div
    data-testid="pr-list-skeleton"
    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse"
    role="status"
    aria-label="Loading purchase requests"
  >
    {/* Mobile cards skeleton */}
    <div className="block sm:hidden p-4 space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-gray-100 rounded-lg p-4 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>
      ))}
    </div>
    {/* Desktop table skeleton */}
    <div className="hidden sm:block">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex gap-12">
          <div className="h-3 bg-gray-200 rounded w-12" />
          <div className="h-3 bg-gray-200 rounded w-16" />
          <div className="h-3 bg-gray-200 rounded w-20" />
          <div className="h-3 bg-gray-200 rounded w-12" />
          <div className="h-3 bg-gray-200 rounded w-16 ml-auto" />
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {[1, 2, 3].map(i => (
          <div key={i} className="px-6 py-4 flex gap-12">
            <div className="h-4 bg-gray-100 rounded w-16" />
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-100 rounded w-28" />
            <div className="h-5 bg-gray-100 rounded-full w-16" />
            <div className="h-4 bg-gray-100 rounded w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  </div>
)

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

const EmptyState = () => (
  <div data-testid="pr-list-empty" className="flex flex-col items-center justify-center py-16 text-center px-4">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
    <p className="text-gray-500 font-medium">No purchase requests</p>
    <p className="text-gray-400 text-sm mt-1">Create a new PR from the chat</p>
  </div>
)

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <div data-testid="pr-list-error" className="bg-white rounded-xl border border-red-200 shadow-sm p-6 text-center">
    <p className="text-gray-700 font-medium text-sm">Failed to load requests</p>
    <p className="text-gray-400 text-xs mt-1">{message}</p>
  </div>
)

// ---------------------------------------------------------------------------
// Mobile row (card-style for < 640px)
// ---------------------------------------------------------------------------

const MobilePRCard: FC<{ pr: PRItem }> = ({ pr }) => {
  const statusCfg = getStatusConfig(pr.status)
  const safeTotal = safeNumber(pr.total ?? pr.totalAmount, 0)

  return (
    <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900 text-sm">#{safeString(pr.prNumber, 'N/A')}</span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCfg.bg} ${statusCfg.text}`}>
          {statusCfg.label}
        </span>
      </div>
      <div className="text-xs text-gray-500 space-y-0.5">
        <p className="truncate">{safeString(pr.requestedBy, 'Unknown')}</p>
        <p className="truncate">{safeString(pr.department)}</p>
        {pr.createdAt && <p>{safeDate(pr.createdAt)}</p>}
      </div>
      <div className="text-sm font-semibold text-gray-900">{safePrice(safeTotal)}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PRList: FC<PRListProps> = ({ requests, loading, error }) => {
  const safeRequests = safeArray<PRItem>(requests)

  // ── Loading ─────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  // ── Error ───────────────────────────────────────────────────────────
  if (error) return <ErrorState message={error} />

  // ── Empty ───────────────────────────────────────────────────────────
  if (safeRequests.length === 0) return <EmptyState />

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div data-testid="pr-list" className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Mobile card layout (< 640px) */}
      <div className="sm:hidden divide-y divide-gray-100">
        {safeRequests.map((pr, index) => (
          <MobilePRCard key={safeString(pr.id, `pr-mobile-${index}`)} pr={pr} />
        ))}
      </div>

      {/* Desktop table layout (>= 640px) */}
      <div className="hidden sm:block overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[500px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">PR #</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Requester</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {safeRequests.map((pr, index) => {
              const statusCfg = getStatusConfig(pr.status)
              const safeTotal = safeNumber(pr.total ?? pr.totalAmount, 0)
              const prId = safeString(pr.id, `pr-table-${index}`)

              return (
                <tr
                  key={prId}
                  data-testid="pr-item"
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">
                        #{safeString(pr.prNumber, 'N/A')}
                      </span>
                      {pr.createdAt && (
                        <span className="hidden lg:inline text-xs text-gray-400">
                          {safeDate(pr.createdAt)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-[120px] lg:max-w-[180px]">
                    {safeString(pr.requestedBy, 'Unknown')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-[100px] lg:max-w-[140px]">
                    {safeString(pr.department)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-gray-900 text-sm">{safePrice(safeTotal)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PRList
