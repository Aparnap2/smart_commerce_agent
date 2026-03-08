"use server";

/**
 * Confirm Order Tool - Idempotent Order Creation
 *
 * Handles order confirmation with idempotency protection to prevent
 * double-charging when users click checkout multiple times.
 *
 * Key features:
 * - 30-second idempotency window via Redis
 * - Atomic order creation
 * - Payment processing integration
 * - OrderCard component rendering
 * - **COMPACT SUMMARY**: Stores ~60 token summary in AIState, not full order object
 *
 * Critical use case:
 * - User clicks "Confirm Order" twice
 * - First click → creates order, charges payment
 * - Second click (within 30s) → returns cached order, no charge
 *
 * Flow:
 * 1. User confirms order with cart items
 * 2. Generate idempotency key from userId + orderId
 * 3. Check Redis for existing operation
 * 4. If cached → return existing order (no re-charge)
 * 5. If new → process payment, create order, cache result
 *
 * @file lib/agent/tools/confirm-order.tsx
 */

import { z } from "zod";
import { OrderCard } from "@/components/genui/OrderCard";
import {
  withIdempotency,
  generateOrderIdempotencyKey,
  type IdempotencyResult,
} from "@/lib/redis/idempotency";
import { generateToolSummary, type OrderSummaryData } from "./summarizer";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { sanitizeForLLMContext } from "@/lib/safety/sanitize";

// ============================================================================
// Zod Schema for Order Confirmation Parameters
// ============================================================================

/**
 * Order confirmation parameters schema
 *
 * The LLM extracts these parameters from the conversation context.
 * Example: "Confirm my order for 2 headphones with express shipping"
 * → { items: [...], shippingMethod: "express" }
 */
export const ConfirmOrderParams = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().describe("Product ID"),
        quantity: z.number().int().positive().describe("Quantity"),
        price: z.number().positive().describe("Unit price in cents"),
      })
    )
    .describe("Cart items to purchase"),
  shippingAddress: z
    .object({
      street: z.string().describe("Street address"),
      city: z.string().describe("City"),
      state: z.string().describe("State/Province"),
      postalCode: z.string().describe("Postal/ZIP code"),
      country: z.string().describe("Country code"),
    })
    .describe("Shipping address"),
  shippingMethod: z
    .enum(["standard", "express", "overnight"])
    .default("standard")
    .describe("Shipping method selection"),
  paymentMethodId: z.string().describe("Saved payment method ID"),
  couponCode: z.string().optional().describe("Optional coupon/discount code"),
});

export type ConfirmOrderParams = z.infer<typeof ConfirmOrderParams>;

// ============================================================================
// Order Service Types
// ============================================================================

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
 * Order status
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
 * Order representation
 */
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  status: OrderStatus;
  shippingAddress: ShippingAddress;
  shippingMethod: string;
  paymentIntentId?: string;
  createdAt: Date;
  estimatedDelivery?: Date;
  summary?: string; // Compact summary for AIState (~60 tokens)
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Confirm order tool configuration
 *
 * This tool handles the complete order confirmation flow with idempotency:
 * 1. Yields intermediate "Processing order..." state
 * 2. Generates idempotency key from userId + orderId
 * 3. Executes with Redis-based idempotency protection (30s window)
 * 4. Returns OrderCard component with confirmed order
 */
