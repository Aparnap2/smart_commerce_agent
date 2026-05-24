// SourcingRequestCard — GenUI component for vendor sourcing request status
//
// Renders when the agent emits a __ui__ payload with name: "sourcing-request".
// Shows the status of a vendor sourcing request with contextual messaging
// based on the current stage (submitted/in_review/approved/rejected).
//
// States: loading | error | submitted | in_review | approved | rejected
// Edge cases: missing productName, missing description, no preferredPrice,
//   malformed submittedAt, invalid status, null/undefined props,
//   long product names, missing requestId.

'use client'

import React, { type FC } from 'react'
import type { SourcingRequestProps } from '@/lib/ui-event-types'
import { safeString, safeNumber, safeDate, formatIndian } from '@/lib/genui/safe-render'

// ---------------------------------------------------------------------------
// Extended props
// ---------------------------------------------------------------------------

export interface SourcingRequestCardProps extends SourcingRequestProps {
  loading?: boolean
  error?: string | null
}

// ---------------------------------------------------------------------------
// Status configuration
// ---------------------------------------------------------------------------

type StatusConfig = {
  bg: string
  border: string
  badge: string
  badgeText: string
  icon: string
  infoIcon: React.ReactNode
  infoBg: string
  infoBorder: string
  infoText: string
  infoTitle: string
  infoMessage: string
  subtitle: string
}

function formatSubmittedAt(val: string | null | undefined): string {
  if (!val) return '—'
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return '—'
    const datePart = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    const timePart = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    return `${datePart}, ${timePart}`
  } catch {
    return '—'
  }
}

const InfoIcon: FC = () => (
  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const STATUS_CONFIG: Record<string, StatusConfig> = {
  submitted: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
    badgeText: 'Submitted',
    icon: '📋',
    infoIcon: <InfoIcon />,
    infoBg: 'bg-blue-50',
    infoBorder: 'border-blue-100',
    infoText: 'text-blue-700',
    infoTitle: 'Under Review',
    infoMessage:
      "Procurement will review within 3 business days. You'll be notified when the item is added to catalog.",
    subtitle: 'Pending procurement review',
  },
  in_review: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700 ring-amber-200',
    badgeText: 'In Review',
    icon: '🔄',
    infoIcon: <InfoIcon />,
    infoBg: 'bg-amber-50',
    infoBorder: 'border-amber-100',
    infoText: 'text-amber-700',
    infoTitle: 'In Progress',
    infoMessage:
      'Your request is currently under review. The procurement team is evaluating sourcing options.',
    subtitle: 'Being evaluated by procurement',
  },
  approved: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700 ring-green-200',
    badgeText: 'Approved',
    icon: '✅',
    infoIcon: (
      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    infoBg: 'bg-green-50',
    infoBorder: 'border-green-100',
    infoText: 'text-green-700',
    infoTitle: 'Added to Catalog',
    infoMessage:
      'Item has been approved and added to catalog. You can now place an order.',
    subtitle: 'Ready for ordering',
  },
  rejected: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700 ring-red-200',
    badgeText: 'Rejected',
    icon: '❌',
    infoIcon: (
      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    infoBg: 'bg-red-50',
    infoBorder: 'border-red-100',
    infoText: 'text-red-700',
    infoTitle: 'Request Rejected',
    infoMessage:
      'Your sourcing request has been rejected. Please contact procurement for more details.',
    subtitle: 'Not approved',
  },
}

const DEFAULT_STATUS = 'submitted'

function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG[DEFAULT_STATUS]
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

