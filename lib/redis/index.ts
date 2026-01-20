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
  RedisCheckpointSaver,
  MemoryCheckpointSaver,
  createCheckpointSaver,
  getDefaultCheckpointSaver,
  type RedisCheckpointMetadata,
} from './langgraph-checkpoint';

// Logger (internal use)
export { logger } from './logger';
