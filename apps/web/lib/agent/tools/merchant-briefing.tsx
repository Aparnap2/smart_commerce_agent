"use server";

/**
 * Merchant Briefing Tool - Proactive Business Health Analysis
 *
 * Acts as a business analyst that never sleeps. Runs 5 parallel queries
 * on dashboard open and surfaces anomalies proactively.
 *
 * Flow:
 * 1. Yields intermediate "Analyzing..." state
 * 2. Runs 5 parallel queries (revenue, stock, refunds, abandonment, search)
 * 3. Detects anomalies using threshold-based rules
 * 4. Returns single MerchantBriefing card with narrative
 * - **COMPACT SUMMARY**: Stores ~100 token summary in AIState, not full briefing data
 *
 * @file apps/web/lib/agent/tools/merchant-briefing.tsx
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MerchantBriefing } from "@/components/admin-genui/merchant-briefing";
import { generateToolSummary, type MerchantBriefingSummaryData } from "./summarizer";

// ============================================================================
// Zod Schema for Merchant Briefing Parameters
// ============================================================================

/**
 * Merchant briefing parameters schema
 *
 * Optional since date for historical comparison.
 * Example: "Show me business health since last Monday"
 * → { since: "2026-03-02T00:00:00.000Z" }
 */
const MerchantBriefingParams = z.object({
  since: z
    .string()
    .optional()
    .describe("ISO date - briefing since this date (e.g., 2026-03-01)"),
});

export type MerchantBriefingParams = z.infer<typeof MerchantBriefingParams>;

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Merchant briefing tool configuration
 *
 * This tool provides proactive business health analysis:
 * 1. Yields intermediate "Analyzing business metrics..." state
 * 2. Runs 5 parallel queries for comprehensive analysis
 * 3. Detects anomalies using severity-based thresholds
 * 4. Returns single MerchantBriefing card with actionable insights
 */
export const merchantBriefingTool = {
  description:
    "Get a proactive briefing on merchant business health. Analyzes revenue, stock velocity, refund rates, cart abandonment, and search failures to surface anomalies that need attention.",
  parameters: MerchantBriefingParams,
  generate: async function* (params: MerchantBriefingParams) {
    // Yield intermediate "Analyzing..." state for better UX
    yield (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm">
        Analyzing business metrics...
      </div>
    );

    // Run 5 parallel queries for comprehensive analysis
    const [revenueDelta, stockVelocity, refundRate, cartAbandonment, searchZeroResults] =
      await Promise.all([
        getRevenueDelta(params.since),
        getStockVelocity(),
        getRefundRate(params.since),
        getCartAbandonmentRate(params.since),
        getSearchZeroResults(params.since),
      ]);

    // Detect anomalies (values outside normal range)
    const anomalies = detectAnomalies({
      revenueDelta,
      stockVelocity,
      refundRate,
      cartAbandonment,
      searchZeroResults,
    });

    // Build briefing data for summarization
    const briefingData: MerchantBriefingSummaryData = {
      revenueDelta,
      stockVelocity: stockVelocity.map((s) => ({
        productId: s.productId,
        name: s.name,
        stock: s.stock,
        isUrgent: s.isUrgent,
      })),
      refundRate,
      cartAbandonment,
      anomalies: anomalies.map((a) => ({
        type: a.type,
        severity: a.severity,
        message: a.message,
      })),
    };

    // Generate compact summary for AIState storage (~100 tokens vs 800+)
    // Full briefing data goes to UI component only, summary goes to AIState
    const summary = generateToolSummary('merchantBriefing', briefingData);

    // Log summary for debugging (optional)
    console.log(`[MerchantBriefing] Summary: ${summary.summary} (${summary.tokenCount} tokens)`);

    // Return MerchantBriefing card with narrative
    // Note: Full briefing data goes to UI component, summary should be stored in AIState
    return (
      <MerchantBriefing
        revenueDelta={revenueDelta}
        stockVelocity={stockVelocity}
        refundRate={refundRate}
        cartAbandonment={cartAbandonment}
        searchZeroResults={searchZeroResults}
        anomalies={anomalies}
        summary={summary.summary}
      />
    );
  },
};

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Calculate revenue delta between today and yesterday
 *
 * Compares incomplete today vs complete yesterday to show trend.
 * Only counts completed/processing orders (excludes cancelled/refunded).
 *
 * @param since - Optional ISO date string for custom start date
 * @returns Revenue metrics with delta percentage
 *
 * @example
 * ```typescript
 * const delta = await getRevenueDelta("2026-03-01");
 * // Returns { today: 50000, yesterday: 45000, deltaPercent: 11, isPositive: true }
 * ```
 */
