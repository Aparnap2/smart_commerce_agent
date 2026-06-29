'use client'

import React from 'react'
import { safeString, safeNumber } from '@/lib/genui/safe-render'
import type { CaseCreatedProps } from '@/lib/ui-event-types'

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
      aria-label="Loading case creation confirmation"
    >
      <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-emerald-200" />
        <div className="h-4 bg-emerald-200 rounded w-40" />
      </div>
      <div className="p-5 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-20" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="flex gap-3">
          <div className="h-3 bg-gray-100 rounded w-16" />
          <div className="h-3 bg-gray-100 rounded w-24" />
        </div>
      </div>
    </div>
  )
}

// ── Error State ─────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 text-center" role="alert">
      <p className="text-gray-700 font-medium text-sm">Case creation status unavailable</p>
      <p className="text-gray-400 text-xs mt-1">{message}</p>
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────
export default function CaseCreatedCard(props: CaseCreatedProps) {
  const c = props?.case

  if (!c) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium text-sm">Case creation information unavailable</p>
      </div>
    )
  }

  const ps = getPriorityStyle(c.priority)

  return (
    <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
      {/* Success header */}
      <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-emerald-800">Case Created Successfully</h3>
          <p className="text-[10px] text-emerald-600 font-medium">The new case has been opened in Salesforce</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-mono text-gray-400 tracking-tight">{c.caseNumber}</span>
            <h4 className="text-sm font-medium text-gray-900 mt-0.5 leading-snug">{safeString(c.subject)}</h4>
          </div>
          <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${ps}`}>
            {c.priority}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            {c.status}
          </span>
          <span>{c.accountName}</span>
          <span>{c.owner}</span>
        </div>
      </div>
    </div>
  )
}
