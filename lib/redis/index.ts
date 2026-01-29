/**
 * Redis Module Exports
 * Provides Redis-based checkpointing for LangGraph state persistence
 */

// Client
export {
  createRedisClient,
  getRedisClient,
  checkRedisHealth,
  closeRedisConnection,
  isRedisAvailable,
  type RedisConfig,
} from './client';

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

// Logger (internal use)
export { logger } from './logger';
