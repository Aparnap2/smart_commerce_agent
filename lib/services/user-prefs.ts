/**
 * User Preference Service
 *
 * Manages user query embeddings for preference-based search:
 * - Generates embeddings using local ML models
 * - Stores/retrieves embeddings from pgvector
 * - Updates preferences based on conversation context
 *
 * Uses PostgreSQL with pgvector (Supabase removed)
 */

import { queryDatabase } from '../tools/database';
import { env } from '../env';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Context types for user queries
 */
export type PreferenceContextType =
  | 'product_search'
  | 'order_inquiry'
  | 'ticket_lookup'
  | 'general_support'
  | 'recommendation';

/**
 * User embedding record
 */
export interface UserEmbeddingRecord {
  id: string;
  user_id: string;
  embedding: number[];
  query_text: string;
  context_type: string;
  context_id?: string;
  created_at: string;
}

/**
 * Result of embedding generation
 */
export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  error?: string;
}

/**
 * Result of preference retrieval
 */
export interface PreferenceResult {
  preferences: UserEmbeddingRecord[];
  similar_count: number;
  error?: string;
}

/**
 * Query result for preferences
 */
export interface PreferenceQueryResult {
  data: UserEmbeddingRecord[];
  error?: Error;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get embedding configuration from environment
 */
export function getEmbeddingConfig() {
  // Note: These environment variables should be added to .env.local
  // For now, we use defaults that work with local Ollama
  return {
    provider: 'local',
    model: 'nomic-embed-text',
    dimensions: 768,
    endpoint: 'http://localhost:11434/api/embeddings',
  };
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding for a query using local Ollama
 * (In production, this would call a local embedding model)
 */
export async function generateQueryEmbedding(
  query: string
): Promise<EmbeddingResult> {
  const config = getEmbeddingConfig();

  // Check for local Ollama availability
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: query,
        options: { num_predict: config.dimensions },
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      embedding: data.embedding || data.embeddings?.[0] || [],
      model: config.model,
      dimensions: config.dimensions,
    };
  } catch (error) {
    console.error('[USER_PREFS] Embedding generation error:', error);

    // Return fallback embedding (all zeros)
    return {
      embedding: new Array(config.dimensions).fill(0),
      model: config.model,
      dimensions: config.dimensions,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Preference Storage
// ============================================================================

/**
 * Store a user preference embedding
 */
export async function storePreference(params: {
  userId: string;
  queryText: string;
  embedding: number[];
  contextType: PreferenceContextType;
  contextId?: string;
}): Promise<PreferenceQueryResult> {
  const { userId, queryText, embedding, contextType, contextId } = params;

  try {
    const result = await queryDatabase(
      `INSERT INTO "UserEmbedding" (id, user_id, embedding, query_text, context_type, context_id, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [userId, JSON.stringify(embedding), queryText, contextType, contextId || null]
    );

    return { data: result as UserEmbeddingRecord[] };
  } catch (error) {
    console.error('[USER_PREFS] Store preference error:', error);
    return {
      data: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Store multiple preferences in a batch
 */
export async function storePreferencesBatch(
  preferences: Array<{
    userId: string;
    queryText: string;
    embedding: number[];
    contextType: PreferenceContextType;
    contextId?: string;
  }>
): Promise<PreferenceQueryResult> {
  if (preferences.length === 0) {
    return { data: [] };
  }

  try {
    const values = preferences
      .map(
        (p) =>
          `(gen_random_uuid(), '${p.userId}', '${JSON.stringify(p.embedding).replace(/'/g, "''")}', '${p.queryText.replace(/'/g, "''")}', '${p.contextType}', ${p.contextId ? `'${p.contextId}'` : 'NULL'}, NOW(), NOW())`
      )
      .join(', ');

    const result = await queryDatabase(
      `INSERT INTO "UserEmbedding" (id, user_id, embedding, query_text, context_type, context_id, created_at, updated_at)
       VALUES ${values}
       RETURNING *`
    );

    return { data: result as UserEmbeddingRecord[] };
  } catch (error) {
    console.error('[USER_PREFS] Batch store error:', error);
    return {
      data: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Find similar embeddings for a user
 */
export async function getSimilarPreferences(params: {
  userId: string;
  embedding: number[];
  limit?: number;
  threshold?: number;
}): Promise<PreferenceResult> {
  const { userId, embedding, limit = 10, threshold = 0.7 } = params;

  try {
    const result = await queryDatabase(
      `SELECT * FROM "UserEmbedding"
       WHERE user_id = $1
       ORDER BY embedding <=> $2::vector
       LIMIT $3`,
      [userId, JSON.stringify(embedding), limit]
    );

    const embeddings = result as (UserEmbeddingRecord & { similarity: number })[];
    const validEmbeddings = embeddings.filter(
      (e) => 1 - (e.similarity || 0) >= threshold
    );

    return {
      preferences: validEmbeddings,
      similar_count: validEmbeddings.length,
    };
  } catch (error) {
    console.error('[USER_PREFS] Get similar preferences error:', error);
    return {
      preferences: [],
      similar_count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all user preferences
 */
export async function getUserPreferences(
  userId: string
): Promise<PreferenceResult> {
  try {
    const result = await queryDatabase(
      `SELECT * FROM "UserEmbedding"
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return {
      preferences: result as UserEmbeddingRecord[],
      similar_count: result.length,
    };
  } catch (error) {
    console.error('[USER_PREFS] Get user preferences error:', error);
    return {
      preferences: [],
      similar_count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update preferences from conversation context
 */
export async function updatePreferencesFromContext(params: {
  userId: string;
  contextType: PreferenceContextType;
  contextId?: string;
  queryText: string;
  embedding: number[];
}): Promise<PreferenceQueryResult> {
  const { userId, contextType, contextId, queryText, embedding } = params;

  return storePreference({
    userId,
    queryText,
    embedding,
    contextType,
    contextId,
  });
}

/**
 * Consolidate user preferences (keep only recent unique ones)
 */
export async function consolidateUserPreferences(
  userId: string,
  keepCount: number = 50
): Promise<{ deleted: number; error?: string }> {
  try {
    const result = await queryDatabase(
      `WITH ranked AS (
         SELECT id, ROW_NUMBER() OVER (PARTITION BY query_text ORDER BY created_at DESC) as rn
         FROM "UserEmbedding"
         WHERE user_id = $1
       )
       DELETE FROM "UserEmbedding"
       WHERE id IN (
         SELECT id FROM ranked WHERE rn > $2
       )`,
      [userId, keepCount]
    );

    return { deleted: result.length };
  } catch (error) {
    console.error('[USER_PREFS] Consolidate preferences error:', error);
    return {
      deleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cleanup old preferences (older than specified days)
 */
export async function cleanupOldPreferences(
  userId: string,
  olderThanDays: number = 90
): Promise<{ deleted: number; error?: string }> {
  try {
    const result = await queryDatabase(
      `DELETE FROM "UserEmbedding"
       WHERE user_id = $1
       AND created_at < NOW() - INTERVAL '${olderThanDays} days'`,
      [userId]
    );

    return { deleted: result.length };
  } catch (error) {
    console.error('[USER_PREFS] Cleanup old preferences error:', error);
    return {
      deleted: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get preference statistics for a user
 */
export async function getPreferenceStats(userId: string): Promise<{
  total: number;
  byContext: Record<string, number>;
  oldest: string | null;
  newest: string | null;
}> {
  try {
    const [totalResult, contextResult, oldestResult, newestResult] = await Promise.all([
      queryDatabase(`SELECT COUNT(*) as count FROM "UserEmbedding" WHERE user_id = $1`, [userId]),
      queryDatabase(
        `SELECT context_type, COUNT(*) as count FROM "UserEmbedding" WHERE user_id = $1 GROUP BY context_type`,
        [userId]
      ),
      queryDatabase(
        `SELECT MIN(created_at) as oldest FROM "UserEmbedding" WHERE user_id = $1`,
        [userId]
      ),
      queryDatabase(
        `SELECT MAX(created_at) as newest FROM "UserEmbedding" WHERE user_id = $1`,
        [userId]
      ),
    ]);

    const byContext: Record<string, number> = {};
    for (const row of contextResult) {
      byContext[row.context_type] = row.count;
    }

    return {
      total: totalResult[0]?.count || 0,
      byContext,
      oldest: oldestResult[0]?.oldest || null,
      newest: newestResult[0]?.newest || null,
    };
  } catch (error) {
    console.error('[USER_PREFS] Get preference stats error:', error);
    return {
      total: 0,
      byContext: {},
      oldest: null,
      newest: null,
    };
  }
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate embedding format and dimensions
 */
export function validateEmbedding(
  embedding: unknown,
  expectedDimensions: number = 768
): { valid: boolean; dimensions?: number; error?: string } {
  if (!Array.isArray(embedding)) {
    return { valid: false, error: 'Embedding must be an array' };
  }

  if (embedding.length === 0) {
    return { valid: false, error: 'Embedding array is empty' };
  }

  if (embedding.length !== expectedDimensions) {
    return {
      valid: false,
      dimensions: embedding.length,
      error: `Expected ${expectedDimensions} dimensions, got ${embedding.length}`,
    };
  }

  // Check all values are numbers
  if (!embedding.every((v) => typeof v === 'number' && !isNaN(v))) {
    return { valid: false, error: 'Embedding contains non-numeric values' };
  }

  // Check for NaN or Infinity
  if (embedding.some((v) => !isFinite(v))) {
    return { valid: false, error: 'Embedding contains non-finite values' };
  }

  return { valid: true, dimensions: embedding.length };
}
