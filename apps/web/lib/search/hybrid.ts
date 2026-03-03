/**
 * Hybrid Search Module
 *
 * Implements hybrid search combining:
 * - BM25: Full-text search for exact/exact-ish matches
 * - pgvector: Semantic similarity search for user preferences
 *
 * Query routing logic determines which search strategy to use.
 */

import { queryDatabase } from '../tools/database';
import { generateQueryEmbedding } from '../services/user-prefs';
import { env } from '../env';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Search context types that determine routing strategy
 */
export type SearchContext =
  | 'product_search'
  | 'order_inquiry'
  | 'ticket_lookup'
  | 'general_support'
  | 'recommendation';

/**
 * Hybrid search result with scoring
 */
export interface HybridSearchResult {
  item: Record<string, unknown>;
  score: number;
  strategy: 'bm25' | 'vector' | 'hybrid';
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  minScore?: number;
  includeScore?: boolean;
}

/**
 * Search response
 */
export interface SearchResponse {
  results: HybridSearchResult[];
  total: number;
  query: string;
  context: SearchContext;
  strategy: 'bm25' | 'vector' | 'hybrid';
}

/**
 * Context for search execution
 */
export interface SearchContextType {
  type: SearchContext;
  userId?: string;
  filters?: Record<string, unknown>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize text for search (lowercase, trim)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Clean search query
 */
function cleanSearchQuery(query: string): string {
  // Remove extra whitespace
  const cleaned = query.replace(/\s+/g, ' ').trim();

  // Return quoted query if it contains special characters
  if (cleaned.match(/[^a-zA-Z0-9\s]/)) {
    return `"${cleaned}"`;
  }

  return cleaned;
}

// ============================================================================
// Core Search Functions
// ============================================================================

/**
 * Perform BM25 full-text search on products
 */
async function searchProductsBm25(
  searchText: string,
  options: SearchOptions = {}
): Promise<HybridSearchResult[]> {
  const limit = options.limit || 20;
  const cleanQuery = cleanSearchQuery(searchText);

  try {
    const result = await queryDatabase(
      `SELECT p.*, ts_rank(p.search_vector, websearch_to_tsquery('english', $1)) as rank
       FROM "Product" p
       WHERE p.search_vector @@ websearch_to_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      [cleanQuery, limit]
    );

    return result.map((row) => ({
      item: row,
      score: row.rank || 0,
      strategy: 'bm25' as const,
    }));
  } catch (error) {
    console.error('[HYBRID_SEARCH] BM25 search error:', error);
    return [];
  }
}

/**
 * Perform pgvector similarity search
 */
async function searchProductsVector(
  embedding: number[],
  options: SearchOptions = {}
): Promise<HybridSearchResult[]> {
  const limit = options.limit || 20;

  try {
    const result = await queryDatabase(
      `SELECT p.*, 1 - (p.embedding <=> $1::vector) as similarity
       FROM "Product" p
       WHERE p.embedding IS NOT NULL
       ORDER BY similarity DESC
       LIMIT $2`,
      [JSON.stringify(embedding), limit]
    );

    return result.map((row) => ({
      item: row,
      score: row.similarity || 0,
      strategy: 'vector' as const,
    }));
  } catch (error) {
    console.error('[HYBRID_SEARCH] Vector search error:', error);
    return [];
  }
}

/**
 * Combine BM25 and vector results using Reciprocal Rank Fusion
 */
function combineResults(
  bm25Results: HybridSearchResult[],
  vectorResults: HybridSearchResult[],
  limit: number = 20
): HybridSearchResult[] {
  // Create score maps
  const scoreMap = new Map<string, number>();

  // RRF formula: RRF(d) = 1 / (k + rank(d))
  const k = 60;

  bm25Results.forEach((result, rank) => {
    const key = String(result.item.id || JSON.stringify(result.item));
    const rrfScore = 1 / (k + rank + 1);
    scoreMap.set(key, (scoreMap.get(key) || 0) + rrfScore);
  });

  vectorResults.forEach((result, rank) => {
    const key = String(result.item.id || JSON.stringify(result.item));
    const rrfScore = 1 / (k + rank + 1);
    scoreMap.set(key, (scoreMap.get(key) || 0) + rrfScore);
  });

  // Sort by combined score and take top results
  const combined = Array.from(scoreMap.entries())
    .map(([key, score]) => ({
      key,
      score,
      strategy: 'hybrid' as const,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Get original items
  const itemMap = new Map<string, HybridSearchResult>();
  bm25Results.forEach((r) => {
    const key = String(r.item.id || JSON.stringify(r.item));
    itemMap.set(key, r);
  });
  vectorResults.forEach((r) => {
    const key = String(r.item.id || JSON.stringify(r.item));
    if (!itemMap.has(key)) {
      itemMap.set(key, r);
    }
  });

  return combined.map(({ key }) => ({
    ...itemMap.get(key)!,
    score: scoreMap.get(key)!,
  }));
}

// ============================================================================
// Main Export Functions
// ============================================================================

/**
 * Main hybrid search function with automatic query routing
 */
export async function hybridSearch(
  params: {
    query: string;
    context: SearchContext;
    options?: SearchOptions;
    userId?: string;
  }
): Promise<SearchResponse> {
  const { query, context, options = {} } = params;
  const limit = options.limit || 20;

  const searchLog = {
    timestamp: new Date().toISOString(),
    query: query.substring(0, 100),
    context,
    options,
  };
  console.log('[HYBRID_SEARCH] Starting search:', JSON.stringify(searchLog));

  try {
    // Route based on context
    switch (context) {
      case 'product_search':
      case 'recommendation': {
        // Try hybrid search first
        const embedding = await generateQueryEmbedding(query);

        if (embedding && !embedding.error) {
          const [bm25Results, vectorResults] = await Promise.all([
            searchProductsBm25(query, { limit }),
            searchProductsVector(embedding.embedding, { limit }),
          ]);

          const results = combineResults(bm25Results, vectorResults, limit);

          console.log(
            `[HYBRID_SEARCH] Hybrid search completed: ${results.length} results`
          );

          return {
            results,
            total: results.length,
            query,
            context,
            strategy: 'hybrid',
          };
        }

        // Fallback to BM25
        const bm25Results = await searchProductsBm25(query, { limit });

        console.log(
          `[HYBRID_SEARCH] BM25 fallback: ${bm25Results.length} results`
        );

        return {
          results: bm25Results,
          total: bm25Results.length,
          query,
          context,
          strategy: 'bm25',
        };
      }

      case 'order_inquiry': {
        const normalizedQuery = normalizeText(query);
        const results = await queryDatabase(
          `SELECT o.*, ts_rank(o.search_vector, websearch_to_tsquery('english', $1)) as rank
           FROM "Order" o
           WHERE o.search_vector @@ websearch_to_tsquery('english', $1)
           ORDER BY o.createdAt DESC
           LIMIT $2`,
          [cleanSearchQuery(normalizedQuery), limit]
        );

        return {
          results: results.map((row) => ({
            item: row,
            score: row.rank || 0,
            strategy: 'bm25' as const,
          })),
          total: results.length,
          query,
          context,
          strategy: 'bm25',
        };
      }

      case 'ticket_lookup': {
        const normalizedQuery = normalizeText(query);
        const results = await queryDatabase(
          `SELECT t.*, ts_rank(t.search_vector, websearch_to_tsquery('english', $1)) as rank
           FROM "SupportTicket" t
           WHERE t.search_vector @@ websearch_to_tsquery('english', $1)
           ORDER BY t.createdAt DESC
           LIMIT $2`,
          [cleanSearchQuery(normalizedQuery), limit]
        );

        return {
          results: results.map((row) => ({
            item: row,
            score: row.rank || 0,
            strategy: 'bm25' as const,
          })),
          total: results.length,
          query,
          context,
          strategy: 'bm25',
        };
      }

      case 'general_support':
      default: {
        // Search all tables
        const [products, orders, tickets] = await Promise.all([
          searchProductsBm25(query, { limit: 5 }),
          queryDatabase(
            `SELECT o.*, ts_rank(o.search_vector, websearch_to_tsquery('english', $1)) as rank
             FROM "Order" o
             WHERE o.search_vector @@ websearch_to_tsquery('english', $1)
             LIMIT 5`,
            [cleanSearchQuery(normalizeText(query))]
          ),
          queryDatabase(
            `SELECT t.*, ts_rank(t.search_vector, websearch_to_tsquery('english', $1)) as rank
             FROM "SupportTicket" t
             WHERE t.search_vector @@ websearch_to_tsquery('english', $1)
             LIMIT 5`,
            [cleanSearchQuery(normalizeText(query))]
          ),
        ]);

        return {
          results: [...products, ...orders.map((r) => ({
            item: r,
            score: r.rank || 0,
            strategy: 'bm25' as const,
          })), ...tickets.map((r) => ({
            item: r,
            score: r.rank || 0,
            strategy: 'bm25' as const,
          }))],
          total: products.length + orders.length + tickets.length,
          query,
          context,
          strategy: 'bm25',
        };
      }
    }
  } catch (error) {
    console.error('[HYBRID_SEARCH] Search error:', error);

    return {
      results: [],
      total: 0,
      query,
      context,
      strategy: 'bm25',
    };
  }
}

/**
 * Simple product search (convenience function)
 */
export async function searchProducts(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  return hybridSearch({
    query,
    context: 'product_search',
    options,
  });
}

/**
 * Search with user preferences (personalized results)
 */
export async function searchWithPreferences(
  query: string,
  userId: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  const result = await hybridSearch({
    query,
    context: 'recommendation',
    options,
    userId,
  });

  return result;
}

/**
 * Search orders
 */
export async function searchOrders(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  return hybridSearch({
    query,
    context: 'order_inquiry',
    options,
  });
}