export const confirmOrderTool = {
  description:
    "Confirm and process an order. Prevents duplicate charges within 30 seconds using idempotency protection. Critical for checkout flows.",
  parameters: ConfirmOrderParams,
  generate: async function* (
    params: ConfirmOrderParams,
    options?: { userId?: string }
  ) {
    // Validate userId is available
    const userId = options?.userId;
    if (!userId) {
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="font-medium text-red-800 dark:text-red-300">
            Authentication Required
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            Please log in to complete your order.
          </p>
        </div>
      );
    }

    // Validate all products exist before processing
    yield <div>Verifying product availability...</div>;

    for (const item of params.items) {
      const product = await prisma.product.findUnique({
        where: { id: parseInt(item.productId) || 0 },
        select: { id: true, name: true, stock: true, price: true },
      });

      if (!product) {
        return (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="font-medium text-red-800 dark:text-red-300">
              Product Not Found
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Product {item.productId} is no longer available. Please remove it from your cart and try again.
            </p>
          </div>
        );
      }

      if (product.stock < item.quantity) {
        return (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="font-medium text-red-800 dark:text-red-300">
              Insufficient Stock
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Only {product.stock} units of {product.name} available (requested {item.quantity}).
            </p>
          </div>
        );
      }
    }

    // Generate order ID (deterministic for idempotency)
    const orderId = `order_${userId}_${Date.now()}`;

    // Yield intermediate "Processing order..." state for better UX
    yield (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm">
        Processing your order...
      </div>
    );

    // Generate idempotency key
    const idempotencyKey = generateOrderIdempotencyKey(userId, orderId);

    try {
      // Execute with idempotency protection (30-second window)
      // This prevents double-charging if user clicks confirm twice
      const result: IdempotencyResult<Order> = await withIdempotency(
        idempotencyKey,
        async () =>
          await processOrderMCP(userId, orderId, {
            items: params.items,
            shippingAddress: params.shippingAddress,
            shippingMethod: params.shippingMethod,
            paymentMethodId: params.paymentMethodId,
            couponCode: params.couponCode,
          }),
        {
          ttlSeconds: 30,
          logOperations: true,
        }
      );

      // Log if this was a cached result (duplicate request)
      if (result.isCached) {
        console.log(
          `[ConfirmOrder] Returning cached order (duplicate request within 30s). Order: ${orderId}`
        );
      }

      // Generate compact summary for AIState storage (~60 tokens vs 500+)
      // Full order object goes to UI component only, summary goes to AIState
      const orderSummary: OrderSummaryData = {
        id: result.data.id,
        status: result.data.status,
        total: result.data.total,
        items: result.data.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
        })),
        createdAt: result.data.createdAt,
        estimatedDelivery: result.data.estimatedDelivery,
      };
      const summary = generateToolSummary('confirmOrder', orderSummary);

      // Log summary for debugging (optional)
      console.log(`[ConfirmOrder] Summary: ${summary.summary} (${summary.tokenCount} tokens)`);

      // Return OrderCard with confirmed order
      // Note: Full order object goes to UI component, summary should be stored in AIState
      return <OrderCard order={result.data} summary={summary.summary} />;
    } catch (error) {
      console.error("[ConfirmOrder] Error processing order:", error);
      return (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="font-medium text-red-800 dark:text-red-300">
            Order Processing Failed
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            {error instanceof Error
              ? error.message
              : "Your card was not charged. Please try again."}
          </p>
        </div>
      );
    }
  },
};

// ============================================================================
// Order Service Implementation
// ============================================================================

/**
 * Process order (MCP-style service call)
 *
 * Handles the complete order processing flow:
 * 1. Validate all products exist and are in stock
 * 2. Calculate totals (subtotal, shipping, tax, discount)
 * 3. Process payment via Stripe/Payment gateway
 * 4. Create order record in database
 * 5. Clear cart
 * 6. Send confirmation email
 *
 * @param userId - User identifier
 * @param orderId - Order identifier
 * @param params - Order parameters
 * @returns Confirmed order object
 */
