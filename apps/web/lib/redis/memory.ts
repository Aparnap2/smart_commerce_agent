/**
 * Redis Memory Functions
 *
 * Persistent agent memory layer using Upstash Redis.
 * Enables cross-session context retention and proactive intelligence.
 *
 * Features:
 * - Last search context for multi-turn filtering
 * - User context tracking (last 5 meaningful actions)
 * - Wishlist with price alerts
 * - Cart abandonment tracking
 * - System prompt enrichment
 *
 * Upstash Free Tier: 10K commands/day
 *
 * @packageDocumentation
 */

import { getUpstashRedisClient } from './client';
import { logger } from './logger';
import type { SearchContext, UserContext, WishlistItem, AbandonedCart } from './types';
import { TTL, KEY_PATTERNS } from './types';

// Re-export TTL constants and key patterns for convenience
export { TTL, KEY_PATTERNS };

// ============================================================================
// Last Search Context (Multi-turn Filtering)
// ============================================================================

/**
 * Save the user's last search for multi-turn conversations
 *
 * TTL: 1 hour - sufficient for follow-up queries within a session
 *
 * @param userId - Unique user identifier
 * @param context - Search context including query and filters
 *
 * @example
 * ```typescript
 * await saveLastSearch('user123', {
 *   query: 'wireless headphones',
 *   filters: { maxPrice: 5000, inStockOnly: true },
 *   resultsCount: 12,
 *   timestamp: Date.now(),
 * });
 * ```
 */
export async function saveLastSearch(
  userId: string,
  context: SearchContext
): Promise<void> {
  const redis = getUpstashRedisClient();
  const key = KEY_PATTERNS.lastSearch(userId);

  try {
    await redis.set(key, JSON.stringify(context), { ex: TTL.LAST_SEARCH });

    logger.info('Memory', 'Last search saved', {
      userId,
      query: context.query,
      resultsCount: context.resultsCount,
    });
  } catch (error) {
    logger.error('Memory', 'Failed to save last search', error);
    throw error;
  }
}

/**
 * Retrieve the user's last search context
 *
 * @param userId - Unique user identifier
 * @returns Search context or null if not found
 *
 * @example
 * ```typescript
 * const lastSearch = await getLastSearch('user123');
 * if (lastSearch) {
 *   // User previously searched, can apply filters from lastSearch.filters
 * }
 * ```
 */
export async function getLastSearch(
  userId: string
): Promise<SearchContext | null> {
  const redis = getUpstashRedisClient();
  const key = KEY_PATTERNS.lastSearch(userId);

  try {
    const data = await redis.get<string>(key);
    return data ? (JSON.parse(data) as SearchContext) : null;
  } catch (error) {
    logger.error('Memory', 'Failed to get last search', error);
    return null;
  }
}

// ============================================================================
// User Context (Action Tracking)
// ============================================================================

/**
 * User action for context tracking
 */
