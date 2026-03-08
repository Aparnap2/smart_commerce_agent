"use server";

/**
 * Process Refund Tool - Idempotent Refund Processing
 *
 * Handles refund processing with idempotency protection to prevent
 * double-refunds when agents retry failed requests or users click multiple times.
 *
 * Key features:
 * - 30-second idempotency window via Redis
 * - Atomic refund operations
 * - Stripe/payment gateway integration
 * - Refund status component rendering
 * - **COMPACT SUMMARY**: Stores ~50 token summary in AIState, not full refund object
 *
 * Critical use case:
 * - Agent processes refund for returned item
 * - Network timeout → agent retries
 * - First request → processes refund
 * - Retry (within 30s) → returns cached refund, no re-charge
 *
 * Flow:
 * 1. Agent/user requests refund for order
 * 2. Generate idempotency key from orderId + amount + reason
 * 3. Check Redis for existing operation
 * 4. If cached → return existing refund result
 * 5. If new → process refund via Stripe, cache result
 *
 * @file lib/agent/tools/process-refund.tsx
 */

import { z } from "zod";
import {
  withIdempotency,
  generateRefundIdempotencyKey,
  type IdempotencyResult,
} from "@/lib/redis/idempotency";
import { generateToolSummary, type RefundSummaryData } from "./summarizer";
import { sanitizeForLLMContext } from "@/lib/safety/sanitize";

// ============================================================================
// Zod Schema for Refund Parameters
// ============================================================================

/**
 * Process refund parameters schema
 *
 * The LLM extracts these parameters from refund requests.
 * Example: "Process full refund for order ORD123 due to defective item"
 * → { orderId: "ORD123", amount: 11990, reason: "defective" }
 */
export const ProcessRefundParams = z.object({
  orderId: z.string().describe("Order ID to refund (e.g., ORD123, #12345)"),
  amount: z
    .number()
    .int()
    .positive()
    .describe("Refund amount in cents (e.g., 11990 for ₹119.90)"),
  reason: z
    .enum([
      "defective",
      "wrong_item",
      "not_as_described",
      "changed_mind",
      "late_delivery",
      "customer_request",
    ])
    .describe("Reason for refund"),
  refundType: z
    .enum(["full", "partial"])
    .default("full")
    .describe("Type of refund: full or partial"),
  items: z
    .array(
      z.object({
        productId: z.string().describe("Product ID being refunded"),
        quantity: z.number().int().positive().describe("Quantity being refunded"),
        refundAmount: z.number().positive().describe("Refund amount for this item"),
      })
    )
    .optional()
    .describe("Specific items being refunded (for partial refunds)"),
});

export type ProcessRefundParams = z.infer<typeof ProcessRefundParams>;

// ============================================================================
// Refund Service Types
// ============================================================================

/**
 * Refund status
 */
export type RefundStatusType =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

/**
 * Refund representation
 */
