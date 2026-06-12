'use client'

import React, { useState, useMemo } from 'react'
import {
  Users,
  FileText,
  BookOpen,
  GitCompare,
  Layers,
} from 'lucide-react'
import { useUIContext } from '@/components/support/UIContext'
import { safeString, safeNumber } from '@/lib/genui/safe-render'
import type { KBArticle, SimilarTicket, CaseSummary } from '@/lib/ui-event-types'

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'customer' | 'case' | 'knowledge' | 'similar'

interface Tab {
  id: TabId
  label: string
  icon: React.ReactNode
  getCount?: () => number
}

const TABS: Tab[] = [
  { id: 'customer', label: 'Customer', icon: <Users size={14} /> },
  { id: 'case', label: 'Case', icon: <FileText size={14} /> },
  { id: 'knowledge', label: 'Knowledge', icon: <BookOpen size={14} /> },
  { id: 'similar', label: 'Similar', icon: <GitCompare size={14} /> },
]

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PanelSkeleton() {
  return (
    <div className="context-panel-skeleton">
      <div className="context-panel-skeleton-item" />
      <div className="context-panel-skeleton-item" />
      <div className="context-panel-skeleton-item" style={{ height: 60 }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="context-panel-empty">
      <div className="context-panel-empty-icon">
        <Layers size={22} />
      </div>
      <h3>No context yet</h3>
      <p>Ask a question to see customer context here</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tab content components
// ---------------------------------------------------------------------------

function CustomerTab() {
  const { customerContext } = useUIContext()
  const { account, contact, openCases, recentInteractions } = customerContext

  if (!account && !contact && openCases.length === 0 && recentInteractions.length === 0) {
    return (
      <div className="context-panel-empty" style={{ padding: '24px 16px' }}>
        <p className="text-xs text-gray-400">No customer data loaded yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3">
      {/* Account */}
      {account && (
        <div className="border border-gray-100 rounded-lg p-3 bg-blue-50/30">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {safeString(account.name)}
            </span>
            <span className="shrink-0 px-2 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-700 font-medium border border-blue-200">
              {safeString(account.customerTier)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="truncate">{safeString(account.industry)}</span>
            <span>·</span>
            <span>{safeString(account.billingCity)}</span>
          </div>
          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-blue-100">
            <div>
              <span className="text-base font-bold text-gray-900">
                {safeNumber(account.openCases, 0)}
              </span>
              <span className="text-[10px] text-gray-500 ml-1">open</span>
            </div>
            <div>
              <span className="text-base font-bold text-gray-900">
                {account.annualRevenue
                  ? `$${(safeNumber(account.annualRevenue, 0) / 1000).toFixed(0)}k`
                  : '—'}
              </span>
              <span className="text-[10px] text-gray-500 ml-1">revenue</span>
            </div>
          </div>
        </div>
      )}

      {/* Contact */}
      {contact && (
        <div className="border border-gray-100 rounded-lg p-3 bg-white">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-gray-500">
                {(contact.name ?? '?')[0]}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {safeString(contact.name)}
            </span>
          </div>
          <p className="text-xs text-gray-500 ml-8">{safeString(contact.title)}</p>
          <p className="text-xs text-gray-400 ml-8 truncate">{safeString(contact.email)}</p>
        </div>
      )}

      {/* Open cases summary */}
      {openCases.length > 0 && (
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
            <span className="text-[10px] font-semibold text-gray-500 uppercase">
              Open Cases ({openCases.length})
            </span>
          </div>
          {openCases.slice(0, 3).map((c: CaseSummary) => (
            <div
              key={c.id}
              className="px-3 py-2 flex items-center justify-between text-xs border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-gray-400 shrink-0">
                  {c.caseNumber}
                </span>
                <span className="text-gray-700 truncate">{safeString(c.subject)}</span>
              </div>
              <span className="text-[10px] text-gray-500 shrink-0 ml-2">{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CaseTab() {
  const { caseDetail } = useUIContext()

  if (!caseDetail) {
    return (
      <div className="context-panel-empty" style={{ padding: '24px 16px' }}>
        <p className="text-xs text-gray-400">No case selected</p>
      </div>
    )
  }

  const priorityStyles: Record<string, string> = {
    Critical: 'bg-red-100 text-red-700 border-red-200',
    High: 'bg-orange-100 text-orange-700 border-orange-200',
    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Low: 'bg-green-100 text-green-700 border-green-200',
  }
  const ps =
    priorityStyles[caseDetail.priority ?? ''] ?? 'bg-gray-100 text-gray-600 border-gray-200'

  return (
    <div className="space-y-2 p-3">
      {/* Case header */}
      <div className="border border-gray-100 rounded-lg p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">
            <span className="text-[10px] font-mono text-gray-400">
              {safeString(caseDetail.caseNumber)}
            </span>
            <h4 className="text-sm font-semibold text-gray-900 truncate mt-0.5">
              {safeString(caseDetail.subject)}
            </h4>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium border ${ps}`}>
            {caseDetail.priority}
          </span>
          <span className="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 text-blue-700 font-medium">
            {caseDetail.status}
          </span>
        </div>
      </div>

      {/* Description */}
      {caseDetail.description && (
        <div className="border border-gray-100 rounded-lg p-3">
          <h5 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Description</h5>
          <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">
            {safeString(caseDetail.description)}
          </p>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-gray-100 rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400 font-medium">Contact</p>
          <p className="text-xs text-gray-700 mt-0.5 truncate">
            {safeString(caseDetail.contactName)}
          </p>
        </div>
        <div className="border border-gray-100 rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400 font-medium">Account</p>
          <p className="text-xs text-gray-700 mt-0.5 truncate">
            {safeString(caseDetail.accountName)}
          </p>
        </div>
        <div className="border border-gray-100 rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400 font-medium">Origin</p>
          <p className="text-xs text-gray-700 mt-0.5 truncate">
            {safeString(caseDetail.origin)}
          </p>
        </div>
        <div className="border border-gray-100 rounded-lg p-2.5">
          <p className="text-[10px] text-gray-400 font-medium">Owner</p>
          <p className="text-xs text-gray-700 mt-0.5 truncate">
            {safeString(caseDetail.owner)}
          </p>
        </div>
      </div>
    </div>
  )
}

function KnowledgeTab() {
  const { kbResults } = useUIContext()
  const { articles, query } = kbResults

  if (articles.length === 0) {
    return (
      <div className="context-panel-empty" style={{ padding: '24px 16px' }}>
        <BookOpen size={20} className="text-gray-300 mb-2" />
        <p className="text-xs text-gray-400">
          {query ? 'No matching articles found' : 'No knowledge articles loaded'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3">
      {articles.slice(0, 5).map((article: KBArticle) => (
        <div
          key={article.articleId}
          className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 hover:shadow-sm transition-all"
        >
          <h4 className="text-xs font-semibold text-gray-900 leading-snug mb-1">
            {safeString(article.title)}
          </h4>
          <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
            {safeString(article.contentExcerpt)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex px-2 py-0.5 text-[10px] rounded-full font-medium bg-purple-100 text-purple-700">
              {safeString(article.category)}
            </span>
            {article.url && (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-600 hover:text-blue-800 font-medium ml-auto"
              >
                Open ↗
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function SimilarTab() {
  const { similarTickets } = useUIContext()
  const { tickets, query } = similarTickets

  if (tickets.length === 0) {
    return (
      <div className="context-panel-empty" style={{ padding: '24px 16px' }}>
        <GitCompare size={20} className="text-gray-300 mb-2" />
        <p className="text-xs text-gray-400">
          {query ? 'No similar tickets found' : 'No resolved tickets loaded'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3">
      {tickets.slice(0, 5).map((ticket: SimilarTicket) => (
        <div
          key={ticket.id}
          className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono text-gray-400 shrink-0">
                {ticket.caseNumber}
              </span>
              <h4 className="text-xs font-medium text-gray-900 truncate">
                {safeString(ticket.subject)}
              </h4>
            </div>
            <span className="text-[10px] text-gray-400 shrink-0">
              {safeString(ticket.resolvedDate)}
            </span>
          </div>
          <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
            {safeString(ticket.resolution)}
          </p>
          {ticket.satisfactionRating > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <StarRating rating={ticket.satisfactionRating} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  const stars = Math.min(5, Math.max(0, Math.round(rating)))
  return (
    <div className="flex items-center gap-0.5" aria-label={`${stars} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-2.5 h-2.5 ${i < stars ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-[10px] text-gray-400 ml-1">{stars > 0 ? `${stars}/5` : '—'}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main ContextPanel component
// ---------------------------------------------------------------------------

interface ContextPanelProps {
  className?: string
}

export default function ContextPanel({ className = '' }: ContextPanelProps) {
  const { isStreaming, customerContext, caseDetail, kbResults, similarTickets } = useUIContext()
  const [activeTab, setActiveTab] = useState<TabId>('customer')

  // Compute whether we have any data at all
  const hasAnyData = useMemo(() => {
    return (
      customerContext.account !== null ||
      customerContext.contact !== null ||
      customerContext.openCases.length > 0 ||
      caseDetail !== null ||
      kbResults.articles.length > 0 ||
      similarTickets.tickets.length > 0
    )
  }, [customerContext, caseDetail, kbResults, similarTickets])

  // Tab counts
  const tabCounts = useMemo(() => {
    const openCaseCount = customerContext.openCases.length
    const kbCount = kbResults.articles.length
    const similarCount = similarTickets.tickets.length

    return {
      knowledge: kbCount > 0 ? kbCount : undefined,
      similar: similarCount > 0 ? similarCount : undefined,
      customer: openCaseCount > 0 ? openCaseCount : undefined,
    }
  }, [customerContext, kbResults, similarTickets])

  const renderTabContent = () => {
    if (isStreaming && !hasAnyData) return <PanelSkeleton />
    if (!hasAnyData) return <EmptyState />

    switch (activeTab) {
      case 'customer':
        return <CustomerTab />
      case 'case':
        return <CaseTab />
      case 'knowledge':
        return <KnowledgeTab />
      case 'similar':
        return <SimilarTab />
      default:
        return <EmptyState />
    }
  }

  return (
    <div className={`context-panel ${className}`}>
      {/* Header */}
      <div className="context-panel-header">
        <Layers size={16} />
        <h2>Context</h2>
      </div>

      {/* Tab bar */}
      {hasAnyData && (
        <div className="context-panel-tabs" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            const count = tabCounts[tab.id as keyof typeof tabCounts]
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`context-panel-tab ${isActive ? 'active' : ''}`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {count !== undefined && (
                  <span className="context-panel-tab-count">{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Body */}
      <div className="context-panel-body">{renderTabContent()}</div>
    </div>
  )
}