export interface UserAction {
  type: 'search' | 'view_product' | 'add_to_cart' | 'checkout' | 'return';
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * Add an action to the user's context history
 *
 * Maintains the last 5 meaningful actions for personalization.
 * TTL: 24 hours
 *
 * @param userId - Unique user identifier
 * @param action - Action to record
 * @returns Updated user context
 *
 * @example
 * ```typescript
 * await addToUserContext('user123', {
 *   type: 'view_product',
 *   data: { productId: 'prod_456', name: 'AirPods Pro' },
 *   timestamp: Date.now(),
 * });
 * ```
 */
export async function addToUserContext(
  userId: string,
  action: UserAction
): Promise<UserContext> {
  const redis = getUpstashRedisClient();
  const key = KEY_PATTERNS.userContext(userId);

  try {
    // Get existing context
    const existing = await getUserContext(userId);

    // Add new action (keep last 5, most recent first)
    const updated: UserContext = {
      lastActions: [action, ...(existing?.lastActions || [])].slice(0, 5),
      updatedAt: Date.now(),
    };

    await redis.set(key, JSON.stringify(updated), { ex: TTL.USER_CONTEXT });

    logger.debug('Memory', 'User context updated', {
      userId,
      actionType: action.type,
      actionsCount: updated.lastActions.length,
    });

    return updated;
  } catch (error) {
    logger.error('Memory', 'Failed to add to user context', error);
    throw error;
  }
}

/**
 * Retrieve the user's context history
 *
 * @param userId - Unique user identifier
 * @returns User context or null if not found
 */
export async function getUserContext(
  userId: string
): Promise<UserContext | null> {
  const redis = getUpstashRedisClient();
  const key = KEY_PATTERNS.userContext(userId);

  try {
    const data = await redis.get<string>(key);
    return data ? (JSON.parse(data) as UserContext) : null;
  } catch (error) {
    logger.error('Memory', 'Failed to get user context', error);
    return null;
  }
}

/**
 * Get recent user actions for personalization
 *
 * @param userId - Unique user identifier
 * @param limit - Maximum number of actions to return (default: 3)
 * @returns Array of recent actions
 */
export async function getRecentActions(
  userId: string,
  limit: number = 3
): Promise<UserAction[]> {
  const context = await getUserContext(userId);
  return context?.lastActions.slice(0, limit) || [];
}

// ============================================================================
// Wishlist with Price Alerts
// ============================================================================

/**
 * Add a product to the user's wishlist
 *
 * TTL: 30 days - long enough for price drop notifications
 *
 * @param userId - Unique user identifier
 * @param item - Wishlist item with product details
 *
 * @example
 * ```typescript
 * await addToWishlist('user123', {
 *   productId: 'prod_789',
 *   productName: 'Sony WH-1000XM5',
 *   priceAtAdd: 29990,
 *   addedAt: Date.now(),
 *   alertBelowPrice: 25000, // Alert when price drops below ₹25k
 * });
 * ```
 */
export async function addToWishlist(
  userId: string,
  item: WishlistItem
): Promise<void> {
  const redis = getUpstashRedisClient();
  const key = KEY_PATTERNS.wishlist(userId, item.productId);

  try {
    await redis.set(key, JSON.stringify(item), { ex: TTL.WISHLIST });

    logger.info('Memory', 'Item added to wishlist', {
      userId,
      productId: item.productId,
      productName: item.productName,
    });
  } catch (error) {
    logger.error('Memory', 'Failed to add to wishlist', error);
    throw error;
  }
}

/**
 * Get all items in the user's wishlist
 *
 * @param userId - Unique user identifier
 * @returns Array of wishlist items
 */
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  const redis = getUpstashRedisClient();
  const pattern = KEY_PATTERNS.wishlistPattern(userId);

  try {
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return [];
    }

    const items = await redis.mget<string[]>(...keys);

    return items
      .filter((item): item is string => item !== null)
      .map((item) => JSON.parse(item) as WishlistItem);
  } catch (error) {
    logger.error('Memory', 'Failed to get wishlist', error);
    return [];
  }
}

/**
 * Get a specific wishlist item
 *
 * @param userId - Unique user identifier
 * @param productId - Product identifier
 * @returns Wishlist item or null if not found
 */
export async function getWishlistItem(
  userId: string,
  productId: string
): Promise<WishlistItem | null> {
  const redis = getUpstashRedisClient();
  const key = KEY_PATTERNS.wishlist(userId, productId);

  try {
    const data = await redis.get<string>(key);
    return data ? (JSON.parse(data) as WishlistItem) : null;
  } catch (error) {
    logger.error('Memory', 'Failed to get wishlist item', error);
    return null;
  }
}

/**
 * Remove a product from the user's wishlist
 *
 * @param userId - Unique user identifier
 * @param productId - Product identifier to remove
 */
export async function removeFromWishlist(
  userId: string,
  productId: string
): Promise<void> {
  const redis = getUpstashRedisClient();
  const key = KEY_PATTERNS.wishlist(userId, productId);

  try {
    await redis.del(key);

    logger.info('Memory', 'Item removed from wishlist', {
      userId,
      productId,
    });
  } catch (error) {
    logger.error('Memory', 'Failed to remove from wishlist', error);
    throw error;
  }
}

/**
 * Check if a product is in the user's wishlist
 *
 * @param userId - Unique user identifier
 * @param productId - Product identifier to check
 * @returns true if product is in wishlist
 */
export async function isInWishlist(
  userId: string,
  productId: string
): Promise<boolean> {
  const item = await getWishlistItem(userId, productId);
  return item !== null;
}

// ============================================================================
// Cart Abandonment Tracking
// ============================================================================

