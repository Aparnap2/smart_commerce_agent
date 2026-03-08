/**
 * Redis Module Exports
 *
 * Provides:
 * - Redis-based checkpointing for LangGraph state persistence
 * - Upstash Redis memory layer for cross-session context
 *
 * @packageDocumentation
 */

// ============================================================================
// Client (ioredis + Upstash)
// ============================================================================

export {
  createRedisClient,
  getRedisClient,
  checkRedisHealth,
  closeRedisConnection,
  isRedisAvailable,
  type RedisConfig,
} from './client';

// Upstash Client
export {
  getUpstashRedisClient,
  checkUpstashHealth,
  checkAllRedisHealth,
  closeUpstashConnection,
  isUpstashAvailable,
  type AnyRedisClient,
} from './client';

// ============================================================================
// Memory Layer (Upstash)
// ============================================================================

export {
  // Last Search
  saveLastSearch,
  getLastSearch,
  // User Context
  addToUserContext,
  getUserContext,
  getRecentActions,
  type UserAction,
  // Wishlist
  addToWishlist,
  getWishlist,
  getWishlistItem,
  removeFromWishlist,
  isInWishlist,
  // Cart Abandonment
  markCartAbandoned,
  getAbandonedCart,
  getAbandonedCarts,
  clearAbandonedCart,
  // System Prompt
  getSystemPromptContext,
  // Utilities
  clearUserMemory,
  getUserMemoryStats,
  // TTL Constants
  TTL,
  KEY_PATTERNS,
} from './memory';

// ============================================================================
// Types
// ============================================================================

export type {
  SearchContext,
  UserContext,
  WishlistItem,
  AbandonedCart,
} from './types';

// ============================================================================
// LangGraph Checkpointing
// ============================================================================

// Checkpoint Manager
export {
  CheckpointManager,
  getCheckpointManager,
  type CheckpointData,
  type CheckpointMetadata,
} from './checkpoint-manager';

// LangGraph Integration
export {
  createCheckpointer,
  initializeCheckpointService,
  initializeRedisCheckpointer,
  initializePostgresCheckpointer,
  healthCheckRedis,
  healthCheckPostgres,
  healthCheckAll,
  getCheckpointStats,
  closeRedisCheckpointer,
  closePostgresCheckpointer,
  closeAllCheckpointers,
  createThreadConfig,
  type CheckpointConfig,
} from './langgraph-checkpoint';

// ============================================================================
// Logger (internal use)
// ============================================================================

export { logger } from './logger';

// ============================================================================
// Idempotency (write operation protection)
// ============================================================================

export {
  // Core idempotency function
  withIdempotency,
  // Idempotency key generators
  generateCartIdempotencyKey,
  generateOrderIdempotencyKey,
  generateReturnIdempotencyKey,
  generateRefundIdempotencyKey,
  // Advanced patterns
  withIdempotencyAndLock,
  // Cache management
  clearIdempotencyCache,
  clearIdempotencyCacheByPattern,
  // Types
  type IdempotencyOptions,
  type IdempotencyResult,
} from './idempotency';
