/**
 * LangGraph Checkpoint Saver
 * Implements LangGraph's CheckpointSaver interface using Redis
 * TEMPORARILY DISABLED - LangGraph API incompatible with current version
 */

// Types - using any to avoid LangGraph dependency issues
type Checkpoint = any;
type CheckpointSaver = any;
type SerializedCheckpoint = any;
type ChannelLogs = any;

/**
 * Type for checkpoint metadata
 */
export interface RedisCheckpointMetadata {
  source: 'input' | 'loop' | 'update' | 'readonly';
  step: number;
  threadsuffix?: string;
  [key: string]: unknown;
}

/**
 * LangGraph Redis Checkpoint Saver
 * Implements the CheckpointSaver interface for Redis-based state persistence
 */
export class RedisCheckpointSaver implements CheckpointSaver {
  constructor(manager?: any, namespace: string[] = []) {
    // Placeholder - not used while LangGraph is disabled
  }

  async get(threadId: string, checkpointId?: string): Promise<Checkpoint | null> {
    return null;
  }

  async put(
    threadId: string,
    checkpoint: Checkpoint,
    channels: Record<string, unknown>,
    newChannels: Record<string, unknown>,
    metadata?: Record<string, unknown>,
    logs?: ChannelLogs
  ): Promise<void> {
    // Placeholder - not used while LangGraph is disabled
  }

  async list(
    threadId: string,
    options?: { limit?: number; before?: string; metadata?: Record<string, unknown> }
  ): Promise<Array<SerializedCheckpoint>> {
    return [];
  }

  async delete(threadId: string, checkpointId: string): Promise<void> {
    // Placeholder
  }

  async search(query: Record<string, unknown>, limit: number = 10): Promise<Array<{ threadId: string; checkpoint: Checkpoint }>> {
    return [];
  }
}

/**
 * Memory-based checkpoint saver for development fallback
 */
export class MemoryCheckpointSaver implements CheckpointSaver {
  async get(threadId: string, checkpointId?: string): Promise<Checkpoint | null> {
    return null;
  }

  async put(
    threadId: string,
    checkpoint: Checkpoint,
    channels: Record<string, unknown>,
    newChannels: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    // Placeholder
  }

  async list(threadId: string, options?: { limit?: number; before?: string }): Promise<Array<SerializedCheckpoint>> {
    return [];
  }

  async delete(threadId: string, checkpointId: string): Promise<void> {
    // Placeholder
  }
}

/**
 * Factory function to create the appropriate checkpoint saver
 */
export function createCheckpointSaver(
  useRedis?: boolean,
  namespace: string[] = [],
  redisClient?: any
): CheckpointSaver {
  return new MemoryCheckpointSaver();
}

export function getDefaultCheckpointSaver(): CheckpointSaver {
  return new MemoryCheckpointSaver();
}

// RedisClient type is now exported from client.ts
