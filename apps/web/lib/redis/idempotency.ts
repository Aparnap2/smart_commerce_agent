/**
 * Idempotency Helper Module
 *
 * Prevents double-execution of write operations using Redis-based locking.
 * Same operation within TTL window returns cached result instead of re-executing.
 *
 * Key features:
 * - 30-second default lock window (configurable)
 * - Atomic Redis operations (SETNX + SETEX)
 * - Automatic cleanup via TTL
 * - Type-safe generic wrapper
 *
 * Use cases:
 * - Checkout prevention (user clicks twice → one order)
 * - Payment idempotency (retry safety)
 * - Form submission deduplication
 * - API request replay protection
 *
 * @example
 * ```typescript
 * // Basic usage in a tool
 * const addToCartTool = {
 *   generate: async function* ({ productId, quantity }) {
 *     const userId = history.get().userId;
 *     const idempotencyKey = `cart:${userId}:${productId}:${Date.now()}`;
 *
 *     yield <div>Adding to cart...</div>;
 *
 *     const cart = await withIdempotency(
 *       idempotencyKey,
 *       async () => await addToCartMCP(userId, productId, quantity),
 *       30 // 30 second lock
 *     );
 *
 *     return <CartCanvas cart={cart} />;
 *   }
 * }
 * ```
 *
 * @file lib/redis/idempotency.ts
 */

import { getRedisClient } from './client';
import { logger } from './logger';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Idempotency configuration options
 */
export interface IdempotencyOptions {
  /** Time-to-live in seconds for the idempotency lock (default: 30) */
  ttlSeconds?: number;
  /** Custom key prefix (default: 'idem') */
  keyPrefix?: string;
  /** Whether to log idempotency operations (default: true) */
  logOperations?: boolean;
}

/**
 * Idempotency result wrapper
 *
 * Contains both the result and metadata about execution.
 */
export interface IdempotencyResult<T> {
  /** The operation result (cached or fresh) */
  data: T;
  /** Whether this was a cached result from a previous execution */
  isCached: boolean;
  /** Timestamp when the operation was first executed */
  executedAt: number;
}

// ============================================================================
// Core Idempotency Function
// ============================================================================

/**
 * Execute an operation with idempotency protection
 *
 * Uses Redis to lock operations for a specified TTL window. If the same
 * operation is requested within the window, returns the cached result
 * instead of re-executing.
 *
 * Algorithm:
 * 1. Check if idempotency key exists in Redis
 * 2. If exists → return cached result (isCached: true)
 * 3. If not exists → execute operation
 * 4. Store result with TTL
 * 5. Return fresh result (isCached: false)
 *
 * @param key - Unique idempotency key (e.g., `cart:userId:productId:timestamp`)
 * @param operation - Async function to execute with idempotency protection
 * @param options - Idempotency configuration options
 * @returns Idempotency result with data and metadata
 *
 * @throws Error if Redis operation fails or operation throws
 *
 * @example
 * ```typescript
 * // Simple usage with default 30s TTL
 * const result = await withIdempotency(
 *   `order:${userId}:${orderId}`,
 *   async () => await createOrder(userId, orderId)
 * );
 *
 * // Custom TTL
 * const result = await withIdempotency(
 *   `payment:${paymentIntentId}`,
 *   async () => await processPayment(paymentIntentId),
 *   { ttlSeconds: 60 }
 * );
 * ```
 */
