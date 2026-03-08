/**
 * Commerce Event Trigger System
 *
 * Triggers commerce events for proactive agent notifications.
 * Events are stored in the database and processed by the event poller.
 *
 * @file apps/web/lib/events/trigger.ts
 */

import { prisma as db } from "@/lib/prisma";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported commerce event types
 */
export type EventType =
  | "cart_abandoned"
  | "price_drop"
  | "stock_low"
  | "order_delayed"
  | "merchant_anomaly";

/**
 * Event payload types
 */
export interface CartAbandonmentPayload {
  cartId: string;
  cartTotal: number;
  itemCount: number;
  productNames?: string[];
  lastUpdatedAt?: Date;
}

export interface PriceDropPayload {
  productId: number;
  productName: string;
  oldPrice: number;
  newPrice: number;
  discountPercentage: number;
}

export interface StockLowPayload {
  productId: number;
  productName: string;
  currentStock: number;
  threshold: number;
}

export interface OrderDelayedPayload {
  orderId: number;
  orderNumber: string;
  expectedDelivery: Date;
  newDelivery?: Date;
  reason: string;
}

export interface MerchantAnomalyPayload {
  anomalyType: string;
  description: string;
  severity: "low" | "medium" | "high";
  affectedEntities?: string[];
}

/**
 * Union type for all event payloads
 */
export type EventPayload =
  | CartAbandonmentPayload
  | PriceDropPayload
  | StockLowPayload
  | OrderDelayedPayload
  | MerchantAnomalyPayload;

// ============================================================================
// Core Event Triggering
// ============================================================================

/**
 * Trigger a commerce event
 *
 * Creates an unprocessed event in the database that will be picked up
 * by the event poller for proactive agent notification.
 *
 * @param type - The type of event to trigger
 * @param payload - Event-specific payload data
 * @param userId - Optional user ID for user-specific events (null for merchant events)
 *
 * @example
 * ```typescript
 * await triggerEvent('cart_abandoned', {
 *   cartId: 'abc123',
 *   cartTotal: 2999,
 *   itemCount: 3,
 * }, 'user-123');
 * ```
 */
export async function triggerEvent(
  type: EventType,
  payload: Record<string, unknown>,
  userId?: string
): Promise<void> {
  try {
    await db.commerceEvent.create({
      data: {
        eventType: type,
        userId,
        payload: payload as any, // Prisma JSON type compatibility
        processed: false,
      },
    });

    console.log(`[Event Trigger] ${type} triggered for user ${userId || "merchant"}`);
  } catch (error) {
    console.error(`[Event Trigger] Failed to trigger ${type}:`, error);
    throw error;
  }
}

// ============================================================================
// Cart Abandonment Events
// ============================================================================

/**
 * Trigger cart abandonment event
 *
 * Called when a user's cart has been inactive for a specified period
 * without completing checkout.
 *
 * @param userId - The user ID who abandoned the cart
 * @param cartId - The cart ID
 * @param cartTotal - Total cart value in cents
 * @param itemCount - Number of items in cart
 * @param productNames - Optional list of product names for personalization
 *
 * @example
 * ```typescript
 * await triggerCartAbandonment(
 *   'user-123',
 *   'cart-abc',
 *   299900,
 *   3,
 *   ['Wireless Headphones', 'USB-C Cable', 'Phone Case']
 * );
 * ```
 */
export async function triggerCartAbandonment(
  userId: string,
  cartId: string,
  cartTotal: number,
  itemCount: number,
  productNames?: string[]
): Promise<void> {
  await triggerEvent(
    "cart_abandoned",
    {
      cartId,
      cartTotal,
      itemCount,
      productNames: productNames || [],
      lastUpdatedAt: new Date(),
    },
    userId
  );
}

// ============================================================================
// Price Drop Events
// ============================================================================

/**
 * Trigger price drop event
 *
 * Called when a product's price is reduced, potentially notifying
 * users who viewed or added the product to their wishlist.
 *
 * @param productId - The product ID
 * @param productName - Product name for notification
 * @param oldPrice - Previous price in cents
 * @param newPrice - New price in cents
 *
 * @example
 * ```typescript
 * await triggerPriceDrop(123, 'Wireless Headphones', 4999, 3999);
 * ```
 */
export async function triggerPriceDrop(
  productId: number,
  productName: string,
  oldPrice: number,
  newPrice: number
): Promise<void> {
  const discountPercentage = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

  await triggerEvent("price_drop", {
    productId,
    productName,
    oldPrice,
    newPrice,
    discountPercentage,
  });
}

// ============================================================================
// Stock Alert Events
// ============================================================================

/**
 * Trigger low stock event
 *
 * Called when product stock falls below a threshold.
 *
 * @param productId - The product ID
 * @param productName - Product name for notification
 * @param currentStock - Current stock level
 * @param threshold - Stock threshold that was crossed
 *
 * @example
 * ```typescript
 * await triggerStockLow(123, 'Wireless Headphones', 5, 10);
 * ```
 */
export async function triggerStockLow(
  productId: number,
  productName: string,
  currentStock: number,
  threshold: number
): Promise<void> {
  await triggerEvent("stock_low", {
    productId,
    productName,
    currentStock,
    threshold,
  });
}

// ============================================================================
// Order Delay Events
// ============================================================================

/**
 * Trigger order delay event
 *
 * Called when an order's delivery is delayed.
 *
 * @param orderId - The order ID
 * @param orderNumber - Human-readable order number
 * @param expectedDelivery - Original expected delivery date
 * @param newDelivery - New expected delivery date (optional)
 * @param reason - Reason for delay
 *
 * @example
 * ```typescript
 * await triggerOrderDelayed(456, 'ORD-2026-001', new Date('2026-03-10'), new Date('2026-03-15'), 'Weather delay');
 * ```
 */
export async function triggerOrderDelayed(
  orderId: number,
  orderNumber: string,
  expectedDelivery: Date,
  reason: string,
  newDelivery?: Date
): Promise<void> {
  await triggerEvent("order_delayed", {
    orderId,
    orderNumber,
    expectedDelivery,
    newDelivery,
    reason,
  });
}

// ============================================================================
// Merchant Anomaly Events
// ============================================================================

/**
 * Trigger merchant anomaly event
 *
 * Called when unusual merchant activity is detected.
 *
 * @param anomalyType - Type of anomaly detected
 * @param description - Detailed description
 * @param severity - Severity level
 * @param affectedEntities - Optional list of affected entities
 *
 * @example
 * ```typescript
 * await triggerMerchantAnomaly(
 *   'inventory_spike',
 *   'Unusual inventory depletion detected',
 *   'high',
 *   ['product-123', 'product-456']
 * );
 * ```
 */
export async function triggerMerchantAnomaly(
  anomalyType: string,
  description: string,
  severity: "low" | "medium" | "high",
  affectedEntities?: string[]
): Promise<void> {
  await triggerEvent("merchant_anomaly", {
    anomalyType,
    description,
    severity,
    affectedEntities,
  });
}
