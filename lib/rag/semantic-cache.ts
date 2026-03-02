/**
 * Semantic Cache for RAG
 *
 * Caches query results using embedding-based similarity matching.
 * Uses Redis for storage with configurable TTL.
 *
 * @packageDocumentation
 */

import { Redis } from 'ioredis';
import { logger } from '../redis/logger.js';
import { getRedisClient } from '../redis/client.js';
import { embedQuery } from './service.js';

/**
 * Cache entry structure
 */
export interface CacheEntry {
  query: string;
  queryEmbedding: number[];
  results: unknown[];
  timestamp: number;
  ttl: number;
}

/**
 * Semantic cache configuration
 */
export interface SemanticCacheConfig {
  /** Redis client instance */
  redisClient: Redis;
  /** Cache key prefix */
  keyPrefix: string;
  /** Default TTL in seconds */
  ttlSeconds: number;
  /** Similarity threshold for cache hits */
  similarityThreshold: number;
  /** Maximum number of cached results to return */
  maxResults: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<SemanticCacheConfig> = {
  keyPrefix: 'rag:cache:',
  ttlSeconds: 3600, // 1 hour
  similarityThreshold: 0.95,
  maxResults: 10,
};

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Semantic Cache class for RAG query caching
 */
export class SemanticCache {
  private client: Redis;
  private config: Required<SemanticCacheConfig>;

  constructor(options: Partial<SemanticCacheConfig> = {}) {
    this.client = options.redisClient || getRedisClient();
    this.config = {
      ...DEFAULT_CONFIG,
      ...options,
    } as Required<SemanticCacheConfig>;
  }

  /**
   * Generate cache key from query hash
   */
  private getCacheKey(queryHash: string): string {
    return `${this.config.keyPrefix}${queryHash}`;
  }

  /**
   * Simple hash function for strings (for cache key generation)
   */
  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get cached results for a query
   *
   * @param query - User query
   * @returns Cached results or null if not found
   */
  async get(query: string): Promise<unknown[] | null> {
    try {
      // Generate embedding for the query
      const embeddingResult = await embedQuery(query);

      if (embeddingResult.error || embeddingResult.embedding.length === 0) {
        logger.warn('RAG', 'Failed to embed query for cache lookup', {
          error: embeddingResult.error,
        });
        return null;
      }

      const queryEmbedding = embeddingResult.embedding;

      // Get all cache keys
      const keys = await this.client.keys(`${this.config.keyPrefix}*`);

      if (keys.length === 0) {
        logger.debug('RAG', 'No cache entries found');
        return null;
      }

      // Check each cached entry for similarity
      for (const key of keys) {
        const cachedData = await this.client.get(key);
        if (!cachedData) {
          continue;
        }

        const entry: CacheEntry = JSON.parse(cachedData);

        // Check TTL
        if (Date.now() - entry.timestamp > entry.ttl * 1000) {
          await this.client.del(key);
          continue;
        }

        // Calculate similarity
        const similarity = cosineSimilarity(queryEmbedding, entry.queryEmbedding);

        if (similarity >= this.config.similarityThreshold) {
          logger.info('RAG', 'Cache hit', {
            query: query.substring(0, 50),
            similarity,
            cacheKey: key,
          });

          return entry.results.slice(0, this.config.maxResults);
        }
      }

      logger.debug('RAG', 'Cache miss', {
        query: query.substring(0, 50),
        checkedEntries: keys.length,
      });

      return null;
    } catch (error) {
      logger.error('RAG', 'Cache get error', error);
      return null;
    }
  }

  /**
   * Store results in cache
   *
   * @param query - User query
   * @param results - Results to cache
   * @param ttl - Optional TTL override
   */
  async set(query: string, results: unknown[], ttl?: number): Promise<void> {
    try {
      // Generate embedding for the query
      const embeddingResult = await embedQuery(query);

      if (embeddingResult.error || embeddingResult.embedding.length === 0) {
        logger.warn('RAG', 'Failed to embed query for caching', {
          error: embeddingResult.error,
        });
        return;
      }

      const queryEmbedding = embeddingResult.embedding;
      const queryHash = this.hashQuery(query);
      const cacheKey = this.getCacheKey(queryHash);

      const entry: CacheEntry = {
        query,
        queryEmbedding,
        results,
        timestamp: Date.now(),
        ttl: ttl || this.config.ttlSeconds,
      };

      await this.client.setex(
        cacheKey,
        entry.ttl,
        JSON.stringify(entry)
      );

      logger.info('RAG', 'Cache set', {
        query: query.substring(0, 50),
        cacheKey,
        resultCount: results.length,
        ttl: entry.ttl,
      });
    } catch (error) {
      logger.error('RAG', 'Cache set error', error);
      // Don't throw - cache failures should be silent
    }
  }

  /**
   * Clear all cached entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.client.keys(`${this.config.keyPrefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      logger.info('RAG', 'Cache cleared', {
        entriesRemoved: keys.length,
      });
    } catch (error) {
      logger.error('RAG', 'Cache clear error', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    entryCount: number;
    totalSize: number;
  }> {
    try {
      const keys = await this.client.keys(`${this.config.keyPrefix}*`);
      let totalSize = 0;

      for (const key of keys) {
        const size = await this.client.strlen(key);
        totalSize += size;
      }

      return {
        entryCount: keys.length,
        totalSize,
      };
    } catch (error) {
      logger.error('RAG', 'Cache stats error', error);
      return { entryCount: 0, totalSize: 0 };
    }
  }

  /**
   * Remove expired entries
   */
  async cleanup(): Promise<number> {
    try {
      const keys = await this.client.keys(`${this.config.keyPrefix}*`);
      let removed = 0;

      for (const key of keys) {
        const cachedData = await this.client.get(key);
        if (!cachedData) {
          continue;
        }

        const entry: CacheEntry = JSON.parse(cachedData);
        if (Date.now() - entry.timestamp > entry.ttl * 1000) {
          await this.client.del(key);
          removed++;
        }
      }

      if (removed > 0) {
        logger.info('RAG', 'Cache cleanup', {
          entriesRemoved: removed,
        });
      }

      return removed;
    } catch (error) {
      logger.error('RAG', 'Cache cleanup error', error);
      return 0;
    }
  }
}

/**
 * Create semantic cache instance
 */
export function createSemanticCache(
  options: Partial<SemanticCacheConfig> = {}
): SemanticCache {
  return new SemanticCache(options);
}

/**
 * Cache wrapper for RAG query functions
 */
export async function withCache<T>(
  query: string,
  fn: () => Promise<T>,
  cache: SemanticCache
): Promise<T> {
  // Try cache first
  const cached = await cache.get(query);
  if (cached !== null) {
    return cached as T;
  }

  // Execute function
  const result = await fn();

  // Cache the result
  await cache.set(query, result as unknown[]);

  return result;
}
