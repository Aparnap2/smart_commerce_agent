'use client'

import React from 'react'
import { safeArray, safeString, safeNumber } from '@/lib/genui/safe-render'
import type { CustomerContextProps, CaseSummary, CaseInteraction } from '@/lib/ui-event-types'

// ── Loading Skeleton ────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse"
      role="status"
      aria-label="Loading customer context"
    >
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="h-4 bg-gray-200 rounded w-36" />
      </div>
      <div className="p-5 space-y-5">
        {/* Account skeleton */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-16" />
          <div className="bg-blue-50 rounded-lg p-4 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-3 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center space-y-1">
                  <div className="h-5 bg-gray-200 rounded w-12 mx-auto" />
                  <div className="h-3 bg-gray-200 rounded w-16 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Contact skeleton */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-16" />
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-3 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-28" />
            </div>
          </div>
        </div>
        {/* Open cases skeleton */}
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-24" />
          <div className="space-y-1">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Error State ─────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 text-center" role="alert">
      <p className="text-gray-700 font-medium text-sm">Failed to load customer context</p>
      <p className="text-gray-400 text-xs mt-1">{message}</p>
    </div>
  )
}

// ── Empty State ─────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
        <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <p className="text-gray-500 font-medium text-sm">No customer context available</p>
    </div>
  )
}

// ── Component ───────────────────────────────────────────────────────────
export default function CustomerContextCard(props: CustomerContextProps) {
  const account = props?.account
  const contact = props?.contact
  const openCases = safeArray(props?.openCases) as CaseSummary[]
  const interactions = safeArray(props?.recentInteractions) as CaseInteraction[]

  if (!account && !contact && openCases.length === 0 && interactions.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">Customer 360</h3>
      </div>

      <div className="p-5 space-y-5">
        {/* ── Account Info ─────────────────────────────────────────────── */}
        {account && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Account</h4>
            <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-900 truncate">{safeString(account.name)}</span>
                <span className="shrink-0 px-2.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium border border-blue-200">
                  {safeString(account.customerTier)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-500">
                <span className="truncate">{safeString(account.industry)}</span>
                <span className="truncate">{safeString(account.billingCity)}, {safeString(account.billingCountry)}</span>
                <span className="truncate">{safeString(account.website)}</span>
                <span className="truncate">{safeString(account.phone)}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-blue-100">
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900">{safeNumber(account.openCases, 0)}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Open</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900">
                    {account.annualRevenue ? `$${(safeNumber(account.annualRevenue, 0) / 1000).toFixed(0)}k` : '—'}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Revenue</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-gray-900">{safeString(account.lastCaseDate)}</p>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Last Case</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Contact Info ─────────────────────────────────────────────── */}
        {contact && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact</h4>
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-gray-500">
                    {(contact.name ?? '?')[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{safeString(contact.name)}</p>
                  <p className="text-xs text-gray-500">{safeString(contact.title)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-500 pt-1">
                <span className="truncate">{safeString(contact.email)}</span>
                <span className="truncate">{safeString(contact.phone)}</span>
                <span className="truncate">{safeString(contact.department)}</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Open Cases ───────────────────────────────────────────────── */}
        {openCases.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Open Cases
              <span className="ml-1.5 text-gray-400 font-normal">({openCases.length})</span>
            </h4>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
              {openCases.slice(0, 3).map((c) => (
                <div key={c.id} className="px-4 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono text-gray-400 shrink-0">{c.caseNumber}</span>
                    <span className="text-gray-700 truncate">{safeString(c.subject)}</span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 ml-2">{c.status}</span>
                </div>
              ))}
              {openCases.length > 3 && (
                <div className="px-4 py-2 text-xs text-center text-blue-600 font-medium hover:bg-gray-50 cursor-default">
                  +{openCases.length - 3} more case{openCases.length - 3 !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Recent Interactions ───────────────────────────────────────── */}
        {interactions.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Recent Interactions
              <span className="ml-1.5 text-gray-400 font-normal">({interactions.length})</span>
            </h4>
            <div className="space-y-2">
              {interactions.slice(0, 5).map((i, idx) => (
                <div key={i.id ?? idx} className="flex items-start gap-3 px-3 py-2.5 bg-white rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-700">{i.type}</span>
                      <span className="text-xs text-gray-400 shrink-0">{i.date}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{safeString(i.summary)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
