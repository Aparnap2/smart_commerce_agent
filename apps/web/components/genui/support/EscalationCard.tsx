'use client'

import React from 'react'
import { safeString, safeNumber } from '@/lib/genui/safe-render'
import type { EscalationCardProps } from '@/lib/ui-event-types'

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
      aria-label="Loading escalation"
    >
      <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-amber-200" />
        <div className="h-4 bg-amber-200 rounded w-24" />
      </div>
      <div className="p-5 space-y-3">
        <div className="flex justify-between">
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="flex gap-2">
            <div className="h-5 bg-gray-200 rounded-full w-16" />
            <div className="h-5 bg-gray-200 rounded-full w-20" />
          </div>
        </div>
        <div className="h-12 bg-gray-100 rounded-lg" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-3 bg-gray-200 rounded w-20" />
          <div className="h-3 bg-gray-200 rounded w-24" />
        </div>
      </div>
    </div>
  )
}

// ── Error State ─────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 text-center" role="alert">
      <p className="text-gray-700 font-medium text-sm">Escalation information unavailable</p>
      <p className="text-gray-400 text-xs mt-1">{message}</p>
    </div>
  )
}

// ── Empty State ─────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01" />
        </svg>
      </div>
      <p className="text-gray-500 font-medium text-sm">Escalation information unavailable</p>
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────
export default function EscalationCard(props: EscalationCardProps) {
  const e = props?.escalation
  const requiresApproval = Boolean(props?.requiresApproval)

  if (!e) {
    return <EmptyState />
  }

  const ps = getPriorityStyle(e.priority)

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Warning header */}
      <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.5 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-800">Escalation Requested</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-amber-600 font-medium">Case #{safeString(e.caseId)}</span>
            {requiresApproval && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-amber-200 text-amber-800 font-medium border border-amber-300">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Pending Approval
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Status bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${ps}`}>
              {e.priority}
            </span>
            <span className="px-2.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 font-medium">
              {e.status}
            </span>
          </div>
        </div>

        {/* Reason */}
        <div className="bg-amber-50/50 rounded-lg border border-amber-100 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Reason</h4>
          <p className="text-sm text-gray-700 leading-relaxed">{safeString(e.reason)}</p>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-gray-50 rounded-lg p-3">
            <span className="text-gray-400 font-medium">Escalated by</span>
            <p className="text-sm text-gray-700 mt-0.5 font-medium">{safeString(e.escalatedBy)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <span className="text-gray-400 font-medium">Escalated at</span>
            <p className="text-sm text-gray-700 mt-0.5 font-medium">{safeString(e.escalatedAt)}</p>
          </div>
        </div>

        {/* Approval notice */}
        {requiresApproval && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2.5">
            <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-amber-700 leading-relaxed">
              <strong>Approval required:</strong> This escalation requires team lead approval before it can be processed. The approver will be notified.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
