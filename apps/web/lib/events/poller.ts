/**
 * Commerce Event Poller
 *
 * Azure Function-compatible polling pattern for processing commerce events.
 * Runs every 60 seconds to find and process unprocessed events.
 *
 * NOTE: Uses polling instead of pg_notify because Azure PostgreSQL Flexible Server
 * kills idle connections, making listen/notify unreliable on free tier.
 *
 * @file apps/web/lib/events/poller.ts
 */

import { prisma as db } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis/client";
import type { CommerceEvent } from "@prisma/client";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Polling interval in milliseconds
 * Default: 60 seconds (Azure Function friendly)
 */
const POLL_INTERVAL_MS = 60 * 1000;

/**
 * Maximum events to process per poll cycle
 * Prevents overwhelming the system during backlog
 */
const MAX_EVENTS_PER_POLL = 10;

/**
 * Time window to look for unprocessed events
 * Only processes events created within this window
 */
const EVENT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Rate limiting: Maximum proactive messages per user per time window
 * Prevents message storms that feel like surveillance
 */
const RATE_LIMIT_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
const MAX_PROACTIVE_PER_WINDOW = 1;

// ============================================================================
// Event Priority System
// ============================================================================

/**
 * Priority levels for proactive messages
 * Higher number = more important (will be sent first)
 *
 * Rationale:
 * - cart_abandoned: Direct revenue impact, highest priority
 * - order_delayed: Customer service critical, affects trust
 * - merchant_anomaly: Merchant-facing, operational importance
 * - stock_low: Merchant inventory awareness
 * - price_drop: Nice-to-have, lowest priority
 */
const PRIORITY: Record<string, number> = {
  cart_abandoned: 3,    // Highest - direct revenue impact
  order_delayed: 3,     // Highest - customer service critical
  merchant_anomaly: 2,  // Medium - merchant operational
  stock_low: 2,         // Medium - merchant inventory
  price_drop: 1,        // Low - nice to have
};

// ============================================================================
// Poller Lifecycle
// ============================================================================

/**
 * Start the event poller
 *
 * Sets up an interval that checks for unprocessed events
 * and processes them. Designed to run in serverless environments.
 *
 * @example
 * ```typescript
 * // In your server entry point
 * import { startEventPoller } from '@/lib/events/poller';
 *
 * if (process.env.NODE_ENV === 'production') {
 *   startEventPoller();
 * }
 * ```
 */
export function startEventPoller(): void {
  console.log("[Event Poller] Starting with interval:", POLL_INTERVAL_MS, "ms");

  // Initial poll after a short delay
  setTimeout(pollAndProcessEvents, 1000);

  // Set up recurring polling
  const intervalId = setInterval(pollAndProcessEvents, POLL_INTERVAL_MS);

  // Store interval ID for potential cleanup
  (globalThis as unknown as { _pollerIntervalId?: NodeJS.Timeout })._pollerIntervalId =
    intervalId;

  console.log("[Event Poller] Poller started successfully");
}

/**
 * Stop the event poller
 *
 * Clears the polling interval. Useful for graceful shutdowns.
 */
export function stopEventPoller(): void {
  const intervalId = (
    globalThis as unknown as { _pollerIntervalId?: NodeJS.Timeout }
  )._pollerIntervalId;

  if (intervalId) {
    clearInterval(intervalId);
    (globalThis as unknown as { _pollerIntervalId?: NodeJS.Timeout })._pollerIntervalId =
      undefined;
    console.log("[Event Poller] Poller stopped");
  }
}

// ============================================================================
// Polling Logic
// ============================================================================

/**
 * Poll for unprocessed events and process them
 *
 * Internal function called by the polling interval.
 * Finds events from the last 5 minutes and processes them.
 */