export interface Refund {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: RefundStatusType;
  reason: string;
  refundType: "full" | "partial";
  stripeRefundId?: string;
  paymentIntentId?: string;
  items?: Array<{
    productId: string;
    quantity: number;
    refundAmount: number;
  }>;
  metadata?: Record<string, string>;
  createdAt: Date;
  processedAt?: Date;
  failureReason?: string;
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Process refund tool configuration
 *
 * This tool handles the complete refund flow with idempotency:
 * 1. Yields intermediate "Processing refund..." state
 * 2. Generates idempotency key from orderId + amount + reason
 * 3. Executes with Redis-based idempotency protection (30s window)
 * 4. Returns RefundStatus component with refund result
 */
export const processRefundTool = {
  description:
    "Process a refund for an order. Prevents duplicate refunds within 30 seconds using idempotency protection. Critical for customer service workflows.",
  parameters: ProcessRefundParams,
  generate: async function* (
    params: ProcessRefundParams,
    options?: { userId?: string; agentId?: string }
  ) {
    // Validate agent/user is authorized
    const agentId = options?.agentId || options?.userId;
    if (!agentId) {
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="font-medium text-red-800 dark:text-red-300">
            Authorization Required
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            Agent authentication required to process refunds.
          </p>
        </div>
      );
    }

    // Yield intermediate "Processing refund..." state for better UX
    yield (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm">
        Processing refund of ₹{(params.amount / 100).toFixed(2)} for order{" "}
        {params.orderId}...
      </div>
    );

    // Generate idempotency key
    const idempotencyKey = generateRefundIdempotencyKey(
      params.orderId,
      params.amount,
      params.reason
    );

    try {
      // Execute with idempotency protection (30-second window)
      // This prevents double-refunds if request is retried
      const result: IdempotencyResult<Refund> = await withIdempotency(
        idempotencyKey,
        async () =>
          await processRefundMCP(agentId, {
            orderId: params.orderId,
            amount: params.amount,
            reason: params.reason,
            refundType: params.refundType,
            items: params.items,
          }),
        {
          ttlSeconds: 30,
          logOperations: true,
        }
      );

      // Log if this was a cached result (duplicate request)
      if (result.isCached) {
        console.log(
          `[ProcessRefund] Returning cached refund (duplicate request within 30s). Order: ${params.orderId}`
        );
      }

      // Generate compact summary for AIState storage (~50 tokens vs 400+)
      // Full refund object goes to UI component only, summary goes to AIState
      const refundSummary: RefundSummaryData = {
        id: result.data.id,
        orderId: result.data.orderId,
        amount: result.data.amount,
        status: result.data.status,
        reason: result.data.reason,
        processedAt: result.data.processedAt,
      };
      const summary = generateToolSummary('processRefund', refundSummary);

      // Log summary for debugging (optional)
      console.log(`[ProcessRefund] Summary: ${summary.summary} (${summary.tokenCount} tokens)`);

      // Return refund status card
      // Note: Full refund object goes to UI component, summary should be stored in AIState
      return <RefundResultCard refund={result.data} summary={summary.summary} />;
    } catch (error) {
      console.error("[ProcessRefund] Error processing refund:", error);
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="font-medium text-red-800 dark:text-red-300">
            Refund Processing Failed
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {error instanceof Error
              ? error.message
              : "Refund was not processed. Please try again."}
          </p>
        </div>
      );
    }
  },
};

// ============================================================================
// Refund Service Implementation
// ============================================================================

/**
 * Process refund (MCP-style service call)
 *
 * Handles the complete refund processing flow:
 * 1. Validate refund eligibility
 * 2. Process refund via Stripe/payment gateway
 * 3. Update order refund status in database
 * 4. Send refund confirmation email
 * 5. Update inventory if items returned
 *
 * TODO: Replace with actual refund service / MCP call in production.
 *
 * @param agentId - Agent/user processing the refund
 * @param params - Refund parameters
 * @returns Processed refund object
 */
