/**
 * MCP Tool Types
 *
 * Type definitions for MCP tools and their parameters.
 *
 * @packageDocumentation
 */

import type { z } from 'zod';

/**
 * Generic tool result type
 */
export type ToolResult = {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    cached?: boolean;
  };
};

/**
 * Base tool interface
 */
export interface Tool<T = Record<string, unknown>> {
  /** Tool name */
  name: string;
  /** Human-readable title */
  title: string;
  /** Description of what the tool does */
  description: string;
  /** Parameter schema for validation */
  parameters: z.ZodType<T>;
  /** Whether user ID is required */
  requireUserId: boolean;
  /** Execute the tool */
  execute: (args: T, userId: string | null) => Promise<ToolResult>;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  /** Current user ID */
  userId: string;
  /** Request metadata */
  metadata?: Record<string, unknown>;
  /** Request timestamp */
  timestamp: Date;
}

/**
 * Tool categories for organization
 */
export type ToolCategory =
  | 'orders'
  | 'products'
  | 'refunds'
  | 'support'
  | 'cart'
  | 'account';

/**
 * Tool definition with category
 */
export interface CategorizedTool extends Tool {
  category: ToolCategory;
  examples?: string[];
  seeAlso?: string[];
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Order-related tool result
 */
export interface OrderToolResult extends ToolResult {
  data?: {
    orderNumber: string;
    status: string;
    items: Array<{
      productId: string;
      name: string;
      quantity: number;
      price: number;
    }>;
    total: number;
    shippingAddress?: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
}

/**
 * Product-related tool result
 */
export interface ProductToolResult extends ToolResult {
  data?: {
    productId: string;
    sku: string;
    name: string;
    description?: string;
    price: number;
    availability: string;
    imageUrl?: string;
  };
}

/**
 * Refund-related tool result
 */
export interface RefundToolResult extends ToolResult {
  data?: {
    refundId: string;
    status: string;
    amount: number;
    reason: string;
    createdAt: string;
    processedAt?: string;
  };
}

/**
 * Support ticket tool result
 */
export interface TicketToolResult extends ToolResult {
  data?: {
    ticketId: string;
    status: string;
    subject: string;
    priority: string;
    category: string;
    createdAt: string;
    updatedAt?: string;
    messages?: Array<{
      author: string;
      text: string;
      timestamp: string;
    }>;
  };
}

/**
 * Cart tool result
 */
export interface CartToolResult extends ToolResult {
  data?: {
    cartId: string;
    items: Array<{
      productId: string;
      name: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    total: number;
  };
}

/**
 * Search result type
 */
export interface SearchResult<T> {
  items: T[];
  total: number;
  query: string;
  page: number;
  pageSize: number;
}

/**
 * Error codes for tool execution
 */
export enum ToolErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_INPUT = 'INVALID_INPUT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

/**
 * Tool error class
 */
export class ToolError extends Error {
  code: ToolErrorCode;
  details?: Record<string, unknown>;

  constructor(message: string, code: ToolErrorCode = ToolErrorCode.INTERNAL_ERROR, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ToolError';
    this.code = code;
    this.details = details;
  }
}
