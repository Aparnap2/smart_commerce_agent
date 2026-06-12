'use client'

import React from 'react'
import { safeArray, safeString } from '@/lib/genui/safe-render'
import type { CaseUpdatedProps } from '@/lib/ui-event-types'

// ── Priority badge config ───────────────────────────────────────────────
const PRIORITY_STYLES: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700',
  High:     'bg-orange-100 text-orange-700',
  Medium:   'bg-yellow-100 text-yellow-700',
  Low:      'bg-green-100 text-green-700',
}

function getPriorityStyle(priority?: string): string {
  return PRIORITY_STYLES[String(priority ?? '')] ?? 'bg-gray-100 text-gray-600'
}

// ── Loading Skeleton ────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse"
      role="status"
      aria-label="Loading case update confirmation"
    >
      <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-blue-200" />
        <div className="h-4 bg-blue-200 rounded w-28" />
      </div>
      <div className="p-5 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-20" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="space-y-1.5">
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
    </div>
  )
}

// ── Error State ─────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 text-center" role="alert">
      <p className="text-gray-700 font-medium text-sm">Case update status unavailable</p>
      <p className="text-gray-400 text-xs mt-1">{message}</p>
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────
export default function CaseUpdatedCard(props: CaseUpdatedProps) {
  const c = props?.case
  const changes = safeArray<string>(props?.changes)

  if (!c) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium text-sm">Case update information unavailable</p>
      </div>
    )
  }

  const ps = getPriorityStyle(c.priority)

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm overflow-hidden">
      {/* Info header */}
      <div className="px-5 py-3 bg-blue-50 border-b border-blue-200 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-blue-800">Case Updated</h3>
          <p className="text-[10px] text-blue-600 font-medium">Changes have been saved to Salesforce</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-mono text-gray-400 tracking-tight">{c.caseNumber}</span>
            <h4 className="text-sm font-medium text-gray-900 mt-0.5 leading-snug">{safeString(c.subject)}</h4>
          </div>
          <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${ps}`}>
            {c.priority}
          </span>
        </div>

        {/* Changes list */}
        {changes.length > 0 && (
          <div className="bg-blue-50/50 rounded-lg border border-blue-100 p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">Changes Made</h4>
            <ul className="space-y-1.5">
              {changes.map((change, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="leading-tight">{change}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
