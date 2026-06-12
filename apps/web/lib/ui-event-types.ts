/**
 * UI Event Type Definitions
 *
 * Types for GenUI components that communicate events back to the agent.
 * These are shared between the component library and the agent SDK.
 */

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
