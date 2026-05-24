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
