// B2B GenUI Event Types (PRD Part 7D)

export interface CatalogItem {
  id: string
  name: string
  description: string
  sku: string
  unitPrice: number
  category: string
  vendor: string
  vendorCode: string
  leadDays: number
  inStock: boolean
  minOrderQty: number
  imageUrl?: string
}

export interface CatalogGridProps {
  items: CatalogItem[]
  loading: boolean
}

export interface PRLineItem {
  id: string
  name: string
  vendor: string
  quantity: number
  unitPrice: number
  totalPrice: number
  imageUrl?: string
}

export interface PRDraftProps {
  prNumber: string
  lineItems: PRLineItem[]
  total: number
  status: string
}

export interface PurchaseRequest {
  id: string
  prNumber: string
  status: string
  totalAmount: number
  justification: string
  urgency: string
  createdAt: string
  requestorName?: string
  itemCount?: number
}

export interface PRListProps {
  purchaseRequests: PurchaseRequest[]
  loading: boolean
  approvalCards?: ApprovalCardProps[]
}

export interface BudgetGaugeProps {
  department: string
  monthlyBudget: number
  spent: number
  remaining: number
  percentUsed: number
}

export interface BudgetAlertProps {
  itemName: string
  requested: number
  remaining: number
}

export interface PRSubmittedProps {
  prNumber: string
  approverEmail: string
  totalAmount: number
}

export interface ApprovalCardProps {
  prId: string
  prNumber: string
  requestorName: string
  totalAmount: number
  lineItems: PRLineItem[]
  justification: string
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
  threadId?: string | null
}

export interface DisputeCardProps {
  prId: string
  reason: string
}

export type UIEventMap = {
  'catalog-grid': CatalogGridProps
  'pr-draft': PRDraftProps
  'pr-list': PRListProps
  'dispute-card': DisputeCardProps
  'budget-gauge': BudgetGaugeProps
  'budget-alert': BudgetAlertProps
  'pr-submitted': PRSubmittedProps
  'approval-card': ApprovalCardProps
}