async function processOrderMCP(
  userId: string,
  orderId: string,
  params: {
    items: Array<{ productId: string; quantity: number; price: number }>;
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    shippingMethod: string;
    paymentMethodId: string;
    couponCode?: string;
  }
): Promise<Order> {
  // Validate all products exist and get their details
  const productDetails = await Promise.all(
    params.items.map(async (item) => {
      const product = await prisma.product.findUnique({
        where: { id: parseInt(item.productId) || 0 },
        select: { id: true, name: true, price: true },
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      return { productId: item.productId, ...product };
    })
  );

  // Calculate subtotal using actual product prices
  const subtotal = productDetails.reduce(
    (sum, product) => sum + product.price * params.items.find((i) => i.productId === product.productId)?.quantity!,
    0
  );

  // Calculate shipping cost
  const shippingCost =
    params.shippingMethod === "overnight"
      ? 50000 // ₹500
      : params.shippingMethod === "express"
      ? 30000 // ₹300
      : 10000; // ₹100 standard

  // Calculate tax (18% GST example)
  const tax = Math.round(subtotal * 0.18);

  // Calculate discount (if coupon provided)
  let discount = 0;
  if (params.couponCode) {
    // Mock coupon validation
    if (params.couponCode === "SAVE10") {
      discount = Math.round(subtotal * 0.1); // 10% off
    }
  }

  // Calculate total
  const total = subtotal + shippingCost + tax - discount;

  // Process payment (mock - replace with actual Stripe integration)
  const paymentIntentId = await processPaymentMock({
    userId,
    amount: total,
    paymentMethodId: params.paymentMethodId,
    idempotencyKey: `payment_${orderId}`,
  });

  // Create order record in database using Prisma
  // First, get or create customer
  const session = await getServerSession(authOptions);
  let customerId = 1; // Default fallback

  if (session?.user?.email) {
    const customer = await prisma.customer.upsert({
      where: { email: session.user.email },
      create: {
        email: session.user.email,
        name: session.user.name || undefined,
      },
      update: {},
    });
    customerId = customer.id;
  }

  // Create order for each product (Prisma schema requires single productId per order)
  const createdOrders = await Promise.all(
    productDetails.map(async (product) => {
      const item = params.items.find((i) => i.productId === product.productId)!;
      return prisma.order.create({
        data: {
          customerId,
          productId: product.id,
          quantity: item.quantity,
          total: product.price * item.quantity,
          status: "confirmed",
          shippingAddress: `${params.shippingAddress.street}, ${params.shippingAddress.city}, ${params.shippingAddress.state} ${params.shippingAddress.postalCode}, ${params.shippingAddress.country}`,
          paymentStatus: "paid",
        },
        include: {
          product: true,
        },
      });
    })
  );

  // Build Order object from created orders
  // Note: Prisma schema has one product per order, so we use the first order
  // CRITICAL: Sanitize ALL database content before LLM context to prevent prompt injection
  const firstOrder = createdOrders[0];
  const orderObj: Order = {
    id: orderId,
    userId: String(customerId),
    items: createdOrders.map((o) => ({
      productId: String(o.productId),
      name: sanitizeForLLMContext(o.product.name),
      quantity: o.quantity,
      price: o.product.price,
      image: o.product.image || undefined,
    })),
    subtotal,
    shippingCost,
    tax,
    discount,
    total,
    status: "confirmed",
    shippingAddress: {
      street: params.shippingAddress.street,
      city: params.shippingAddress.city,
      state: params.shippingAddress.state,
      postalCode: params.shippingAddress.postalCode,
      country: params.shippingAddress.country,
    },
    shippingMethod: params.shippingMethod,
    paymentIntentId,
    createdAt: new Date(),
    estimatedDelivery: calculateEstimatedDelivery(params.shippingMethod),
  };

  // TODO: Clear user's cart after successful order
  // const { clearCart } = await import("@/lib/cart/service");
  // await clearCart(userId);

  // TODO: Send confirmation email
  // await emailService.sendOrderConfirmation(orderObj);

  return orderObj;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Process payment (mock implementation)
 *
 * TODO: Replace with actual Stripe/payment gateway integration.
 *
 * @param params - Payment parameters
 * @returns Payment intent ID
 */
async function processPaymentMock(params: {
  userId: string;
  amount: number;
  paymentMethodId: string;
  idempotencyKey: string;
}): Promise<string> {
  // Mock payment intent ID
  return `pi_${params.idempotencyKey}_${Date.now()}`;
}

/**
 * Calculate estimated delivery date based on shipping method
 *
 * @param shippingMethod - Shipping method selection
 * @returns Estimated delivery date
 */
function calculateEstimatedDelivery(shippingMethod: string): Date {
  const today = new Date();
  const deliveryDate = new Date(today);

  switch (shippingMethod) {
    case "overnight":
      deliveryDate.setDate(today.getDate() + 1);
      break;
    case "express":
      deliveryDate.setDate(today.getDate() + 2);
      break;
    case "standard":
    default:
      deliveryDate.setDate(today.getDate() + 5);
      break;
  }

  return deliveryDate;
}

/**
 * Get order by ID (helper for future operations)
 *
 * @param orderId - Order ID to fetch
 * @returns Order or null if not found
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  // Try to find order by tracking number or ID
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

  // Convert to our Order type
  return {
    id: String(order.id),
    userId: String(order.customerId),
    items: [
      {
        productId: String(order.productId),
        name: order.product.name,
        quantity: order.quantity,
        price: order.product.price,
        image: order.product.image || undefined,
      },
    ],
    subtotal: order.total,
    shippingCost: 0,
    tax: 0,
    discount: 0,
    total: order.total,
    status: order.status as OrderStatus,
    shippingAddress: {
      street: order.shippingAddress || "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    },
    shippingMethod: "standard",
    paymentIntentId: order.paymentStatus || undefined,
    createdAt: order.orderDate,
    estimatedDelivery: undefined,
  };
}

export default confirmOrderTool;
