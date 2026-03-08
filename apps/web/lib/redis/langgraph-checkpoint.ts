/**
 * LangGraph Checkpoint Service using @langchain/langgraph-checkpoint-redis
 * and @langchain/langgraph-checkpoint-postgres
 *
 * Provides persistent checkpoint storage for LangGraph agent state using Redis or Postgres.
 * Uses the official checkpointers for production-grade persistence.
 *
 * @packageDocumentation
 */

import { RedisSaver } from '@langchain/langgraph-checkpoint-redis';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import Redis from 'ioredis';
import { Pool, PoolConfig } from 'pg';
import { MemorySaver } from '@langchain/langgraph';
import { env } from '@/lib/env';

/**
 * Checkpoint configuration
 */
interface CheckpointConfig {
  /** Redis connection URL */
  redisUrl?: string;
  /** Postgres connection string */
  postgresUrl?: string;
  /** Checkpoint type: 'redis' | 'postgres' | 'memory' */
  type?: 'redis' | 'postgres' | 'memory';
  /** Session TTL in seconds (default: 24 hours) */
  sessionTTL?: number;
  /** Maximum retries for connection */
  maxRetries?: number;
  /** Postgres schema (default: 'public') */
  postgresSchema?: string;
}

/**
 * Checkpoint service state for Redis
 */
interface RedisCheckpointState {
  client: Redis | null;
  checkpointer: RedisSaver | null;
  isConnected: boolean;
  lastHealthCheck: number;
}

/**
 * Checkpoint service state for Postgres
 */
interface PostgresCheckpointState {
  pool: Pool | null;
  checkpointer: PostgresSaver | null;
  isConnected: boolean;
  lastHealthCheck: number;
}

/**
 * Union type for any checkpointer
 */
type AnyCheckpointer = RedisSaver | PostgresSaver | MemorySaver;

/**
 * Checkpoint service singletons
 */
let _redisState: RedisCheckpointState = {
  client: null,
  checkpointer: null,
  isConnected: false,
  lastHealthCheck: 0,
};

let _postgresState: PostgresCheckpointState = {
  pool: null,
  checkpointer: null,
  isConnected: false,
  lastHealthCheck: 0,
};

// ============================================
// Redis Checkpointer
// ============================================

/**
 * Build Redis client from environment
 */
function createRedisClient(config?: CheckpointConfig): Redis {
  const url = config?.redisUrl || env.REDIS_URL || 'redis://localhost:6379';

  return new Redis(url, {
    connectTimeout: 5000,
    maxRetriesPerRequest: config?.maxRetries || 3,
    retryStrategy: (retries: number) => {
      const maxRetries = config?.maxRetries || 3;
      if (retries > maxRetries) {
        console.error('[CheckpointService] Max retries reached, giving up');
        return null; // Stop retrying
      }
      return Math.min(retries * 100, 3000);
    },
  });
}

/**
 * Initialize the Redis checkpointer
 */
export async function initializeRedisCheckpointer(config?: CheckpointConfig): Promise<RedisSaver> {
  if (_redisState.checkpointer) {
    console.log('[CheckpointService] Redis checkpointer already initialized');
    return _redisState.checkpointer;
  }

  console.log('[CheckpointService] Initializing Redis checkpointer...');

  try {
    const client = createRedisClient(config);

    client.on('error', (err: Error) => {
      console.error('[CheckpointService] Redis client error:', err.message);
      _redisState.isConnected = false;
    });

    client.on('connect', () => {
      console.log('[CheckpointService] Redis client connected');
      _redisState.isConnected = true;
    });

    client.on('reconnecting', () => {
      console.log('[CheckpointService] Redis client reconnecting...');
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      client.once('ready', () => resolve());
      client.once('error', reject);
    });

    // Create the official LangGraph Redis checkpointer with ioredis client
    const checkpointer = new RedisSaver(client as any);

    // Set TTL using client commands
    const ttlSeconds = config?.sessionTTL || 86400;
    console.log(`[CheckpointService] Redis checkpointer initialized (TTL: ${ttlSeconds}s)`);

    _redisState = {
      client,
      checkpointer,
      isConnected: true,
      lastHealthCheck: Date.now(),
    };

    return checkpointer;
  } catch (error) {
    console.error('[CheckpointService] ❌ Failed to initialize Redis checkpointer:', error);
    throw error;
  }
}

