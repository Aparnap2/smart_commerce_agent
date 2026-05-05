/**
 * GenUI Action Types and Registry
 * 
 * B2B Procurement - Type definitions for CopilotKit GenUI actions
 */

import { z } from 'zod';

export const CatalogItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  vendor: z.string(),
  category: z.string(),
  status: z.enum(['active', 'inactive']),
  stock: z.number(),
});

export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const PRLineItemSchema = z.object({
  id: z.string(),
  catalogItemId: z.string(),
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  sku: z.string().optional(),
});

export type PRLineItem = z.infer<typeof PRLineItemSchema>;

export const PurchaseRequestSchema = z.object({
  id: z.string(),
  prNumber: z.string(),
  status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'DISPUTED']),
  total: z.number(),
  department: z.string(),
  requestedBy: z.string(),
  items: z.array(PRLineItemSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PurchaseRequest = z.infer<typeof PurchaseRequestSchema>;

export interface GenUIActionParams {
  showCatalogGrid: {
    items: CatalogItem[];
  };
  showPRDraft: {
    items: PRLineItem[];
    total: number;
  };
  showPRList: {
    requests: PurchaseRequest[];
  };
  showBudgetGauge: {
    spent: number;
    total: number;
    department: string;
  };
  showBudgetAlert: {
    percentage: number;
    message: string;
  };
  showApprovalCard: {
    pr: PurchaseRequest;
  };
  showDisputeCard: {
    pr: PurchaseRequest;
    reason: string;
  };
  showPRSubmitted: {
    prNumber: string;
    status: string;
  };
}

export type GenUIActionName = keyof GenUIActionParams;