/**
 * Mark a cart as abandoned for recovery campaigns
 *
 * TTL: 3 hours - optimal window for recovery emails/push notifications
 *
 * @param userId - Unique user identifier
 * @param cartId - Cart identifier
 * @param data - Cart details for recovery
 *
 * @example
 * ```typescript
 * await markCartAbandoned('user123', 'cart_456', {
 *   cartTotal: 15999,
 *   itemCount: 2,
 *   productIds: ['prod_123', 'prod_456'],
 * });
 * ```
 */
export async function markCartAbandoned(
  userId: string,
  cartId: string,
  data: {
    cartTotal: number;
    itemCount: number;
    productIds: string[];
  }
): Promise<void> {
  const redis = getUpstashRedisClient();
  const key = KEY_PATTERNS.cartAbandoned(userId, cartId);

  try {
    await redis.set(
      key,
      JSON.stringify({
        ...data,
        triggeredAt: Date.now(),
      }),
      { ex: TTL.CART_ABANDONED }
    );

    logger.info('Memory', 'Cart marked as abandoned', {
      userId,
      cartId,
      cartTotal: data.cartTotal,
      itemCount: data.itemCount,
    });
  } catch (error) {
    logger.error('Memory', 'Failed to mark cart as abandoned', error);
    throw error;
  }
}

/**
 * Get abandoned cart details
 *
 * @param userId - Unique user identifier
 * @param cartId - Cart identifier
 * @returns Abandoned cart data or null if not found
 */
export async function getAbandonedCart(
  userId: string,
  cartId: string
): Promise<AbandonedCart | null> {
  const redis = getUpstashRedisClient();
  const key = KEY_PATTERNS.cartAbandoned(userId, cartId);

  try {
    const data = await redis.get<string>(key);
    return data ? (JSON.parse(data) as AbandonedCart) : null;
  } catch (error) {
    logger.error('Memory', 'Failed to get abandoned cart', error);
    return null;
  }
}

/**
 * Get all abandoned carts for a user
 *
 * @param userId - Unique user identifier
 * @returns Array of abandoned carts
 */
export async function getAbandonedCarts(
  userId: string
): Promise<AbandonedCart[]> {
  const redis = getUpstashRedisClient();
  const pattern = `user:${userId}:cartAbandoned:*`;

  try {
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return [];
    }

    const carts = await redis.mget<string[]>(...keys);

    return carts
      .filter((cart): cart is string => cart !== null)
      .map((cart) => JSON.parse(cart) as AbandonedCart);
  } catch (error) {
    logger.error('Memory', 'Failed to get abandoned carts', error);
    return [];
  }
}

/**
 * Clear an abandoned cart record (e.g., after recovery)
 *
 * @param userId - Unique user identifier
 * @param cartId - Cart identifier to clear
 */
export async function clearAbandonedCart(
  userId: string,
  cartId: string
): Promise<void> {
  const redis = getUpstashRedisClient();
  const key = KEY_PATTERNS.cartAbandoned(userId, cartId);

  try {
    await redis.del(key);

    logger.info('Memory', 'Abandoned cart cleared', {
      userId,
      cartId,
    });
  } catch (error) {
    logger.error('Memory', 'Failed to clear abandoned cart', error);
    throw error;
  }
}

// ============================================================================
// System Prompt Enrichment
// ============================================================================

/**
 * Build enriched system prompt context from user's memory
 *
 * Combines last search, recent actions, and wishlist to provide
 * personalized context for AI responses.
 *
 * @param userId - Unique user identifier
 * @returns Formatted context string for system prompt
 *
 * @example
 * ```typescript
 * const context = await getSystemPromptContext('user123');
 * // Returns: "User last searched for: "wireless headphones" with budget under ₹5,000.
 * //          Recent activity: search, view_product, add_to_cart.
 * //          User has 3 items in wishlist"
 * ```
 */
