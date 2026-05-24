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
