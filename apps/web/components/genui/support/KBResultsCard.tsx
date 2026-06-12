'use client'

import React from 'react'
import { safeArray, safeString, safeNumber } from '@/lib/genui/safe-render'
import type { KBResultsProps, KBArticle } from '@/lib/ui-event-types'

// ── Loading Skeleton ────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse"
      role="status"
      aria-label="Loading knowledge base articles"
    >
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
              <div className="flex gap-2">
                <div className="h-5 bg-gray-200 rounded-full w-16" />
                <div className="h-3 bg-gray-100 rounded w-20" />
              </div>
            </div>
          ))}
        </div>
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
      <p className="text-gray-700 font-medium text-sm">Failed to load articles</p>
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <p className="text-gray-500 font-medium text-sm">No knowledge base articles found</p>
      {query && <p className="text-gray-400 text-xs mt-1">No results for &ldquo;{query}&rdquo;</p>}
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────
export default function KBResultsCard(props: KBResultsProps) {
  const articles = safeArray(props?.articles) as KBArticle[]
  const query = safeString(props?.query)
  const totalCount = safeNumber(props?.totalCount, articles.length)

  if (articles.length === 0) {
    return <EmptyState query={query || undefined} />
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Knowledge Base{query ? ` — "${query}"` : ''}
        </h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
          {totalCount} article{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Article grid */}
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {articles.map((a) => (
            <div
              key={a.articleId}
              className="group border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <div className="flex flex-col h-full">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug">
                      {safeString(a.title)}
                    </h4>
                    {a.url && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-blue-600 hover:text-blue-800 text-xs font-medium mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Open article: ${a.title}`}
                      >
                        Open ↗
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                    {safeString(a.contentExcerpt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                  <span className="inline-flex px-2 py-0.5 text-[10px] rounded-full font-medium bg-purple-100 text-purple-700">
                    {safeString(a.category)}
                  </span>
                  <span className="text-[10px] text-gray-400">Reviewed: {safeString(a.lastReviewedDate)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
