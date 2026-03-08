/**
 * Tool Result Summarizer
 *
 * Generates compact summaries of tool results for AIState storage.
 * Prevents context window poisoning by storing ~100 token summaries
 * instead of 3000+ token full result arrays.
 *
 * Key principle: Full results go to UI components only, summaries go to AIState.
 *
 * @file lib/agent/tools/summarizer.ts
 */

// ============================================================================
// Summary Types
// ============================================================================

/**
 * Compact tool result summary for AIState storage
 * Target: ~100 tokens vs 3000+ for full results
 */
export interface ToolSummary {
  /** Tool name */
  toolName: string;
  /** Compact text summary (~50-100 tokens) */
  summary: string;
  /** Token count estimate */
  tokenCount: number;
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Product Search Summaries
// ============================================================================

/**
 * Product data for summarization
 */
export interface ProductSummaryData {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  category?: string;
}

/**
 * Generate compact summary for search products tool result
 *
 * @param products - Array of product results
 * @param query - Original search query
 * @param filters - Applied filters
 * @returns Compact summary (~100 tokens)
 *
 * @example
 * ```typescript
 * const summary = summarizeSearchProducts(products, "headphones", { maxPrice: 10000 });
 * // "Found 6 products matching 'headphones'. Top: Sony WH-1000XM5 (₹29,999). Range: ₹2,490 - ₹29,999. All in stock."
 * ```
 */
export function summarizeSearchProducts(
  products: ProductSummaryData[],
  query: string,
  filters?: {
    maxPrice?: number;
    minPrice?: number;
    brand?: string;
    category?: string;
    inStockOnly?: boolean;
  }
): ToolSummary {
  const count = products.length;

  if (count === 0) {
    return {
      toolName: 'searchProducts',
      summary: `No products found matching "${query}".`,
      tokenCount: 15,
      timestamp: Date.now(),
    };
  }

  // Calculate statistics
  const prices = products.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const topProduct = products[0];

  // Build filter description
  const filterParts: string[] = [];
  if (filters?.maxPrice) filterParts.push(`max ₹${filters.maxPrice.toLocaleString()}`);
  if (filters?.minPrice) filterParts.push(`min ₹${filters.minPrice.toLocaleString()}`);
  if (filters?.brand) filterParts.push(`brand: ${filters.brand}`);
  if (filters?.category) filterParts.push(`category: ${filters.category}`);
  if (filters?.inStockOnly) filterParts.push('in-stock only');

  const filterText = filterParts.length > 0 ? ` (${filterParts.join(', ')})` : '';

  // Stock status
  const inStockCount = products.filter((p) => p.inStock).length;
  const stockText =
    inStockCount === count
      ? 'All in stock'
      : inStockCount === 0
        ? 'None in stock'
        : `${inStockCount}/${count} in stock`;

  // Generate summary
  const summary = `Found ${count} product${count !== 1 ? 's' : ''} matching "${query}"${filterText}. Top: ${topProduct.name} (₹${topProduct.price.toLocaleString()}). Range: ₹${minPrice.toLocaleString()} - ₹${maxPrice.toLocaleString()}. ${stockText}.`;

  return {
    toolName: 'searchProducts',
    summary,
    tokenCount: Math.ceil(summary.length / 4), // ~4 chars per token
    timestamp: Date.now(),
  };
}

// ============================================================================
// Cart Operation Summaries
// ============================================================================

/**
 * Cart data for summarization
 */
export interface CartSummaryData {
  id: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  itemCount: number;
}

/**
 * Generate compact summary for add to cart tool result
 *
 * @param cart - Updated cart after adding item
 * @param addedItem - The item that was just added
 * @returns Compact summary (~50 tokens)
 *
 * @example
 * ```typescript
 * const summary = summarizeAddToCart(cart, { productId: 'prod_123', name: 'Sony Headphones', quantity: 2 });
 * // "Added 2 × Sony Headphones to cart. Cart total: ₹59,998. 3 items total."
 * ```
 */
export function summarizeAddToCart(
  cart: CartSummaryData,
  addedItem: { productId: string; name: string; quantity: number }
): ToolSummary {
  const summary = `Added ${addedItem.quantity} × ${addedItem.name} to cart. Cart total: ₹${cart.total.toLocaleString()}. ${cart.itemCount} item${cart.itemCount !== 1 ? 's' : ''} total.`;

  return {
    toolName: 'addToCart',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

// ============================================================================
// Order Operation Summaries
// ============================================================================

/**
 * Order data for summarization
 */
export interface OrderSummaryData {
  id: string;
  status: string;
  total: number;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
  }>;
  createdAt: Date;
  estimatedDelivery?: Date;
}

/**
 * Generate compact summary for confirm order tool result
 *
 * @param order - Confirmed order
 * @returns Compact summary (~60 tokens)
 *
 * @example
 * ```typescript
 * const summary = summarizeConfirmOrder(order);
 * // "Order ORD-123 confirmed — ₹11,990. 2 items. Est. delivery: Mar 15, 2026."
 * ```
 */
export function summarizeConfirmOrder(order: OrderSummaryData): ToolSummary {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryText = order.estimatedDelivery
    ? ` Est. delivery: ${order.estimatedDelivery.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}.`
    : '.';

  const summary = `Order ${order.id} confirmed — ₹${order.total.toLocaleString()}. ${itemCount} item${itemCount !== 1 ? 's' : ''}.${deliveryText} Status: ${order.status}.`;

  return {
    toolName: 'confirmOrder',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

/**
 * Generate compact summary for get orders tool result
 *
 * @param orders - Array of orders
 * @param userEmail - Customer email
 * @returns Compact summary (~70 tokens)
 *
 * @example
 * ```typescript
 * const summary = summarizeGetOrders(orders, "user@example.com");
 * // "Found 5 orders for user@example.com. Most recent: ORD-123 — delivered — ₹11,990. Total spent: ₹54,950."
 * ```
 */
export function summarizeGetOrders(
  orders: OrderSummaryData[],
  userEmail: string
): ToolSummary {
  if (orders.length === 0) {
    return {
      toolName: 'getOrders',
      summary: `No orders found for ${userEmail}.`,
      tokenCount: 15,
      timestamp: Date.now(),
    };
  }

  const mostRecent = orders[0];
  const totalSpent = orders.reduce((sum, order) => sum + order.total, 0);

  const summary = `Found ${orders.length} order${orders.length !== 1 ? 's' : ''} for ${userEmail}. Most recent: ${mostRecent.id} — ${mostRecent.status} — ₹${mostRecent.total.toLocaleString()}. Total spent: ₹${totalSpent.toLocaleString()}.`;

  return {
    toolName: 'getOrders',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

// ============================================================================
// Return Operation Summaries
// ============================================================================

/**
 * Return data for summarization
 */
export interface ReturnSummaryData {
  orderId: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    refundAmount: number;
  }>;
  returnMethod: 'pickup' | 'dropoff' | 'courier';
  status: 'pending' | 'approved' | 'processing' | 'completed';
  estimatedPickup?: Date;
}

/**
 * Generate compact summary for initiate return tool result
 *
 * @param returnData - Return initiation result
 * @returns Compact summary (~60 tokens)
 *
 * @example
 * ```typescript
 * const summary = summarizeInitiateReturn(returnData);
 * // "Return initiated for ORD-123: 1 × Sony Headphones. Method: pickup. Est. pickup: Mar 12, 2026. Refund: ₹11,990."
 * ```
 */
export function summarizeInitiateReturn(returnData: ReturnSummaryData): ToolSummary {
  const itemNames = returnData.items.map((item) => `${item.quantity} × ${item.name}`).join(', ');
  const totalRefund = returnData.items.reduce((sum, item) => sum + item.refundAmount, 0);
  const pickupText = returnData.estimatedPickup
    ? ` Est. pickup: ${returnData.estimatedPickup.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}.`
    : '.';

  const summary = `Return initiated for ${returnData.orderId}: ${itemNames}. Method: ${returnData.returnMethod}.${pickupText} Refund: ₹${totalRefund.toLocaleString()}. Status: ${returnData.status}.`;

  return {
    toolName: 'initiateReturn',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

// ============================================================================
// Refund Operation Summaries
// ============================================================================

/**
 * Refund data for summarization
 */
export interface RefundSummaryData {
  id: string;
  orderId: string;
  amount: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  reason: string;
  processedAt?: Date;
}

/**
 * Generate compact summary for process refund tool result
 *
 * @param refund - Processed refund
 * @returns Compact summary (~50 tokens)
 *
 * @example
 * ```typescript
 * const summary = summarizeProcessRefund(refund);
 * // "Refund REF-123 processed for ORD-456: ₹11,990. Status: succeeded. Reason: defective."
 * ```
 */
export function summarizeProcessRefund(refund: RefundSummaryData): ToolSummary {
  const processedText = refund.processedAt
    ? ` Processed: ${refund.processedAt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}.`
    : '.';

  const summary = `Refund ${refund.id} for ${refund.orderId}: ₹${refund.amount.toLocaleString()}. Status: ${refund.status}. Reason: ${refund.reason}.${processedText}`;

  return {
    toolName: 'processRefund',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

// ============================================================================
// Merchant Briefing Summaries
// ============================================================================

/**
 * Merchant briefing data for summarization
 */
export interface MerchantBriefingSummaryData {
  revenueDelta: {
    today: number;
    yesterday: number;
    deltaPercent: number;
    isPositive: boolean;
  };
  stockVelocity: Array<{
    productId: string;
    name: string;
    stock: number;
    isUrgent: boolean;
  }>;
  refundRate: {
    today: number;
    total: number;
    ratePercent: number;
    avgRatePercent: number;
    isAboveAvg: boolean;
  };
  cartAbandonment: {
    abandoned: number;
    checkouts: number;
    ratePercent: number;
    isUnusual: boolean;
  };
  anomalies: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
  }>;
}

/**
 * Generate compact summary for merchant briefing tool result
 *
 * @param briefing - Business health analysis
 * @returns Compact summary (~100 tokens)
 *
 * @example
 * ```typescript
 * const summary = summarizeMerchantBriefing(briefing);
 * // "Revenue: ₹50,000 today (+11% vs yesterday). Stock: 3 products need urgent restock. Refunds: 10% (above 7.5% avg). Cart abandonment: 75% (normal). 2 anomalies detected."
 * ```
 */
export function summarizeMerchantBriefing(briefing: MerchantBriefingSummaryData): ToolSummary {
  const revenueText = `Revenue: ₹${briefing.revenueDelta.today.toLocaleString()} today (${briefing.revenueDelta.deltaPercent > 0 ? '+' : ''}${briefing.revenueDelta.deltaPercent}% vs yesterday)`;

  const urgentStockCount = briefing.stockVelocity.filter((s) => s.isUrgent).length;
  const stockText = `Stock: ${urgentStockCount} product${urgentStockCount !== 1 ? 's' : ''} need urgent restock`;

  const refundText = `Refunds: ${briefing.refundRate.ratePercent}% (${briefing.refundRate.isAboveAvg ? 'above' : 'below'} ${briefing.refundRate.avgRatePercent}% avg)`;

  const abandonmentText = `Cart abandonment: ${briefing.cartAbandonment.ratePercent}% (${briefing.cartAbandonment.isUnusual ? 'unusually high' : 'normal'})`;

  const anomaliesText = `${briefing.anomalies.length} anomal${briefing.anomalies.length !== 1 ? 'ies' : 'y'} detected`;

  const highSeverityCount = briefing.anomalies.filter((a) => a.severity === 'high').length;
  const alertText = highSeverityCount > 0 ? ` (${highSeverityCount} high priority)` : '';

  const summary = `${revenueText}. ${stockText}. ${refundText}. ${abandonmentText}. ${anomaliesText}${alertText}.`;

  return {
    toolName: 'merchantBriefing',
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

// ============================================================================
// Generic Summary Generator
// ============================================================================

/**
 * Generic tool summary for unknown tool types
 *
 * @param toolName - Name of the tool
 * @param result - Tool result (any type)
 * @returns Compact summary
 */
export function summarizeGenericTool(toolName: string, result: unknown): ToolSummary {
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
  const truncated = resultStr.length > 200 ? resultStr.substring(0, 200) + '...' : resultStr;

  const summary = `${toolName}: ${truncated}`;

  return {
    toolName,
    summary,
    tokenCount: Math.ceil(summary.length / 4),
    timestamp: Date.now(),
  };
}

/**
 * Union type of all summary data types
 */
export type AnySummaryData =
  | { type: 'searchProducts'; data: Parameters<typeof summarizeSearchProducts> }
  | { type: 'addToCart'; data: Parameters<typeof summarizeAddToCart> }
  | { type: 'confirmOrder'; data: Parameters<typeof summarizeConfirmOrder> }
  | { type: 'getOrders'; data: Parameters<typeof summarizeGetOrders> }
  | { type: 'initiateReturn'; data: Parameters<typeof summarizeInitiateReturn> }
  | { type: 'processRefund'; data: Parameters<typeof summarizeProcessRefund> }
  | { type: 'merchantBriefing'; data: Parameters<typeof summarizeMerchantBriefing> }
  | { type: 'generic'; data: [string, unknown] };

/**
 * Generate summary for any tool result
 *
 * @param toolName - Tool name
 * @param result - Tool result data
 * @param metadata - Optional metadata for context
 * @returns ToolSummary object
 *
 * @example
 * ```typescript
 * const summary = generateToolSummary('searchProducts', products, { query: 'headphones' });
 * ```
 */
export function generateToolSummary(
  toolName: string,
  result: unknown,
  metadata?: Record<string, unknown>
): ToolSummary {
  switch (toolName) {
    case 'searchProducts': {
      const products = result as ProductSummaryData[];
      const query = (metadata?.query as string) || 'products';
      const filters = metadata?.filters as Parameters<typeof summarizeSearchProducts>[2];
      return summarizeSearchProducts(products, query, filters);
    }

    case 'addToCart': {
      const [cart, addedItem] = result as [CartSummaryData, { productId: string; name: string; quantity: number }];
      return summarizeAddToCart(cart, addedItem);
    }

    case 'confirmOrder': {
      const order = result as OrderSummaryData;
      return summarizeConfirmOrder(order);
    }

    case 'getOrders': {
      const [orders, userEmail] = result as [OrderSummaryData[], string];
      return summarizeGetOrders(orders, userEmail);
    }

    case 'initiateReturn': {
      const returnData = result as ReturnSummaryData;
      return summarizeInitiateReturn(returnData);
    }

    case 'processRefund': {
      const refund = result as RefundSummaryData;
      return summarizeProcessRefund(refund);
    }

    case 'merchantBriefing': {
      const briefing = result as MerchantBriefingSummaryData;
      return summarizeMerchantBriefing(briefing);
    }

    default:
      return summarizeGenericTool(toolName, result);
  }
}

export default generateToolSummary;