async function processRefundMCP(
  agentId: string,
  params: {
    orderId: string;
    amount: number;
    reason: string;
    refundType: "full" | "partial";
    items?: Array<{
      productId: string;
      quantity: number;
      refundAmount: number;
    }>;
  }
): Promise<Refund> {
  // TODO: Replace with actual refund service call
  // Example: return await refundService.process(agentId, params);

  // Simulate payment gateway delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Fetch order to get payment intent ID
  const order = await fetchOrderById(params.orderId);

  if (!order) {
    throw new Error(`Order not found: ${params.orderId}`);
  }

  // Validate refund amount
  if (params.amount > order.total) {
    throw new Error(
      `Refund amount (${params.amount}) exceeds order total (${order.total})`
    );
  }

  // Process refund via Stripe (mock)
  const stripeRefund = await processStripeRefundMock({
    paymentIntentId: order.paymentIntentId || `pi_${params.orderId}`,
    amount: params.amount,
    reason: params.reason,
    idempotencyKey: `refund_${params.orderId}_${params.amount}_${Date.now()}`,
  });

  // Create refund record
  const refund: Refund = {
    id: `ref_${params.orderId}_${Date.now()}`,
    orderId: params.orderId,
    amount: params.amount,
    currency: "inr",
    status: stripeRefund.status,
    reason: params.reason,
    refundType: params.refundType,
    stripeRefundId: stripeRefund.id,
    paymentIntentId: order.paymentIntentId,
    items: params.items,
    metadata: {
      processedBy: agentId,
      originalAmount: order.total.toString(),
      refundPercentage: ((params.amount / order.total) * 100).toFixed(2),
    },
    createdAt: new Date(),
    processedAt: new Date(),
  };

  // TODO: Update order refund status in database
  // await orderService.updateRefundStatus(params.orderId, {
  //   refundStatus: 'refunded',
  //   refundedAmount: params.amount,
  //   lastRefundId: refund.id,
  // });

  // TODO: Send refund confirmation email
  // await emailService.sendRefundConfirmation(order.customerEmail, refund);

  // TODO: Update inventory if items being returned
  // if (params.items) {
  //   await inventoryService.returnItems(params.items);
  // }

  return refund;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch order by ID (mock implementation)
 *
 * TODO: Replace with actual order service call.
 *
 * @param orderId - Order ID to fetch
 * @returns Order object or null
 */
async function fetchOrderById(orderId: string): Promise<{
  id: string;
  total: number;
  paymentIntentId?: string;
  customerId: string;
  customerEmail?: string;
} | null> {
  // Mock implementation
  // TODO: Replace with actual order service call
  return {
    id: orderId,
    total: 1199000, // ₹11,990.00
    paymentIntentId: `pi_${orderId}_mock`,
    customerId: "cust_mock_123",
    customerEmail: "customer@example.com",
  };
}

/**
 * Process Stripe refund (mock implementation)
 *
 * TODO: Replace with actual Stripe SDK integration.
 *
 * @param params - Stripe refund parameters
 * @returns Stripe refund response
 */
async function processStripeRefundMock(params: {
  paymentIntentId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}): Promise<{
  id: string;
  status: RefundStatusType;
  amount: number;
  currency: string;
}> {
  // Simulate Stripe API delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Mock Stripe refund response
  return {
    id: `re_${params.idempotencyKey}`,
    status: "succeeded",
    amount: params.amount,
    currency: "inr",
  };
}

/**
 * Get refund by ID (helper for future operations)
 *
 * @param refundId - Refund ID to fetch
 * @returns Refund or null if not found
 */
export async function getRefundById(refundId: string): Promise<Refund | null> {
  // TODO: Replace with actual refund service call
  // Example: return await refundService.getRefund(refundId);

  // Mock implementation
  return null;
}

/**
 * Get refunds by order ID (helper for order history)
 *
 * @param orderId - Order ID to fetch refunds for
 * @returns Array of refunds
 */
export async function getRefundsByOrderId(
  orderId: string
): Promise<Refund[]> {
  // TODO: Replace with actual refund service call
  // Example: return await refundService.getRefundsByOrder(orderId);

  // Mock implementation
  return [];
}

// ============================================================================
// Refund Result Card Component
// ============================================================================

/**
 * Refund result card component
 *
 * Displays the result of a refund processing operation.
 * Used by the process-refund tool to show refund confirmation.
 */
function RefundResultCard({ refund, summary }: { refund: Refund; summary?: string }) {
  const statusColors = {
    succeeded: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300",
    processing: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300",
    pending: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300",
    failed: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300",
    cancelled: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-300",
  };

  const statusIcons = {
    succeeded: "✓",
    processing: "⏳",
    pending: "⏱",
    failed: "✗",
    cancelled: "⊘",
  };

  const statusLabels = {
    succeeded: "Refund Completed",
    processing: "Processing Refund",
    pending: "Refund Pending",
    failed: "Refund Failed",
    cancelled: "Refund Cancelled",
  };

  return (
    <div className={`p-4 rounded-lg border ${statusColors[refund.status]}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{statusIcons[refund.status]}</span>
        <div className="flex-1">
          <p className="font-semibold">{statusLabels[refund.status]}</p>
          <p className="text-sm mt-1 opacity-90">
            Refund of ₹{(refund.amount / 100).toFixed(2)} for order {refund.orderId}
          </p>
          {refund.stripeRefundId && (
            <p className="text-xs mt-2 opacity-75">
              Refund ID: {refund.stripeRefundId}
            </p>
          )}
          {refund.failureReason && (
            <p className="text-sm mt-2 font-medium">{refund.failureReason}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default processRefundTool;