export async function withIdempotency<T>(
  key: string,
  operation: () => Promise<T>,
  options?: number | IdempotencyOptions
): Promise<IdempotencyResult<T>> {
  // Normalize options
  const opts: IdempotencyOptions =
    typeof options === 'number'
      ? { ttlSeconds: options }
      : { ...options };

  const ttlSeconds = opts.ttlSeconds ?? 30;
  const keyPrefix = opts.keyPrefix ?? 'idem';
  const logOperations = opts.logOperations ?? true;

  const redis = getRedisClient();
  const redisKey = `${keyPrefix}:${key}`;

  try {
    // Step 1: Check if already executed (cached result exists)
    const existing = await redis.get(redisKey);

    if (existing) {
      if (logOperations) {
        logger.info('Idempotency', 'Returning cached result', {
          key: redisKey,
          ttlRemaining: await redis.ttl(redisKey),
        });
      }

      const cached = JSON.parse(existing) as IdempotencyResult<T>;
      return { ...cached, isCached: true };
    }

    // Step 2: Execute the operation
    if (logOperations) {
      logger.debug('Idempotency', 'Executing operation', { key: redisKey });
    }

    const result = await operation();
    const executedAt = Date.now();

    // Step 3: Store result with TTL (atomic operation)
    const resultToCache: IdempotencyResult<T> = {
      data: result,
      isCached: false,
      executedAt,
    };

    await redis.setex(redisKey, ttlSeconds, JSON.stringify(resultToCache));

    if (logOperations) {
      logger.info('Idempotency', 'Operation completed and cached', {
        key: redisKey,
        ttlSeconds,
        executedAt,
      });
    }

    return resultToCache;
  } catch (error) {
    logger.error('Idempotency', 'Idempotency operation failed', {
      key: redisKey,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// ============================================================================
// Idempotency Key Generators
// ============================================================================

/**
 * Generate idempotency key for cart operations
 *
 * Creates a unique key based on user, product, and timestamp.
 * Timestamp is rounded to nearest second to allow rapid retries.
 *
 * @param userId - User identifier
 * @param productId - Product identifier
 * @param quantity - Quantity being added
 * @returns Idempotency key string
 *
 * @example
 * ```typescript
 * const key = generateCartIdempotencyKey('user_123', 'prod_456', 2);
 * // → 'cart:user_123:prod_456:2:1709876543'
 * ```
 */
export function generateCartIdempotencyKey(
  userId: string,
  productId: string,
  quantity: number
): string {
  const timestamp = Math.floor(Date.now() / 1000); // Round to seconds
  return `cart:${userId}:${productId}:${quantity}:${timestamp}`;
}

/**
 * Generate idempotency key for order confirmation
 *
 * @param userId - User identifier
 * @param orderId - Order identifier
 * @returns Idempotency key string
 *
 * @example
 * ```typescript
 * const key = generateOrderIdempotencyKey('user_123', 'order_456');
 * // → 'order:user_123:order_456'
 * ```
 */
export function generateOrderIdempotencyKey(
  userId: string,
  orderId: string
): string {
  return `order:${userId}:${orderId}`;
}

/**
 * Generate idempotency key for return initiation
 *
 * @param userId - User identifier
 * @param orderId - Order identifier
 * @param reason - Return reason
 * @returns Idempotency key string
 */
export function generateReturnIdempotencyKey(
  userId: string,
  orderId: string,
  reason: string
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return `return:${userId}:${orderId}:${reason}:${timestamp}`;
}

/**
 * Generate idempotency key for refund processing
 *
 * @param orderId - Order identifier
 * @param refundAmount - Refund amount in cents
 * @param reason - Refund reason
 * @returns Idempotency key string
 */
export function generateRefundIdempotencyKey(
  orderId: string,
  refundAmount: number,
  reason: string
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return `refund:${orderId}:${refundAmount}:${reason}:${timestamp}`;
}

// ============================================================================
// Advanced Idempotency Patterns
// ============================================================================

/**
 * Execute with idempotency and distributed lock
 *
 * Uses Redis SETNX for distributed locking to prevent concurrent execution
 * of the same operation across multiple instances.
 *
 * @param key - Unique idempotency key
 * @param operation - Async function to execute
 * @param lockTimeoutSeconds - Lock timeout (default: 10 seconds)
 * @param ttlSeconds - Result cache TTL (default: 30 seconds)
 * @returns Idempotency result
 *
 * @example
 * ```typescript
 * // Prevent concurrent checkout across multiple server instances
 * const result = await withIdempotencyAndLock(
 *   `checkout:${userId}:${cartId}`,
 *   async () => await processCheckout(userId, cartId),
 *   10, // Lock timeout
 *   60  // Result TTL
 * );
 * ```
 */
export async function withIdempotencyAndLock<T>(
  key: string,
  operation: () => Promise<T>,
  lockTimeoutSeconds: number = 10,
  ttlSeconds: number = 30
): Promise<IdempotencyResult<T>> {
  const redis = getRedisClient();
  const lockKey = `lock:${key}`;
  const resultKey = `idem:${key}`;

  // Try to acquire lock
  const lockAcquired = await redis.set(lockKey, '1', 'EX', lockTimeoutSeconds, 'NX');

  if (!lockAcquired) {
    // Lock exists, check if result is cached
    const existing = await redis.get(resultKey);
    if (existing) {
      return JSON.parse(existing) as IdempotencyResult<T>;
    }

    // Wait and retry once
    await new Promise((resolve) => setTimeout(resolve, 100));
    const retry = await redis.get(resultKey);
    if (retry) {
      return JSON.parse(retry) as IdempotencyResult<T>;
    }

    throw new Error(`Operation locked: ${key}`);
  }

  try {
    // Check for cached result (double-check after acquiring lock)
    const existing = await redis.get(resultKey);
    if (existing) {
      return JSON.parse(existing) as IdempotencyResult<T>;
    }

    // Execute operation
    const result = await operation();
    const executedAt = Date.now();

    // Cache result
    const resultToCache: IdempotencyResult<T> = {
      data: result,
      isCached: false,
      executedAt,
    };

    await redis.setex(resultKey, ttlSeconds, JSON.stringify(resultToCache));

    return resultToCache;
  } finally {
    // Release lock
    await redis.del(lockKey);
  }
}

/**
 * Clear idempotency cache for a specific key
 *
 * Useful for testing or manual cache invalidation.
 *
 * @param key - Idempotency key to clear
 * @param keyPrefix - Key prefix (default: 'idem')
 *
 * @example
 * ```typescript
 * await clearIdempotencyCache(`order:${userId}:${orderId}`);
 * ```
 */
export async function clearIdempotencyCache(
  key: string,
  keyPrefix: string = 'idem'
): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${keyPrefix}:${key}`);
  logger.debug('Idempotency', 'Cache cleared', { key: `${keyPrefix}:${key}` });
}

/**
 * Batch clear idempotency cache by pattern
 *
 * WARNING: Use with caution in production. KEYS command can be slow.
 *
 * @param pattern - Key pattern to match (e.g., 'cart:*')
 * @param keyPrefix - Key prefix (default: 'idem')
 * @returns Number of keys deleted
 */
export async function clearIdempotencyCacheByPattern(
  pattern: string,
  keyPrefix: string = 'idem'
): Promise<number> {
  const redis = getRedisClient();
  const keys = await redis.keys(`${keyPrefix}:${pattern}`);

  if (keys.length === 0) {
    return 0;
  }

  const deleted = await redis.del(...keys);
  logger.info('Idempotency', 'Batch cache cleared', {
    pattern: `${keyPrefix}:${pattern}`,
    deletedCount: deleted,
  });

  return deleted;
}
