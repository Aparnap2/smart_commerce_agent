'use client'

import React from 'react'
import { safeString } from '@/lib/genui/safe-render'
import type { CaseDetailProps } from '@/lib/ui-event-types'

// ── Priority badge config ───────────────────────────────────────────────
const PRIORITY_STYLES: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  High:     'bg-orange-100 text-orange-700 border-orange-200',
  Medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low:      'bg-green-100 text-green-700 border-green-200',
}

function getPriorityStyle(priority?: string): string {
  return PRIORITY_STYLES[String(priority ?? '')] ?? 'bg-gray-100 text-gray-600 border-gray-200'
}

// ── Loading Skeleton ────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse"
      role="status"
      aria-label="Loading case details"
    >
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-3 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-40" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="h-5 bg-gray-200 rounded-full w-20" />
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-3 bg-gray-200 rounded w-40" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-3 bg-gray-200 rounded w-24" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-100">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 bg-gray-200 rounded w-12" />
              <div className="h-4 bg-gray-200 rounded w-20" />
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
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
        </svg>
      </div>
      <p className="text-gray-700 font-medium text-sm">Failed to load case details</p>
      <p className="text-gray-400 text-xs mt-1">{message}</p>
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────
export default function CaseDetailCard(props: CaseDetailProps) {
  const c = props?.case

  if (!c) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium text-sm">No case details available</p>
      </div>
    )
  }

  const ps = getPriorityStyle(c.priority)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono text-gray-400 tracking-tight shrink-0">{safeString(c.caseNumber)}</span>
          <h3 className="text-sm font-semibold text-gray-900 truncate">{safeString(c.subject)}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium border ${ps}`}>
            {c.priority}
          </span>
          <span className="px-2.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium">
            {c.status}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* Description */}
        <div className="bg-gray-50 rounded-lg border border-gray-100 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{safeString(c.description)}</p>
        </div>

        {/* Two-column: Contact + Account */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border border-gray-100 p-3.5">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact</h4>
            <p className="text-sm font-medium text-gray-900">{safeString(c.contactName)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{safeString(c.email)}</p>
            <p className="text-xs text-gray-500">{safeString(c.phone)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-100 p-3.5">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Account</h4>
            <p className="text-sm font-medium text-gray-900">{safeString(c.accountName)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Owner: {safeString(c.owner)}</p>
          </div>
        </div>

        {/* Metadata row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-medium">Origin</p>
            <p className="text-sm text-gray-700 mt-0.5">{safeString(c.origin)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Created</p>
            <p className="text-sm text-gray-700 mt-0.5">{safeString(c.createdDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Last Modified</p>
            <p className="text-sm text-gray-700 mt-0.5">{safeString(c.lastModifiedDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Status</p>
            <p className="text-sm text-gray-700 mt-0.5">{c.status}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
