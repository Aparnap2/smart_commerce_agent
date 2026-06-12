'use client'

import React from 'react'
import { safeArray, safeString, safeNumber } from '@/lib/genui/safe-render'
import type { CaseListProps, CaseSummary } from '@/lib/ui-event-types'

// ── Priority badge config ───────────────────────────────────────────────
const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  Critical: { bg: 'bg-red-100', text: 'text-red-700' },
  High:     { bg: 'bg-orange-100', text: 'text-orange-700' },
  Medium:   { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  Low:      { bg: 'bg-green-100', text: 'text-green-700' },
}

function getPriorityStyle(priority?: string) {
  return PRIORITY_STYLES[String(priority ?? '')] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
}

// ── Loading Skeleton ────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse"
      role="status"
      aria-label="Loading cases"
    >
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-3 bg-gray-200 rounded w-20" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
            <div className="h-5 bg-gray-200 rounded-full w-16" />
          </div>
          <div className="flex gap-3 mt-2">
            <div className="h-3 bg-gray-100 rounded w-16" />
            <div className="h-3 bg-gray-100 rounded w-24" />
            <div className="h-3 bg-gray-100 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Error State ─────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 text-center" role="alert">
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
        </svg>
      </div>
      <p className="text-gray-700 font-medium text-sm">Failed to load cases</p>
      <p className="text-gray-400 text-xs mt-1">{message}</p>
    </div>
  )
}

// ── Empty State ─────────────────────────────────────────────────────────
function EmptyState({ query }: { query?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
        <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-gray-500 font-medium text-sm">No cases found</p>
      {query && <p className="text-gray-400 text-xs mt-1">No results for &ldquo;{query}&rdquo;</p>}
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────
export default function CaseListCard(props: CaseListProps) {
  const cases = safeArray(props?.cases) as CaseSummary[]
  const query = safeString(props?.query)
  const totalCount = safeNumber(props?.totalCount, cases.length)

  if (cases.length === 0) {
    return <EmptyState query={query || undefined} />
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Cases{query ? ` matching "${query}"` : ''}
        </h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
          {totalCount} result{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-100">
        {cases.map((c) => {
          const ps = getPriorityStyle(c.priority)
          return (
            <div key={c.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400 tracking-tight">{c.caseNumber}</span>
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 mt-0.5 leading-snug">{safeString(c.subject)}</h4>
                </div>
                <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${ps.bg} ${ps.text}`}>
                  {c.priority}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
                  {c.status}
                </span>
                <span>{c.accountName}</span>
                <span>{c.owner}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
