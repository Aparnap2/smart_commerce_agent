// B2B GenUI Components Index
// All components re-exported with their props types for consumer convenience.

import React from 'react'

export { default as CatalogGrid } from './CatalogGrid'
export type { CatalogItem, CatalogGridProps } from './CatalogGrid'

export { default as PurchaseRequestDraft } from './PurchaseRequestDraft'
export type { PRLineItem, PRDraftProps } from './PurchaseRequestDraft'

export { default as PRList } from './PRList'
export type { PRItem, PRListProps } from './PRList'

export { default as ApprovalCard } from './ApprovalCard'
export type { ApprovalCardProps } from './ApprovalCard'

export { default as BudgetGauge } from './BudgetGauge'
export type { CategoryBreakdown, BudgetGaugeProps } from './BudgetGauge'

export { default as BudgetAlert } from './BudgetAlert'
export { default as DisputeCard } from './DisputeCard'
export { default as PRSubmittedCard } from './PRSubmittedCard'

// Lazy-loaded — fetched only when the agent emits a __ui__: "price-comparison" event
export const PriceComparisonCard = React.lazy(() => import('./PriceComparisonCard'))

// Lazy-loaded — fetched on __ui__: "sourcing-request" from vendor_sourcing_request tool
export const SourcingRequestCard = React.lazy(() => import('./SourcingRequestCard'))

// Lazy-loaded — fetched on __ui__: "notification-bell" from notification events
export const NotificationBell = React.lazy(() => import('./NotificationBell'))

// ============================================================================
// SupportPilot — Support GenUI Components
// Lazy-loaded — fetched when the agent emits __ui__ events for Salesforce tools
// ============================================================================

// Case list — fetched on __ui__: "case-list" from salesforce_case_search tool
export const CaseListCard = React.lazy(() => import('./support/CaseListCard'))

// Case detail — fetched on __ui__: "case-detail" from salesforce_case_get tool
export const CaseDetailCard = React.lazy(() => import('./support/CaseDetailCard'))

// Customer context — fetched on __ui__: "customer-context" from salesforce_customer_context tool
export const CustomerContextCard = React.lazy(() => import('./support/CustomerContextCard'))

// KB results — fetched on __ui__: "kb-results" from salesforce_kb_search tool
export const KBResultsCard = React.lazy(() => import('./support/KBResultsCard'))

// Similar tickets — fetched on __ui__: "similar-tickets" from salesforce_similar_cases tool
export const SimilarTicketsCard = React.lazy(() => import('./support/SimilarTicketsCard'))

// Reply draft — fetched on __ui__: "reply-draft" from salesforce_draft_reply tool
export const ReplyDraftCard = React.lazy(() => import('./support/ReplyDraftCard'))

// Case created — fetched on __ui__: "case-created" from salesforce_case_create tool
export const CaseCreatedCard = React.lazy(() => import('./support/CaseCreatedCard'))

// Case updated — fetched on __ui__: "case-updated" from salesforce_case_update tool
export const CaseUpdatedCard = React.lazy(() => import('./support/CaseUpdatedCard'))

// Escalation — fetched on __ui__: "escalation-card" from salesforce_escalate_case tool
export const EscalationCard = React.lazy(() => import('./support/EscalationCard'))