export async function getSystemPromptContext(userId: string): Promise<string> {
  try {
    // Fetch all context in parallel for performance
    const [lastSearch, context, wishlist] = await Promise.all([
      getLastSearch(userId),
      getUserContext(userId),
      getWishlist(userId),
    ]);

    const parts: string[] = [];

    // Add last search context
    if (lastSearch) {
      parts.push(`User last searched for: "${lastSearch.query}"`);

      if (lastSearch.filters?.maxPrice) {
        parts.push(
          `with budget under ₹${lastSearch.filters.maxPrice.toLocaleString('en-IN')}`
        );
      }

      if (lastSearch.filters?.brand) {
        parts.push(`preferring ${lastSearch.filters.brand} brand`);
      }

      if (lastSearch.filters?.category) {
        parts.push(`in the ${lastSearch.filters.category} category`);
      }
    }

    // Add recent activity
    if (context?.lastActions?.length) {
      const recentActions = context.lastActions
        .slice(0, 3)
        .map((a) => a.type.replace(/_/g, ' '))
        .join(', ');
      parts.push(`Recent activity: ${recentActions}`);
    }

    // Add wishlist context
    if (wishlist.length > 0) {
      parts.push(`User has ${wishlist.length} items in wishlist`);

      // Mention high-value wishlist items
      const highValueItems = wishlist.filter(
        (item) => item.priceAtAdd >= 10000
      );
      if (highValueItems.length > 0) {
        parts.push(
          `including premium items like ${highValueItems[0].productName}`
        );
      }
    }

    // Add price sensitivity indicator
    if (context?.lastActions) {
      const priceActions = context.lastActions.filter(
        (a) => a.data?.price !== undefined
      );
      if (priceActions.length >= 2) {
        const avgPrice =
          priceActions.reduce(
            (sum, a) => sum + (a.data?.price as number),
            0
          ) / priceActions.length;
        parts.push(
          `typically considers products around ₹${Math.round(avgPrice).toLocaleString('en-IN')}`
        );
      }
    }

    const result = parts.join('. ') || 'New user - no history available';

    logger.debug('Memory', 'System prompt context built', {
      userId,
      hasLastSearch: !!lastSearch,
      hasContext: !!context,
      wishlistSize: wishlist.length,
      contextLength: result.length,
    });

    return result;
  } catch (error) {
    logger.error('Memory', 'Failed to build system prompt context', error);
    return 'New user - no history available';
  }
}

/**
 * Clear all user memory data
 *
 * Use with caution - removes all stored context for a user.
 *
 * @param userId - Unique user identifier
 */
export async function clearUserMemory(userId: string): Promise<void> {
  const redis = getUpstashRedisClient();

  try {
    // Find all user keys
    const patterns = [
      KEY_PATTERNS.lastSearch(userId),
      KEY_PATTERNS.userContext(userId),
      KEY_PATTERNS.wishlistPattern(userId),
      `user:${userId}:cartAbandoned:*`,
    ];

    const allKeys: string[] = [];
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      allKeys.push(...keys);
    }

    // Delete all keys
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }

    logger.info('Memory', 'User memory cleared', {
      userId,
      keysDeleted: allKeys.length,
    });
  } catch (error) {
    logger.error('Memory', 'Failed to clear user memory', error);
    throw error;
  }
}

/**
 * Get memory usage statistics for a user
 *
 * @param userId - Unique user identifier
 * @returns Statistics about stored memory data
 */
export async function getUserMemoryStats(userId: string): Promise<{
  hasLastSearch: boolean;
  actionsCount: number;
  wishlistSize: number;
  abandonedCartsCount: number;
  totalKeys: number;
}> {
  const redis = getUpstashRedisClient();

  try {
    const [lastSearch, context, wishlist, abandonedCarts] = await Promise.all([
      getLastSearch(userId),
      getUserContext(userId),
      getWishlist(userId),
      getAbandonedCarts(userId),
    ]);

    // Count all user keys
    const patterns = [
      KEY_PATTERNS.lastSearch(userId),
      KEY_PATTERNS.userContext(userId),
      KEY_PATTERNS.wishlistPattern(userId),
      `user:${userId}:cartAbandoned:*`,
    ];

    let totalKeys = 0;
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      totalKeys += keys.length;
    }

    return {
      hasLastSearch: !!lastSearch,
      actionsCount: context?.lastActions.length || 0,
      wishlistSize: wishlist.length,
      abandonedCartsCount: abandonedCarts.length,
      totalKeys,
    };
  } catch (error) {
    logger.error('Memory', 'Failed to get user memory stats', error);
    return {
      hasLastSearch: false,
      actionsCount: 0,
      wishlistSize: 0,
      abandonedCartsCount: 0,
      totalKeys: 0,
    };
  }
}
