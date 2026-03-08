"use server";

/**
 * Initiate Return Tool - Agentic Return Flow with Idempotency
 *
 * Handles return/exchange requests in 3 messages with zero forms.
 * Uses the policy engine for eligibility checking and option generation.
 *
 * Idempotency protection:
 * - 30-second window prevents duplicate return requests
 * - Same order + reason within window returns cached eligibility result
 * - Critical for preventing multiple return labels for same item
 * - **COMPACT SUMMARY**: Stores ~60 token summary in AIState, not full return object
 *
 * Flow:
 * 1. User mentions return intent → LLM extracts order ID and reason
 * 2. Generate idempotency key from userId + orderId + reason
 * 3. Check Redis for existing operation (within 30s)
 * 4. If cached → return existing eligibility result
 * 5. If new → check eligibility, generate options, cache result
 * 6. User selects option → ActionConfirm for final confirmation
 *
 * @file lib/agent/tools/initiate-return.tsx
 */

import { z } from "zod";
import { ReturnCard } from "@/components/genui/return-card";
import {
  checkReturnEligibility,
  generateReturnOptions,
  isAutoApproved,
  type ReturnCondition,
} from "@/lib/policies/returns";
import {
  withIdempotency,
  generateReturnIdempotencyKey,
  type IdempotencyResult,
} from "@/lib/redis/idempotency";
import { generateToolSummary, type ReturnSummaryData } from "./summarizer";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { sanitizeForLLMContext } from "@/lib/safety/sanitize";

// ============================================================================
// Zod Schema for Return Parameters
// ============================================================================

/**
 * Initiate return parameters schema
 *
 * The LLM extracts these parameters from natural language return requests.
 * Example: "I want to return my headphones from order ORD123, they're defective"
 * → { orderId: "ORD123", reason: "defective", items: [...] }
 */
export const InitiateReturnParams = z.object({
  orderId: z.string().describe("Order ID to return (e.g., ORD123, #12345)"),
  reason: z.enum(["defective", "wrong_item", "not_as_described", "changed_mind"]).describe("Reason for return"),
  condition: z.string().optional().describe("Product condition description if required"),
  items: z
    .array(
      z.object({
        productId: z.string().describe("Product ID to return"),
        quantity: z.number().int().positive().describe("Quantity to return"),
      })
    )
    .describe("Items to return from the order"),
});

export type InitiateReturnParams = z.infer<typeof InitiateReturnParams>;

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Initiate return tool configuration
 *
 * This tool handles the complete return flow with idempotency:
 * 1. Yields intermediate "Checking eligibility..." state
 * 2. Generates idempotency key from userId + orderId + reason
 * 3. Executes with Redis-based idempotency protection (30s window)
 * 4. Returns ReturnCard with eligibility result and options
 */
