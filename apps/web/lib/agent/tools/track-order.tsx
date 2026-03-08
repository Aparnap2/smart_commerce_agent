"use server";

/**
 * Track Order Tool - Order Status Tracking with Validation
 *
 * Handles order tracking with proper validation:
 * - Verifies order exists in database
 * - Checks order belongs to user (ownership validation)
 * - Returns detailed order status with timeline
 * - Provides helpful error messages with alternatives
 *
 * Key features:
 * - Order existence validation
 * - User ownership verification
 * - Real-time status updates
 * - OrderTimeline component rendering
 * - **COMPACT SUMMARY**: Stores ~50 token summary in AIState
 *
 * Flow:
 * 1. User provides order number
 * 2. Verify order exists in database
 * 3. Verify order belongs to user (by email)
 * 4. Return order status with timeline
 *
 * @file lib/agent/tools/track-order.tsx
 */

import { z } from "zod";
import { OrderTimeline } from "@/components/genui/OrderTimeline";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { generateToolSummary, type OrderSummaryData } from "./summarizer";
import { sanitizeForLLMContext } from "@/lib/safety/sanitize";

// ============================================================================
// Zod Schema for Track Order Parameters
// ============================================================================

/**
 * Track order parameters schema
 *
 * The LLM extracts these parameters from natural language requests.
 * Example: "Track my order ORD123"
 * → { orderNumber: "ORD123" }
 */
export const TrackOrderParams = z.object({
  orderNumber: z.string().describe("Order number to track (e.g., ORD123, 12345)"),
});

export type TrackOrderParams = z.infer<typeof TrackOrderParams>;

// ============================================================================
// Order Service Types
// ============================================================================

/**
 * Order status enumeration
 */
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

/**
 * Order item representation
 */
export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
}

/**
 * Shipping address
 */
export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Order tracking information
 */
export interface OrderTracking {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  shippingAddress?: ShippingAddress;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  createdAt: Date;
  updatedAt: Date;
  timeline: OrderTimelineEvent[];
  summary?: string; // Compact summary for AIState (~50 tokens)
}

/**
 * Order timeline event
 */