// ============================================
// Postgres Checkpointer
// ============================================

/**
 * Build Postgres pool options from environment
 *
 * For Neon serverless deployment, use smaller pool sizes to avoid
 * connection limit issues. Neon free tier allows 100 connections.
 */
function buildPostgresPoolOptions(config?: CheckpointConfig): PoolConfig {
  const connectionString = config?.postgresUrl || env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_commerce';

  // Neon serverless: use smaller pool (free tier: 100 connections max)
  // Local dev: larger pool for better performance
  const isNeon = connectionString.includes('neon.tech') || connectionString.includes('neon postgres');
  const maxConnections = isNeon ? (env.NEON_POOL_MAX || 5) : 10;

  return {
    connectionString,
    max: maxConnections,
    idleTimeoutMillis: env.NEON_IDLE_TIMEOUT || 30000,
    connectionTimeoutMillis: 10000, // Longer timeout for serverless
  };
}

/**
 * Initialize the Postgres checkpointer
 *
 * Uses @langchain/langgraph-checkpoint-postgres for persistent state storage.
 * Requires the checkpoints table to be created via .setup().
 */
export async function initializePostgresCheckpointer(config?: CheckpointConfig): Promise<PostgresSaver> {
  if (_postgresState.checkpointer) {
    console.log('[CheckpointService] Postgres checkpointer already initialized');
    return _postgresState.checkpointer;
  }

  console.log('[CheckpointService] Initializing Postgres checkpointer...');

  try {
    const poolOptions = buildPostgresPoolOptions(config);
    const pool = new Pool(poolOptions);

    pool.on('error', (err) => {
      console.error('[CheckpointService] Postgres pool error:', err.message);
      _postgresState.isConnected = false;
    });

    pool.on('connect', () => {
      console.log('[CheckpointService] Postgres client connected');
      _postgresState.isConnected = true;
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    // Create the official LangGraph Postgres checkpointer
    const checkpointer = new PostgresSaver(pool, undefined, {
      schema: config?.postgresSchema || 'public',
    });

    // Initialize checkpoint tables (creates if not exists)
    await checkpointer.setup();

    _postgresState = {
      pool,
      checkpointer,
      isConnected: true,
      lastHealthCheck: Date.now(),
    };

    console.log('[CheckpointService] ✅ Postgres checkpointer initialized');

    return checkpointer;
  } catch (error) {
    console.error('[CheckpointService] ❌ Failed to initialize Postgres checkpointer:', error);
    throw error;
  }
}

// ============================================
// Unified Factory Functions
// ============================================

/**
 * Get the appropriate checkpointer based on configuration
 *
 * Priority: type config > environment variable > default (memory)
 *
 * @param config - Checkpoint configuration
 * @returns Initialized checkpointer (Redis, Postgres, or Memory)
 */
export async function createCheckpointer(config?: CheckpointConfig): Promise<AnyCheckpointer> {
  const type = config?.type || env.CHECKPOINT_TYPE || 'memory';

  switch (type) {
    case 'redis':
      try {
        return await initializeRedisCheckpointer(config);
      } catch (error) {
        console.warn('[CheckpointService] Redis unavailable, falling back to memory');
        return new MemorySaver();
      }

    case 'postgres':
      try {
        return await initializePostgresCheckpointer(config);
      } catch (error) {
        console.warn('[CheckpointService] Postgres unavailable, falling back to memory');
        return new MemorySaver();
      }

    case 'memory':
    default:
      console.log('[CheckpointService] Using in-memory checkpointer (development mode)');
      return new MemorySaver();
  }
}

/**
 * Initialize checkpointer based on environment or explicit config
 * Defaults to Redis if CHECKPOINT_TYPE=redis and REDIS_URL is set
 * Defaults to Postgres if CHECKPOINT_TYPE=postgres and DATABASE_URL is set
 * Otherwise uses MemorySaver
 */
export async function initializeCheckpointService(config?: CheckpointConfig): Promise<AnyCheckpointer> {
  return createCheckpointer(config);
}

// ============================================
// Health Checks & Stats
// ============================================

/**
 * Health check for Redis checkpointer
 */
export async function healthCheckRedis(): Promise<{
  healthy: boolean;
  latency: number;
  connected: boolean;
}> {
  const start = Date.now();

  if (!_redisState.client) {
    return { healthy: false, latency: Date.now() - start, connected: false };
  }

  try {
    const result = await _redisState.client.ping();
    const latency = Date.now() - start;
    const healthy = result === 'PONG' && _redisState.isConnected;

    _redisState.lastHealthCheck = Date.now();

    return { healthy, latency, connected: _redisState.isConnected };
  } catch (error) {
    return { healthy: false, latency: Date.now() - start, connected: false };
  }
}

/**
 * Health check for Postgres checkpointer
 */
export async function healthCheckPostgres(): Promise<{
  healthy: boolean;
  latency: number;
  connected: boolean;
}> {
  const start = Date.now();

  if (!_postgresState.pool) {
    return { healthy: false, latency: Date.now() - start, connected: false };
  }

  try {
    const client = await _postgresState.pool.connect();
    await client.query('SELECT 1');
    client.release();
    const latency = Date.now() - start;

    _postgresState.lastHealthCheck = Date.now();

    return { healthy: true, latency, connected: _postgresState.isConnected };
  } catch (error) {
    return { healthy: false, latency: Date.now() - start, connected: false };
  }
}

/**
 * Combined health check for all checkpointers
 */
export async function healthCheckAll(): Promise<{
  redis: { healthy: boolean; latency: number; connected: boolean };
  postgres: { healthy: boolean; latency: number; connected: boolean };
  activeType: string;
}> {
  const redis = await healthCheckRedis();
  const postgres = await healthCheckPostgres();

  let activeType = 'none';
  if (_redisState.isConnected) activeType = 'redis';
  else if (_postgresState.isConnected) activeType = 'postgres';

  return { redis, postgres, activeType };
}

/**
 * Get service statistics
 */
export function getCheckpointStats(): {
  redis: { isConnected: boolean; lastHealthCheck: number };
  postgres: { isConnected: boolean; lastHealthCheck: number };
  sessionTTL: number;
} {
  return {
    redis: {
      isConnected: _redisState.isConnected,
      lastHealthCheck: _redisState.lastHealthCheck,
    },
    postgres: {
      isConnected: _postgresState.isConnected,
      lastHealthCheck: _postgresState.lastHealthCheck,
    },
    sessionTTL: 86400, // Default TTL
  };
}

// ============================================
// Cleanup
// ============================================

/**
 * Close the Redis checkpointer gracefully
 */
export async function closeRedisCheckpointer(): Promise<void> {
  if (_redisState.client) {
    await _redisState.client.quit();
    console.log('[CheckpointService] Redis connection closed');
  }

  _redisState = {
    client: null,
    checkpointer: null,
    isConnected: false,
    lastHealthCheck: _redisState.lastHealthCheck,
  };
}

/**
 * Close the Postgres checkpointer gracefully
 */
export async function closePostgresCheckpointer(): Promise<void> {
  if (_postgresState.pool) {
    await _postgresState.pool.end();
    console.log('[CheckpointService] Postgres connection closed');
  }

  _postgresState = {
    pool: null,
    checkpointer: null,
    isConnected: false,
    lastHealthCheck: _postgresState.lastHealthCheck,
  };
}

/**
 * Close all checkpointers
 */
export async function closeAllCheckpointers(): Promise<void> {
  await closeRedisCheckpointer();
  await closePostgresCheckpointer();
}

// ============================================
// Utility Functions
// ============================================

/**
 * Utility: Generate thread configuration for graph invocation
 */
export function createThreadConfig(threadId: string, checkpointNs?: string): {
  configurable: {
    thread_id: string;
    checkpoint_ns?: string;
  };
} {
  return {
    configurable: {
      thread_id: threadId,
      ...(checkpointNs && { checkpoint_ns: checkpointNs }),
    },
  };
}

export type { CheckpointConfig, AnyCheckpointer };
