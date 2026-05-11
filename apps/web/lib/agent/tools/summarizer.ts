import type { ToolSummary } from './types';

/**
 * B2B Procurement Tool Summarizers
 * 
 * Compact summaries for LangGraph tool results (≤60 tokens)
 */

export interface CatalogSearchData {
  items: Array<{ id: string; name: string; price: number; vendor: string }>;
  total: number;
}

export interface PRLineItemData {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PRDraftData {
  id: string;
  lineItems: PRLineItemData[];
  total: number;
  status: string;
}

export interface PurchaseRequestData {
  id: string;
  prNumber: string;
  status: string;
  total: number;
  department: string;
  createdAt: Date;
}

export interface BudgetData {
  spent: number;
  total: number;
  department: string;
}

export interface ApprovalData {
  prId: string;
  prNumber: string;
  status: 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  reason?: string;
}

export interface DisputeData {
  prId: string;
  reason: string;
  status: string;
}

export function summarizeCatalogSearch(data: CatalogSearchData): ToolSummary {
  const summary = `Found ${data.items.length} items. Top: ${data.items[0]?.name} (₹${data.items[0]?.price?.toLocaleString('en-IN')})`;
  return {
    toolName: 'search_catalog',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

export function summarizeBudgetStatus(data: BudgetData): ToolSummary {
  const remaining = data.total - data.spent;
  const pct = ((data.spent / data.total) * 100).toFixed(1);
  const summary = `Budget: ₹${data.spent.toLocaleString('en-IN')}/${data.total.toLocaleString('en-IN')} (${pct}% used, ₹${remaining.toLocaleString('en-IN')} remaining)`;
  return {
    toolName: 'get_budget_status',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

export function summarizeManagePR(
  pr: PRDraftData, 
  action: 'created' | 'updated' | 'item_added' | 'item_removed'
): ToolSummary {
  const itemCount = pr.lineItems?.length ?? 0;
  const summary = action === 'created' 
    ? `PR created with ${itemCount} item(s). Total: ₹${pr.total?.toLocaleString('en-IN')}`
    : action === 'item_added'
    ? `Item added to PR. ${itemCount} item(s). Total: ₹${pr.total?.toLocaleString('en-IN')}`
    : action === 'item_removed'
    ? `Item removed from PR. ${itemCount} item(s). Total: ₹${pr.total?.toLocaleString('en-IN')}`
    : `PR updated. ${itemCount} item(s). Total: ₹${pr.total?.toLocaleString('en-IN')}`;
  return {
    toolName: 'manage_purchase_request',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

export function summarizePRList(prs: PurchaseRequestData[]): ToolSummary {
  if (!prs.length) return { toolName: 'get_purchase_requests', summary: 'No purchase requests found', tokenCount: 5, timestamp: Date.now() };
  const pending = prs.filter(p => p.status === 'PENDING').length;
  const summary = `${prs.length} PR(s). ${pending} pending. Latest: #${prs[0].prNumber} (${prs[0].status})`;
  return {
    toolName: 'get_purchase_requests',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

export function summarizeSubmitPR(pr: PurchaseRequestData): ToolSummary {
  const summary = `PR #${pr.prNumber} submitted for approval. Status: ${pr.status}. Total: ₹${pr.total?.toLocaleString('en-IN')}`;
  return {
    toolName: 'submit_for_approval',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

export function summarizeApproval(data: ApprovalData): ToolSummary {
  const summary = data.status === 'APPROVED'
    ? `PR #${data.prNumber} APPROVED${data.approvedBy ? ` by ${data.approvedBy}` : ''}`
    : `PR #${data.prNumber} REJECTED${data.reason ? `: ${data.reason}` : ''}`;
  return {
    toolName: 'process_approval',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

export function summarizeDispute(data: DisputeData): ToolSummary {
  const summary = `Dispute raised for PR #${data.prId}. Reason: ${data.reason}. Status: ${data.status}`;
  return {
    toolName: 'raise_dispute',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

export function summarizeError(toolName: string, error: string): ToolSummary {
  const summary = `${toolName} failed: ${error.slice(0, 100)}`;
  return {
    toolName,
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
    error: true,
  };
}