export const initiateReturnTool = {
  description:
    "Initiate a return or exchange for an order. Checks eligibility, generates refund/replacement options, and handles confirmation. Idempotency-protected to prevent duplicate returns.",
  parameters: InitiateReturnParams,
  generate: async function* (
    params: InitiateReturnParams,
    options?: { userId?: string }
  ) {
    const userId = options?.userId;

    yield <div>Checking return eligibility for order {params.orderId}...</div>;

    // ALWAYS verify order exists before checking eligibility
    const session = await getServerSession(authOptions);
    
    // Find order by ID or tracking number
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: parseInt(params.orderId) || 0 },
          { trackingNumber: params.orderId },
        ],
      },
      include: {
        product: true,
        customer: true,
      },
    });

    if (!order) {
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="font-medium text-red-800 dark:text-red-300">
            Order Not Found
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            I couldn't find order {params.orderId}. Please check your order number and try again.
          </p>
        </div>
      );
    }

    // Verify order belongs to user (check by customer email)
    if (session?.user?.email && order.customer.email !== session.user.email) {
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="font-medium text-red-800 dark:text-red-300">
            Order Not Yours
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            This order belongs to a different account. Please log in with the correct account to initiate a return.
          </p>
        </div>
      );
    }

    // Check return window (30 days from delivery)
    const daysSinceOrder = Math.floor(
      (Date.now() - order.orderDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceOrder > 30) {
      return (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            Return Window Expired
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
            This order was placed {daysSinceOrder} days ago. Our return window is 30 days from delivery.
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
            Need help? Contact our support team for assistance.
          </p>
        </div>
      );
    }

    // Generate idempotency key
    const idempotencyKey = generateReturnIdempotencyKey(
      userId || "anonymous",
      params.orderId,
      params.reason
    );

    try {
      // Execute with idempotency protection (30-second window)
      const result: IdempotencyResult<{
        order: Awaited<ReturnType<typeof fetchOrder>>;
        eligibility: ReturnType<typeof checkReturnEligibility>;
        options: ReturnType<typeof generateReturnOptions>;
        autoApproved: boolean;
      }> = await withIdempotency(
        idempotencyKey,
        async () => {
          // Fetch order details
          const order = await fetchOrder(params.orderId);

          // Calculate days since order
          const daysSinceOrder = Math.floor(
            (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Check eligibility against policy
          const eligibility = checkReturnEligibility(order, params.reason);

          // Generate personalized return options based on policy
          const options = generateReturnOptions(order.total, daysSinceOrder);

          // Check if auto-approved (no manual review needed)
          const autoApproved = isAutoApproved(
            daysSinceOrder,
            params.reason,
            order.total
          );

          return { order, eligibility, options, autoApproved };
        },
        {
          ttlSeconds: 30,
          logOperations: true,
        }
      );

      // Log if this was a cached result (duplicate request)
      if (result.isCached) {
        console.log(
          `[InitiateReturn] Returning cached eligibility (duplicate request within 30s). Order: ${params.orderId}`
        );
      }

      // Handle ineligible returns
      if (!result.data.eligibility.eligible) {
        return (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="font-medium text-red-800 dark:text-red-300">
              Return Not Eligible
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              {result.data.eligibility.reason}
            </p>
          </div>
        );
      }

      // Return ReturnCard with options for user selection
      // Generate compact summary for AIState storage (~60 tokens vs 500+)
      // Get the first (best) return option for summary
      const bestOption = result.data.options[0];
      const returnData: ReturnSummaryData = {
        orderId: result.data.order.id,
        items: params.items.map((item) => ({
          productId: item.productId,
          name: result.data.order.items.find((i) => i.productId === item.productId)?.name || `Product ${item.productId}`,
          quantity: item.quantity,
          refundAmount: bestOption?.value || 0,
        })),
        returnMethod: bestOption?.method === 'replacement' ? 'pickup' : bestOption?.method === 'refund' ? 'dropoff' : 'courier',
        status: result.data.autoApproved ? 'approved' : 'pending',
        estimatedPickup: bestOption?.eta ? new Date(Date.now() + parseInt(bestOption.eta) * 24 * 60 * 60 * 1000) : undefined,
      };
      const summary = generateToolSummary('initiateReturn', returnData);

      // Log summary for debugging (optional)
      console.log(`[InitiateReturn] Summary: ${summary.summary} (${summary.tokenCount} tokens)`);

      // Return ReturnCard with options for user selection
      // Note: Full return data goes to UI component, summary should be stored in AIState
      return (
        <ReturnCard
          order={result.data.order}
          options={result.data.options}
          autoApproved={result.data.autoApproved}
          reason={params.reason}
          items={params.items}
          summary={summary.summary}
        />
      );
    } catch (error) {
      console.error("[InitiateReturn] Error processing return:", error);
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="font-medium text-red-800 dark:text-red-300">
            Return Processing Failed
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {error instanceof Error ? error.message : "Please try again"}
          </p>
        </div>
      );
    }
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetch order details by ID
 *
 * Validates order exists and returns order with items, total, and creation date.
 *
 * @param orderId - The order ID to fetch
 * @returns Order object with items, total, createdAt, etc.
 *
 * @example
 * ```typescript
 * const order = await fetchOrder("ORD123");
 * // Returns order with items, total, createdAt, etc.
 * ```
 */
async function fetchOrder(orderId: string) {
  // Find order by ID or tracking number
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { id: parseInt(orderId) || 0 },
        { trackingNumber: orderId },
      ],
    },
    include: {
      product: true,
      customer: true,
    },
  });

  if (!order) {
    throw new Error(`Order not found: ${orderId}`);
  }

  // CRITICAL: Sanitize ALL database content before LLM context to prevent prompt injection
  return {
    id: String(order.id),
    createdAt: order.orderDate,
    total: order.total,
    items: [
      {
        productId: String(order.productId),
        name: sanitizeForLLMContext(order.product.name),
        category: order.product.category || "general",
        quantity: order.quantity,
      },
    ],
    status: order.status,
    customerId: String(order.customerId),
    customerEmail: order.customer.email,
  };
}

export default initiateReturnTool;
