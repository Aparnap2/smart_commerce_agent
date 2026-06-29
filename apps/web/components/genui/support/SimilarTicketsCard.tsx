'use client'

import React from 'react'
import { safeArray, safeString, safeNumber } from '@/lib/genui/safe-render'
import type { SimilarTicketsProps, SimilarTicket } from '@/lib/ui-event-types'

// ── Loading Skeleton ────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse"
      role="status"
      aria-label="Loading similar tickets"
    >
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>
      <div className="divide-y divide-gray-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-5 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-3 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-40" />
              </div>
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="flex gap-2">
              <div className="h-3 bg-gray-100 rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Error State ─────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 text-center" role="alert">
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
        </svg>
      </div>
      <p className="text-gray-700 font-medium text-sm">Failed to load similar tickets</p>
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <p className="text-gray-500 font-medium text-sm">No similar resolved tickets found</p>
      {query && <p className="text-gray-400 text-xs mt-1">No results for &ldquo;{query}&rdquo;</p>}
    </div>
  )
}

// ── Star Rating ─────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  const stars = Math.min(5, Math.max(0, Math.round(rating)))
  return (
    <div className="flex items-center gap-0.5" aria-label={`${stars} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-3 h-3 ${i < stars ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-[10px] text-gray-400 ml-1">
        {stars > 0 ? `${stars}/5` : '—'}
      </span>
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────
export default function SimilarTicketsCard(props: SimilarTicketsProps) {
  const tickets = safeArray(props?.tickets) as SimilarTicket[]
  const query = safeString(props?.query)
  const totalCount = safeNumber(props?.totalCount, tickets.length)

  if (tickets.length === 0) {
    return <EmptyState query={query || undefined} />
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Similar Resolved Tickets{query ? ` — "${query}"` : ''}
        </h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
          {totalCount} ticket{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-100">
        {tickets.map((t) => {
          const rating = safeNumber(t.satisfactionRating, 0)
          return (
            <div key={t.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-gray-400 tracking-tight shrink-0">{t.caseNumber}</span>
                  <h4 className="text-sm font-medium text-gray-900 truncate">{safeString(t.subject)}</h4>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{safeString(t.resolvedDate)}</span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{safeString(t.resolution)}</p>
              <div className="mt-2">
                <StarRating rating={rating} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