async function pollAndProcessEvents(): Promise<void> {
  const windowStart = new Date(Date.now() - EVENT_WINDOW_MS);

  try {
    // Find unprocessed events within the time window
    const events = await db.commerceEvent.findMany({
      where: {
        processed: false,
        createdAt: {
          gte: windowStart,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: MAX_EVENTS_PER_POLL,
    });

    if (events.length === 0) {
      return; // No events to process
    }

    console.log(`[Event Poller] Found ${events.length} unprocessed events`);

    // Process each event
    for (const event of events) {
      await processEvent(event);
    }
  } catch (error) {
    console.error("[Event Poller] Error during polling:", error);
    // Don't rethrow - we want the poller to continue running
  }
}

// ============================================================================
// Rate Limiting & Priority Queue
// ============================================================================

/**
 * Check if user has reached the proactive message rate limit
 *
 * @param userId - The user ID to check
 * @returns true if rate limited, false if can send
 */
async function isRateLimited(userId: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = `proactive:${userId}:count`;
  
  const recentCount = await redis.get(key);
  
  if (recentCount && parseInt(recentCount, 10) >= MAX_PROACTIVE_PER_WINDOW) {
    return true;
  }
  
  return false;
}

/**
 * Set the rate limit counter for a user
 *
 * @param userId - The user ID
 */
async function setRateLimit(userId: string): Promise<void> {
  const redis = getRedisClient();
  const key = `proactive:${userId}:count`;
  const ttlSeconds = Math.floor(RATE_LIMIT_WINDOW_MS / 1000);
  
  await redis.setex(key, ttlSeconds, "1");
  
  console.log(`[Proactive Rate Limit] Set rate limit for user ${userId}, expires in ${ttlSeconds}s (4 hours)`);
}

/**
 * Get pending unprocessed events for a user
 *
 * @param userId - The user ID
 * @returns Array of pending event types
 */
async function getPendingEvents(userId: string): Promise<string[]> {
  const windowStart = new Date(Date.now() - EVENT_WINDOW_MS);
  
  const pendingEvents = await db.commerceEvent.findMany({
    where: {
      userId: userId,
      processed: false,
      createdAt: {
        gte: windowStart,
      },
    },
    select: {
      eventType: true,
    },
  });
  
  return pendingEvents.map(e => e.eventType);
}

/**
 * Check if event should be sent based on priority
 *
 * Only sends if this event has priority >= highest pending event.
 * Lower priority events are skipped to avoid sending less important
 * messages before more important ones.
 *
 * @param eventType - The type of event to check
 * @param userId - The user ID
 * @returns true if should send, false if should skip
 */
async function shouldSendBasedOnPriority(eventType: string, userId: string): Promise<boolean> {
  const eventPriority = PRIORITY[eventType] || 0;
  
  // Get all pending events for this user
  const pendingEvents = await getPendingEvents(userId);
  
  if (pendingEvents.length === 0) {
    return true; // No pending events, safe to send
  }
  
  // Find highest priority among pending events
  const highestPendingPriority = Math.max(
    ...pendingEvents.map(e => PRIORITY[e] || 0)
  );
  
  // Only send if this event has equal or higher priority
  if (eventPriority < highestPendingPriority) {
    console.log(
      `[Proactive Priority] Skipping ${eventType} (priority: ${eventPriority}) - ` +
      `higher priority event pending (priority: ${highestPendingPriority})`
    );
    return false;
  }
  
  return true;
}

/**
 * Mark an event as processed (skip sending proactive message)
 *
 * @param eventId - The event ID to mark as processed
 */
async function markProcessed(eventId: string): Promise<void> {
  await db.commerceEvent.update({
    where: { id: eventId },
    data: {
      processed: true,
      processedAt: new Date(),
    },
  });
}

// ============================================================================
// Event Processing
// ============================================================================

/**
 * Process a single commerce event
 *
 * Routes the event to the appropriate handler based on event type.
 * Implements rate limiting (max 1 proactive per 4 hours) and priority-based
 * filtering to prevent message storms.
 *
 * @param event - The commerce event to process
 */
async function processEvent(event: CommerceEvent): Promise<void> {
  const eventId = event.id;
  const eventType = event.eventType;
  const userId = event.userId;

  console.log(`[Event Poller] Processing ${eventType} event ${eventId} for user ${userId || "merchant"}`);

  // Skip rate limiting checks for merchant-only events without userId
  if (!userId) {
    console.log(`[Event Poller] Merchant event ${eventId}, processing without rate limit`);
    await processEventHandler(event);
    await markEventAsProcessed(eventId);
    console.log(`[Event Poller] Successfully processed merchant event ${eventId}`);
    return;
  }

  try {
    // Check rate limit: max 1 proactive message per 4-hour window
    const rateLimited = await isRateLimited(userId);
    if (rateLimited) {
      console.log(
        `[Proactive Rate Limit] User ${userId} rate limited - already received proactive message in last 4 hours. ` +
        `Event ${eventType} (${eventId}) will be marked processed without sending.`
      );
      await markProcessed(eventId);
      return;
    }

    // Check priority: only send if this is highest priority pending event
    const shouldSend = await shouldSendBasedOnPriority(eventType, userId);
    if (!shouldSend) {
      console.log(
        `[Proactive Priority] User ${userId} - skipping ${eventType} due to lower priority. ` +
        `Event ${eventId} will be marked processed without sending.`
      );
      await markProcessed(eventId);
      return;
    }

    // Process and send the proactive message
    await processEventHandler(event);

    // Set rate limit after successful send
    await setRateLimit(userId);

    // Mark event as processed
    await markEventAsProcessed(eventId);

    console.log(`[Event Poller] Successfully processed event ${eventId} and sent proactive message to user ${userId}`);
  } catch (error) {
    console.error(`[Event Poller] Failed to process event ${eventId}:`, error);
    // Don't mark as processed - will be retried on next poll
  }
}

/**
 * Process event handler (sends proactive message)
 *
 * Routes to appropriate handler and sends the proactive message.
 * Called only after passing rate limit and priority checks.
 *
 * @param event - The commerce event to process
 */
async function processEventHandler(event: CommerceEvent): Promise<void> {
  const eventType = event.eventType;

  // Route to appropriate handler
  switch (eventType) {
    case "cart_abandoned":
      await handleCartAbandonment(event);
      break;

    case "price_drop":
      await handlePriceDrop(event);
      break;

    case "stock_low":
      await handleStockLow(event);
      break;

    case "order_delayed":
      await handleOrderDelayed(event);
      break;

    case "merchant_anomaly":
      await handleMerchantAnomaly(event);
      break;

    default:
      console.warn(`[Event Poller] Unknown event type: ${eventType}`);
  }
}

/**
 * Mark an event as processed
 *
 * Updates the event record with processed flag and timestamp.
 *
 * @param eventId - The event ID to mark as processed
 */
async function markEventAsProcessed(eventId: string): Promise<void> {
  await db.commerceEvent.update({
    where: { id: eventId },
    data: {
      processed: true,
      processedAt: new Date(),
    },
  });
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle cart abandonment event
 *
 * Generates a proactive message to re-engage the user.
 *
 * @param event - The cart abandonment event
 */
async function handleCartAbandonment(event: CommerceEvent): Promise<void> {
  const payload = event.payload as {
    cartId: string;
    cartTotal: number;
    itemCount: number;
    productNames?: string[];
  };

  const { cartTotal, itemCount, productNames } = payload;

  // Generate personalized message
  const message = generateCartRecoveryMessage(itemCount, cartTotal, productNames);

  console.log(`[Proactive Message] Cart Recovery: ${message}`);

  // TODO: In production, this would:
  // 1. Create a new conversation turn proactively
  // 2. Send push notification / email
  // 3. Log the engagement attempt
  //
  // Example integration:
  // await createProactiveMessage({
  //   userId: event.userId!,
  //   type: 'cart_recovery',
  //   content: message,
  //   metadata: { cartId: payload.cartId },
  // });
}

/**
 * Generate cart recovery message
 *
 * Creates a personalized message based on cart contents.
 *
 * @param itemCount - Number of items in cart
 * @param cartTotal - Total cart value in cents
 * @param productNames - Optional product names for personalization
 * @returns Personalized recovery message
 */
function generateCartRecoveryMessage(
  itemCount: number,
  cartTotal: number,
  productNames?: string[]
): string {
  const formattedTotal = cartTotal.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  // Personalize with product names if available
  if (productNames && productNames.length > 0) {
    const firstProduct = productNames[0];
    return `Still thinking about your ${firstProduct}${itemCount > 1 ? ` and ${itemCount - 1} other item${itemCount > 2 ? "s" : ""}` : ""}? Total: ${formattedTotal}. Want me to hold them while you decide?`;
  }

  // Generic message
  return `Still thinking about your ${itemCount} item${itemCount > 1 ? "s" : ""}? Total: ${formattedTotal}. Want me to hold them while you decide?`;
}

/**
 * Handle price drop event
 *
 * Notifies interested users about price reductions.
 *
 * @param event - The price drop event
 */
async function handlePriceDrop(event: CommerceEvent): Promise<void> {
  const payload = event.payload as {
    productId: number;
    productName: string;
    oldPrice: number;
    newPrice: number;
    discountPercentage: number;
  };

  const { productName, discountPercentage } = payload;

  const message = `Great news! ${productName} is now ${discountPercentage}% off. Ready to grab it?`;

  console.log(`[Proactive Message] Price Drop: ${message}`);

  // TODO: Notify users who viewed/wishlisted this product
}

/**
 * Handle low stock event
 *
 * Creates urgency notifications for low-stock items.
 *
 * @param event - The stock low event
 */
async function handleStockLow(event: CommerceEvent): Promise<void> {
  const payload = event.payload as {
    productId: number;
    productName: string;
    currentStock: number;
    threshold: number;
  };

  const { productName, currentStock } = payload;

  const message = `Hurry! ${productName} is running low - only ${currentStock} left in stock.`;

  console.log(`[Proactive Message] Stock Alert: ${message}`);

  // TODO: Notify users with this item in cart/wishlist
}

/**
 * Handle order delay event
 *
 * Proactively informs customers about delivery delays.
 *
 * @param event - The order delayed event
 */
async function handleOrderDelayed(event: CommerceEvent): Promise<void> {
  const payload = event.payload as {
    orderId: number;
    orderNumber: string;
    expectedDelivery: string;
    newDelivery?: string;
    reason: string;
  };

  const { orderNumber, reason } = payload;

  const message = `Update on order ${orderNumber}: We're experiencing a delay due to ${reason.toLowerCase()}. We'll keep you posted on the new delivery date.`;

  console.log(`[Proactive Message] Order Delay: ${message}`);

  // TODO: Send notification to affected customer
}

/**
 * Handle merchant anomaly event
 *
 * Alerts merchant about unusual activity.
 *
 * @param event - The merchant anomaly event
 */
async function handleMerchantAnomaly(event: CommerceEvent): Promise<void> {
  const payload = event.payload as {
    anomalyType: string;
    description: string;
    severity: "low" | "medium" | "high";
    affectedEntities?: string[];
  };

  const { anomalyType, description, severity } = payload;

  const severityEmoji = {
    low: "ℹ️",
    medium: "⚠️",
    high: "🚨",
  };

  const message = `${severityEmoji[severity]} Merchant Alert: ${anomalyType} - ${description}`;

  console.log(`[Proactive Message] Merchant Anomaly: ${message}`);

  // TODO: Notify merchant dashboard
}