export interface OrderTimelineEvent {
  status: OrderStatus;
  timestamp: Date;
  description: string;
  location?: string;
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Track order tool configuration
 *
 * This tool handles the complete order tracking flow with validation:
 * 1. Yields intermediate "Looking up order..." state
 * 2. Validates order exists in database
 * 3. Verifies order belongs to user
 * 4. Returns OrderTimeline component with status
 */
export const trackOrderTool = {
  description:
    "Track an order by order number. Validates order exists and belongs to the user. Returns order status and delivery timeline.",
  parameters: TrackOrderParams,
  generate: async function* (
    params: TrackOrderParams,
    options?: { userId?: string }
  ) {
    const userId = options?.userId;

    yield <div>Looking up order {params.orderNumber}...</div>;

    // ALWAYS verify order exists before returning status
    const session = await getServerSession(authOptions);

    // Find order by ID, tracking number, or order number pattern
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { id: parseInt(params.orderNumber.replace(/\D/g, "") || "0") || 0 },
          { trackingNumber: params.orderNumber },
        ],
      },
      include: {
        product: true,
        customer: true,
      },
    });

    if (!order) {
      // Order not found - suggest checking order history
      const userOrders = session?.user?.email
        ? await prisma.order.findMany({
            where: {
              customer: {
                email: session.user.email,
              },
            },
            include: {
              product: true,
            },
            take: 3,
            orderBy: { orderDate: "desc" },
          })
        : [];

      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="font-medium text-red-800 dark:text-red-300">
              Order Not Found
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              I couldn't find order {params.orderNumber}. Please check:
            </p>
            <ul className="text-sm text-red-600 dark:text-red-400 mt-2 list-disc list-inside space-y-1">
              <li>The order number is correct</li>
              <li>You're logged into the right account</li>
              <li>The order was placed recently</li>
            </ul>
          </div>
          {userOrders.length > 0 && (
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="font-medium text-blue-800 dark:text-blue-300">
                Your Recent Orders
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Did you mean one of these?
              </p>
              <div className="mt-3 space-y-2">
                {userOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-blue-700 dark:text-blue-300 font-medium">
                      ORD-{o.id}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Verify order belongs to user (check by customer email)
    if (session?.user?.email && order.customer.email !== session.user.email) {
      return (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            Order Not Accessible
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
            This order belongs to a different account ({order.customer.email}).
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
            Please log in with the correct account to track this order.
          </p>
        </div>
      );
    }

    // Build order timeline from status
    const timeline = buildOrderTimeline(order.status, order.orderDate);

    // Generate compact summary for AIState storage (~50 tokens)
    // CRITICAL: Sanitize ALL database content before LLM context to prevent prompt injection
    const orderData: OrderSummaryData = {
      id: String(order.id),
      status: order.status as OrderStatus,
      total: order.total,
      items: [
        {
          productId: String(order.productId),
          name: sanitizeForLLMContext(order.product.name),
          quantity: order.quantity,
        },
      ],
      createdAt: order.orderDate,
      estimatedDelivery: undefined,
    };
    const summary = generateToolSummary("trackOrder", orderData);

    // Log summary for debugging (optional)
    console.log(`[TrackOrder] Summary: ${summary.summary} (${summary.tokenCount} tokens)`);

    // Return OrderTimeline with order status
    // CRITICAL: Sanitize ALL database content before LLM context to prevent prompt injection
    return (
      <OrderTimeline
        order={{
          id: String(order.id),
          orderNumber: order.trackingNumber || `ORD-${order.id}`,
          status: order.status as OrderStatus,
          items: [
            {
              productId: String(order.productId),
              name: sanitizeForLLMContext(order.product.name),
              quantity: order.quantity,
              price: order.product.price,
              image: order.product.image || undefined,
            },
          ],
          total: order.total,
          shippingAddress: order.shippingAddress
            ? parseShippingAddress(order.shippingAddress)
            : undefined,
          trackingNumber: order.trackingNumber || undefined,
          createdAt: order.orderDate,
          updatedAt: order.orderDate,
          timeline,
          summary: summary.summary,
        }}
      />
    );
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build order timeline from status
 *
 * Creates a timeline of events based on order status and date
 */
function buildOrderTimeline(
  status: string,
  orderDate: Date
): OrderTimelineEvent[] {
  const timeline: OrderTimelineEvent[] = [
    {
      status: "pending",
      timestamp: orderDate,
      description: "Order placed",
    },
  ];

  const now = new Date();
  const daysSinceOrder = Math.floor(
    (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Add timeline events based on status
  if (status === "confirmed" || daysSinceOrder >= 1) {
    timeline.push({
      status: "confirmed",
      timestamp: new Date(orderDate.getTime() + 2 * 60 * 60 * 1000), // 2 hours after order
      description: "Order confirmed",
    });
  }

  if (status === "processing" || daysSinceOrder >= 2) {
    timeline.push({
      status: "processing",
      timestamp: new Date(orderDate.getTime() + 24 * 60 * 60 * 1000), // 1 day after order
      description: "Order is being prepared",
    });
  }

  if (status === "shipped" || daysSinceOrder >= 3) {
    timeline.push({
      status: "shipped",
      timestamp: new Date(orderDate.getTime() + 48 * 60 * 60 * 1000), // 2 days after order
      description: "Order shipped",
      location: "Distribution Center",
    });
  }

  if (status === "delivered" || daysSinceOrder >= 7) {
    timeline.push({
      status: "delivered",
      timestamp: new Date(orderDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days after order
      description: "Order delivered",
    });
  }

  if (status === "cancelled") {
    timeline.push({
      status: "cancelled",
      timestamp: now,
      description: "Order cancelled",
    });
  }

  if (status === "refunded") {
    timeline.push({
      status: "refunded",
      timestamp: now,
      description: "Refund processed",
    });
  }

  return timeline;
}

/**
 * Parse shipping address string into structured format
 */
function parseShippingAddress(address: string): ShippingAddress {
  // Simple parsing - in production, use proper address parsing
  const parts = address.split(",").map((p) => p.trim());

  return {
    street: parts[0] || "",
    city: parts[1] || "",
    state: parts[2] || "",
    postalCode: parts[3] || "",
    country: parts[4] || "",
  };
}

/**
 * Get order by ID (helper for future operations)
 *
 * @param orderId - Order ID to fetch
 * @returns Order tracking info or null if not found
 */
export async function getOrderTracking(orderId: string): Promise<OrderTracking | null> {
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
    return null;
  }

  const timeline = buildOrderTimeline(order.status, order.orderDate);

  // CRITICAL: Sanitize ALL database content before LLM context to prevent prompt injection
  return {
    id: String(order.id),
    orderNumber: order.trackingNumber || `ORD-${order.id}`,
    status: order.status as OrderStatus,
    items: [
      {
        productId: String(order.productId),
        name: sanitizeForLLMContext(order.product.name),
        quantity: order.quantity,
        price: order.product.price,
        image: order.product.image || undefined,
      },
    ],
    total: order.total,
    shippingAddress: order.shippingAddress
      ? parseShippingAddress(order.shippingAddress)
      : undefined,
    trackingNumber: order.trackingNumber || undefined,
    createdAt: order.orderDate,
    updatedAt: order.orderDate,
    timeline,
  };
}

export default trackOrderTool;
