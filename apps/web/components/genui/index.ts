// B2B GenUI Components Index

// Legacy (B2C) - kept for backward compatibility
export { default as ProductGrid } from './ProductGrid'
export type { Product } from './ProductGrid'

export { default as CartCanvas } from './CartCanvas'
export type { CartItem, CartCanvasProps } from './CartCanvas'

export { default as OrderList } from './OrderList'
export { default as OrderCard } from './OrderCard'
export { default as ReturnCard } from './ReturnCard'

// B2B Components (New)
export { default as CatalogGrid } from './CatalogGrid'
export { default as PurchaseRequestDraft } from './PurchaseRequestDraft'
export { default as PRList } from './PRList'
export { default as ApprovalCard } from './ApprovalCard'
export { default as BudgetGauge } from './BudgetGauge'
export { default as BudgetAlert } from './BudgetAlert'
export { default as DisputeCard } from './DisputeCard'
export { default as PRSubmittedCard } from './PRSubmittedCard'

// Types
export type { CatalogGridProps, CatalogItem } from './CatalogGrid'
export type { PRDraftProps, PRLineItem } from './PurchaseRequestDraft'
export type { PRListProps, PurchaseRequest } from './PRList'
export type { ApprovalCardProps } from './ApprovalCard'
export type { BudgetGaugeProps } from './BudgetGauge'
export type { BudgetAlertProps } from './BudgetAlert'
export type { DisputeCardProps } from './DisputeCard'
export type { PRSubmittedProps } from './PRSubmittedCard'