const LoadingSkeleton: FC = () => (
  <div
    data-testid="sourcing-request-skeleton"
    className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse"
    role="status"
    aria-label="Loading sourcing request"
  >
    <div className="flex items-center gap-2 mb-4">
      <div className="w-6 h-6 bg-gray-100 rounded" />
      <div className="h-5 bg-gray-100 rounded w-48" />
    </div>
    <div className="h-6 bg-gray-100 rounded-full w-24 mb-4" />
    <div className="space-y-3 mb-4">
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-3/4" />
      <div className="h-4 bg-gray-100 rounded w-1/2" />
      <div className="h-4 bg-gray-100 rounded w-2/3" />
      <div className="h-4 bg-gray-100 rounded w-1/3" />
    </div>
    <div className="h-16 bg-gray-100 rounded-lg" />
  </div>
)

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <div
    data-testid="sourcing-request-error"
    className="bg-red-50 border border-red-200 rounded-xl p-4 text-center"
    role="alert"
  >
    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01" />
      </svg>
    </div>
    <p className="text-red-700 font-medium text-sm">Failed to load sourcing request</p>
    <p className="text-red-500 text-xs mt-1">{message}</p>
  </div>
)

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const SourcingRequestCard: FC<SourcingRequestCardProps> = ({
  productName,
  description,
  preferredPrice,
  status,
  requestId,
  submittedAt,
  loading = false,
  error = null,
}) => {
  // ── Safe values ────────────────────────────────────────────────────────
  const safeProductName = safeString(productName, 'Unnamed Request')
  const safeDescription = safeString(description)
  const safeRequestId = safeString(requestId, '—')
  const safeStatus = safeString(status, DEFAULT_STATUS)
  const hasBudget = preferredPrice != null && preferredPrice > 0

  const config = getStatusConfig(safeStatus)

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  // ── Error ─────────────────────────────────────────────────────────────
  if (error) return <ErrorState message={error} />

  // ── Rendered card ─────────────────────────────────────────────────────
  return (
    <div
      data-testid="sourcing-request-card"
      data-status={safeStatus}
      className={`${config.bg} ${config.border} border rounded-xl p-4 sm:p-5`}
      role="region"
      aria-label={`Sourcing request: ${safeProductName}`}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl leading-none" aria-hidden="true">{config.icon}</span>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
            Vendor Sourcing Request: {safeProductName}
          </h3>
          {config.subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{config.subtitle}</p>
          )}
        </div>
      </div>

      {/* ── Status badge ────────────────────────────────────────────── */}
      <div className="mb-4">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ring-1 ${config.badge}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" aria-hidden="true" />
          {config.badgeText}
        </span>
      </div>

      {/* ── Details ─────────────────────────────────────────────────── */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex gap-2">
          <span className="text-gray-500 font-medium w-24 shrink-0">Product</span>
          <span className="text-gray-900">{safeProductName}</span>
        </div>
        {safeDescription && (
          <div className="flex gap-2">
            <span className="text-gray-500 font-medium w-24 shrink-0">Description</span>
            <span className="text-gray-700">{safeDescription}</span>
          </div>
        )}
        {hasBudget && (
          <div className="flex gap-2">
            <span className="text-gray-500 font-medium w-24 shrink-0">Budget</span>
            <span className="text-gray-900 font-medium">
              Up to ₹{formatIndian(safeNumber(preferredPrice, 0))}
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="text-gray-500 font-medium w-24 shrink-0">Request ID</span>
          <span className="text-gray-600 font-mono text-xs leading-5">{safeRequestId}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 font-medium w-24 shrink-0">Submitted</span>
          <span className="text-gray-600">{formatSubmittedAt(submittedAt)}</span>
        </div>
      </div>

      {/* ── Info callout ────────────────────────────────────────────── */}
      <div
        className={`flex items-start gap-2.5 p-3 rounded-lg border ${config.infoBg} ${config.infoBorder} ${config.infoText} text-sm`}
        role="status"
      >
        {config.infoIcon}
        <div>
          <p className="font-medium text-xs uppercase tracking-wider mb-0.5">
            {config.infoTitle}
          </p>
          <p className="text-xs leading-relaxed opacity-90">
            {config.infoMessage}
          </p>
        </div>
      </div>
    </div>
  )
}

export default SourcingRequestCard
