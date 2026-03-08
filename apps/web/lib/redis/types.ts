/**
 * Redis Memory Types
 *
 * Type definitions for Redis-based memory storage layer.
 * Supports Upstash Redis (free tier: 10K commands/day).
 *
 * @packageDocumentation
 */

/**
 * Search context for multi-turn filtering
 *
 * Stores the last search parameters to enable follow-up queries
 * without requiring the user to repeat constraints.
 *
 * @example
 * ```typescript
 * // User: "Show me headphones"
 * // → SearchContext: { query: "headphones", filters: { inStockOnly: true } }
 *
 * // User: "Actually under ₹10k"
 * // → Reuses query from lastSearch, applies new maxPrice filter
 * ```
 */
export interface SearchContext {
  /** Original search query */
  query: string;
  /** Applied filters */
  filters?: {
    /** Maximum price constraint */
    maxPrice?: number;
    /** Minimum price constraint */
    minPrice?: number;
    /** Brand filter */
    brand?: string;
    /** Use case: gym, calls, gaming, etc. */
    useCase?: string;
    /** Stock availability filter */
    inStockOnly?: boolean;
    /** Product category */
    category?: string;
  };
  /** Number of results returned */
  resultsCount: number;
  /** Compact summary for AIState (~100 tokens) */
  summary?: string;
  /** Timestamp when search was performed */
  timestamp: number;
}

/**
 * User context for tracking meaningful actions
 *
 * Maintains the last 5 significant user actions for personalization
 * and proactive intelligence.
 */
export interface UserContext {
  /** Last 5 meaningful user actions (most recent first) */
  lastActions: Array<{
    /** Action type */
    type: 'search' | 'view_product' | 'add_to_cart' | 'checkout' | 'return';
    /** Action-specific data */
    data: Record<string, unknown>;
    /** Action timestamp (ms since epoch) */
    timestamp: number;
  }>;
  /** Last context update timestamp */
  updatedAt: number;
}

/**
 * Wishlist item with price alert configuration
 *
 * Stored per product to enable price drop notifications.
 */
export interface WishlistItem {
  /** Product identifier */
  productId: string;
  /** Product name for display */
  productName: string;
  /** Price when added to wishlist */
  priceAtAdd: number;
  /** Timestamp when added */
  addedAt: number;
  /** Optional: Alert when price drops below this value */
  alertBelowPrice?: number;
}

/**
 * Abandoned cart tracking data
 *
 * Used for recovery campaigns and analytics.
 */
export interface AbandonedCart {
  /** Cart identifier */
  cartId: string;
  /** Total cart value in smallest currency unit */
  cartTotal: number;
  /** Number of items in cart */
  itemCount: number;
  /** List of product IDs in cart */
  productIds: string[];
  /** Timestamp when cart was marked as abandoned */
  triggeredAt: number;
}

/**
 * Time-to-live constants for different data types
 *
 * Optimized for Upstash free tier (10K commands/day).
 * Shorter TTLs reduce storage costs while maintaining UX.
 */
export const TTL = {
  /** Last search context: 1 hour */
  LAST_SEARCH: 60 * 60,
  /** User context: 24 hours */
  USER_CONTEXT: 24 * 60 * 60,
  /** Wishlist: 30 days */
  WISHLIST: 30 * 24 * 60 * 60,
  /** Abandoned cart: 3 hours */
  CART_ABANDONED: 3 * 60 * 60,
} as const;

/**
 * Redis key patterns
 *
 * Consistent naming convention for all memory keys.
 */
export const KEY_PATTERNS = {
  /** Last search: `user:{userId}:lastSearch` */
  lastSearch: (userId: string) => `user:${userId}:lastSearch`,
  /** User context: `user:{userId}:context` */
  userContext: (userId: string) => `user:${userId}:context`,
  /** Wishlist item: `user:{userId}:wishlist:{productId}` */
  wishlist: (userId: string, productId: string) => `user:${userId}:wishlist:${productId}`,
  /** Wishlist pattern for listing: `user:{userId}:wishlist:*` */
  wishlistPattern: (userId: string) => `user:${userId}:wishlist:*`,
  /** Abandoned cart: `user:{userId}:cartAbandoned:{cartId}` */
  cartAbandoned: (userId: string, cartId: string) => `user:${userId}:cartAbandoned:${cartId}`,
} as const;
