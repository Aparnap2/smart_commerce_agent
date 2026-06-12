/**
 * UI Event Type Definitions
 *
 * Types for GenUI components that communicate events back to the agent.
 * These are shared between the component library and the agent SDK.
 */

export interface BudgetAlertProps {
  itemName: string
  requested: number
  remaining: number
}

export interface DisputeCardProps {
  prId: string
  reason: string
}

export interface DisputeConfirmationProps {
  prId: string;
  reason: string;
  referenceNumber: string;
  status: 'submitted' | 'in_review' | 'resolved' | 'rejected';
  submittedAt: string;
}

export interface PRSubmittedProps {
  prNumber: string
  approverEmail: string
  totalAmount: number
}

export interface SourcingRequestProps {
  productName: string;
  description: string;
  preferredPrice?: number;
  status: 'submitted' | 'in_review' | 'approved' | 'rejected';
  requestId: string;
  submittedAt: string;
}

export interface PriceComparisonProps {
  /** Natural language query that triggered the market search */
  query?: string
  /** Catalog/vendor price in paise (e.g. 1850000 for ₹18,500) */
  catalogPrice?: number
  /** Name of the approved vendor supplying the catalog price */
  catalogSource?: string
  /** Array of market results from compare_market_price (SerpApi) */
  results?: Array<{
    title: string
    price: number
    source: string
    link?: string
    rating?: number | null
    thumbnail?: string
  }>
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'pr_submitted' | 'pr_approved' | 'pr_rejected' | 'budget_alert' | 'sourcing_update' | 'dispute_raised';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface NotificationBellProps {
  /** Override for unread count (falls back to derived from notifications) */
  count?: number;
  /** Array of notification items to display */
  notifications?: NotificationItem[];
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Callback when a single notification is marked as read */
  onMarkRead?: (id: string) => void;
  /** Callback when all notifications are marked as read */
  onMarkAllRead?: () => void;
}

// ============================================================================
// SupportPilot — Salesforce Support GenUI Types
// ============================================================================

export interface CaseSummary {
  id: string
  caseNumber: string
  subject: string
  status: string
  priority: string
  owner: string
  accountId: string
  accountName: string
  createdDate: string
}

export interface CaseDetail extends CaseSummary {
  description: string
  contactId: string
  contactName: string
  email: string
  phone: string
  origin: string
  lastModifiedDate: string
}

export interface CaseListProps {
  cases: CaseSummary[]
  query: string
  totalCount: number
}

export interface CaseDetailProps {
  case: CaseDetail
}

export interface AccountInfo {
  id: string
  name: string
  industry: string
  website: string
  phone: string
  billingCity: string
  billingCountry: string
  annualRevenue: number
  customerTier: string
  openCases: number
  lastCaseDate: string
}

export interface ContactInfo {
  id: string
  name: string
  email: string
  phone: string
  title: string
  department: string
}

export interface CaseInteraction {
  id: string
  type: string
  date: string
  summary: string
}

export interface CustomerContextProps {
  account: AccountInfo
  contact: ContactInfo
  openCases: CaseSummary[]
  recentInteractions: CaseInteraction[]
}

export interface KBArticle {
  articleId: string
  title: string
  contentExcerpt: string
  category: string
  url: string
  lastReviewedDate: string
}

export interface KBResultsProps {
  articles: KBArticle[]
  query: string
  totalCount: number
}

export interface SimilarTicket {
  id: string
  caseNumber: string
  subject: string
  resolution: string
  resolvedDate: string
  satisfactionRating: number
}

export interface SimilarTicketsProps {
  tickets: SimilarTicket[]
  query: string
  totalCount: number
}

export interface ReplyDraftProps {
  draft: string
  caseId: string
  tone: string
  contextUsed: string[]
}

export interface CaseCreatedProps {
  case: CaseSummary
}

export interface CaseUpdatedProps {
  case: CaseSummary
  changes: string[]
}

export interface EscalationInfo {
  caseId: string
  reason: string
  escalatedBy: string
  escalatedAt: string
  status: string
  priority: string
}

export interface EscalationCardProps {
  escalation: EscalationInfo
  requiresApproval: boolean
}