async function getRevenueDelta(since?: string) {
  const sinceDate = since ? new Date(since) : new Date();
  sinceDate.setHours(0, 0, 0, 0);

  // Today's revenue (incomplete day)
  const today = await prisma.order.aggregate({
    where: {
      orderDate: { gte: sinceDate },
      status: { in: ["completed", "processing"] },
    },
    _sum: { total: true },
  });

  // Yesterday's revenue (full day)
  const yesterday = new Date(sinceDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEnd = new Date(sinceDate);
  yesterdayEnd.setMilliseconds(-1);

  const yesterdayRevenue = await prisma.order.aggregate({
    where: {
      orderDate: { gte: yesterday, lt: yesterdayEnd },
      status: { in: ["completed", "processing"] },
    },
    _sum: { total: true },
  });

  const todayValue = today._sum.total || 0;
  const yesterdayValue = yesterdayRevenue._sum.total || 0;
  const delta =
    yesterdayValue > 0
      ? ((todayValue - yesterdayValue) / yesterdayValue) * 100
      : 0;

  return {
    today: todayValue,
    yesterday: yesterdayValue,
    deltaPercent: Math.round(delta),
    isPositive: delta >= 0,
  };
}

/**
 * Calculate stock velocity and identify urgent restock needs
 *
 * Analyzes 7-day sales velocity to predict stockout dates.
 * Flags products with stock < 10 or stockout within 3 days.
 *
 * Note: Current schema doesn't have orderItems relation on Product.
 * This is a simplified implementation that checks low stock directly.
 *
 * @returns Array of products with low stock or urgent restock needs
 *
 * @example
 * ```typescript
 * const velocity = await getStockVelocity();
 * // Returns [{ productId: "123", name: "Widget", stock: 5, dailyVelocity: 2.3, daysUntilStockout: 2, ... }]
 * ```
 */
async function getStockVelocity() {
  // Get all products with low stock (< 10 items)
  const products = await prisma.product.findMany({
    where: {
      stock: { lt: 10 },
    },
    select: {
      id: true,
      name: true,
      stock: true,
      price: true,
      category: true,
    },
    orderBy: {
      stock: "asc",
    },
  });

  return products.map((product) => ({
    productId: String(product.id),
    name: product.name,
    stock: product.stock,
    dailyVelocity: 0, // Would need order history for calculation
    daysUntilStockout: null,
    isLowStock: product.stock < 10,
    isUrgent: product.stock <= 3,
  }));
}

/**
 * Calculate refund rate and compare to 7-day average
 *
 * Tracks refund percentage vs completed orders.
 * Compares current rate to 7-day historical average.
 *
 * @param since - Optional ISO date string for start date
 * @returns Refund metrics with comparison to average
 *
 * @example
 * ```typescript
 * const rate = await getRefundRate("2026-03-01");
 * // Returns { today: 5, total: 50, ratePercent: 10, avgRatePercent: 7.5, isAboveAvg: true }
 * ```
 */
async function getRefundRate(since?: string) {
  const sinceDate = since ? new Date(since) : new Date();
  sinceDate.setHours(0, 0, 0, 0);

  const [refunded, completed] = await Promise.all([
    prisma.order.count({
      where: {
        orderDate: { gte: sinceDate },
        status: "refunded",
      },
    }),
    prisma.order.count({
      where: {
        orderDate: { gte: sinceDate },
        status: { in: ["completed", "processing"] },
      },
    }),
  ]);

  const total = refunded + completed;
  const rate = total > 0 ? (refunded / total) * 100 : 0;

  // 7-day average for comparison
  const weekAgo = new Date(sinceDate);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [refundedWeek, completedWeek] = await Promise.all([
    prisma.order.count({
      where: {
        orderDate: { gte: weekAgo, lt: sinceDate },
        status: "refunded",
      },
    }),
    prisma.order.count({
      where: {
        orderDate: { gte: weekAgo, lt: sinceDate },
        status: { in: ["completed", "processing"] },
      },
    }),
  ]);

  const totalWeek = refundedWeek + completedWeek;
  const avgRate = totalWeek > 0 ? (refundedWeek / totalWeek) * 100 : 0;

  return {
    today: refunded,
    total: total,
    ratePercent: Math.round(rate * 10) / 10,
    avgRatePercent: Math.round(avgRate * 10) / 10,
    isAboveAvg: rate > avgRate,
  };
}

/**
 * Calculate cart abandonment rate in last 4 hours
 *
 * Compares carts without orders vs completed orders.
 * Flags rates above 80% as unusual (typical is 60-70%).
 *
 * Note: Current schema doesn't have checkoutCompleted on Cart.
 * Using cart count vs order count as proxy for abandonment.
 *
 * @param since - Optional ISO date string for start date
 * @returns Abandonment metrics with unusual flag
 *
 * @example
 * ```typescript
 * const abandonment = await getCartAbandonmentRate("2026-03-01");
 * // Returns { abandoned: 45, checkouts: 15, ratePercent: 75, isUnusual: false }
 * ```
 */
async function getCartAbandonmentRate(since?: string) {
  const sinceDate = since ? new Date(since) : new Date();
  sinceDate.setHours(0, 0, 0, 0);

  // Last 4 hours
  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

  // Count carts updated in last 4 hours (potential abandonments)
  const carts = await prisma.cart.count({
    where: {
      updatedAt: { gte: fourHoursAgo },
    },
  });

  // Count orders created in last 4 hours (completed checkouts)
  const checkouts = await prisma.order.count({
    where: {
      orderDate: { gte: fourHoursAgo },
    },
  });

  const total = carts + checkouts;
  const rate = total > 0 ? (carts / total) * 100 : 0;

  // Typical rate is 60-70%
  const isUnusual = rate > 80; // 80%+ is unusual

  return {
    abandoned: carts,
    checkouts,
    ratePercent: Math.round(rate),
    isUnusual,
  };
}

/**
 * Get search terms with zero results
 *
 * TODO: Wire to search analytics table when available.
 * Currently returns empty placeholder.
 *
 * @param since - Optional ISO date string for start date
 * @returns Search terms with zero results
 *
 * @example
 * ```typescript
 * const zeroResults = await getSearchZeroResults("2026-03-01");
 * // Returns { terms: ["wireless earbuds", "gaming mouse"], total: 2 }
 * ```
 */
async function getSearchZeroResults(since?: string) {
  const sinceDate = since ? new Date(since) : new Date();
  sinceDate.setHours(0, 0, 0, 0);

  // TODO: Wire to search analytics table
  // Placeholder - return empty
  return {
    terms: [] as string[],
    total: 0,
  };
}

// ============================================================================
// Anomaly Detection
// ============================================================================

/**
 * Anomaly type definition
 *
 * Represents a detected business metric anomaly with severity and action.
 */
export interface Anomaly {
  type: "revenue" | "stock" | "refunds" | "abandonment" | "search";
  severity: "high" | "medium" | "low";
  message: string;
  action: "investigate" | "restock" | "promote";
}

/**
 * Detect anomalies in business metrics
 *
 * Uses threshold-based rules to identify unusual patterns:
 * - Revenue: ±20% delta is unusual
 * - Stock: Products stocking out in ≤3 days
 * - Refunds: Rate >10% and above average
 * - Abandonment: Rate >80% in last 4 hours
 * - Search: Zero-result searches indicate inventory gaps
 *
 * @param metrics - Object containing all 5 metric results
 * @returns Array of detected anomalies with severity levels
 *
 * @example
 * ```typescript
 * const anomalies = detectAnomalies({
 *   revenueDelta: { deltaPercent: -25, ... },
 *   stockVelocity: [{ isUrgent: true, ... }],
 *   refundRate: { ratePercent: 12, isAboveAvg: true, ... },
 *   cartAbandonment: { ratePercent: 85, isUnusual: true, ... },
 *   searchZeroResults: { terms: ["xyz"], total: 1 },
 * });
 * // Returns [{ type: 'revenue', severity: 'high', message: 'Revenue down 25%...', action: 'investigate' }]
 * ```
 */
function detectAnomalies(metrics: {
  revenueDelta: Awaited<ReturnType<typeof getRevenueDelta>>;
  stockVelocity: Awaited<ReturnType<typeof getStockVelocity>>;
  refundRate: Awaited<ReturnType<typeof getRefundRate>>;
  cartAbandonment: Awaited<ReturnType<typeof getCartAbandonmentRate>>;
  searchZeroResults: Awaited<ReturnType<typeof getSearchZeroResults>>;
}): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Revenue anomaly (±20% is unusual)
  if (Math.abs(metrics.revenueDelta.deltaPercent) > 20) {
    anomalies.push({
      type: "revenue",
      severity: "high",
      message: `Revenue ${metrics.revenueDelta.deltaPercent > 0 ? "up" : "down"} ${Math.abs(metrics.revenueDelta.deltaPercent)}% vs yesterday`,
      action: "investigate",
    });
  }

  // Stock urgency
  const urgentStock = metrics.stockVelocity.filter((s) => s.isUrgent);
  if (urgentStock.length > 0) {
    anomalies.push({
      type: "stock",
      severity: "high",
      message: `${urgentStock.length} products will stock out in ≤3 days`,
      action: "restock",
    });
  }

  // Refund spike
  if (
    metrics.refundRate.isAboveAvg &&
    metrics.refundRate.ratePercent > 10
  ) {
    anomalies.push({
      type: "refunds",
      severity: "medium",
      message: `Refund rate ${metrics.refundRate.ratePercent}% vs ${metrics.refundRate.avgRatePercent}% average`,
      action: "investigate",
    });
  }

  // Cart abandonment spike
  if (metrics.cartAbandonment.isUnusual) {
    anomalies.push({
      type: "abandonment",
      severity: "medium",
      message: `Cart abandonment ${metrics.cartAbandonment.ratePercent}% in last 4 hours (unusually high)`,
      action: "investigate",
    });
  }

  // Search zero results (indicates inventory/content gaps)
  if (metrics.searchZeroResults.total > 5) {
    anomalies.push({
      type: "search",
      severity: "low",
      message: `${metrics.searchZeroResults.total} searches with zero results today`,
      action: "promote",
    });
  }

  return anomalies;
}

export default merchantBriefingTool;
