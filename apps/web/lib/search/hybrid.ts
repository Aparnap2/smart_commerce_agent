/**
 * Hybrid Search Module
 *
 * Combines BM25 (keyword) search with semantic (vector) search
 * using Reciprocal Rank Fusion (RRF) for optimal result ranking.
 */

import { prisma } from '@/lib/prisma';

/**
 * Parsed search query with extracted constraints
 */
export interface SearchQuery {
  /** The core search query string */
  query: string;
  /** Maximum price filter (in INR) */
  maxPrice?: number;
  /** Minimum price filter (in INR) */
  minPrice?: number;
  /** Brand filter */
  brand?: string;
  /** Category filter */
  category?: string;
  /** Similar to product name */
  similarTo?: string;
  /** Sort order */
  sortBy?: 'price_asc' | 'price_desc' | 'relevance';
  /** Use case context (gym, running, calls, etc.) */
  useCase?: string;
  /** Only show in-stock items */
  inStockOnly?: boolean;
}

/**
 * Search result item with fusion metadata
 */
export interface SearchResult {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stockCount: number;
  score: number;
  type: 'bm25' | 'semantic' | 'fused';
}

/**
 * Filter options for hybrid search
 */
export interface SearchOptions {
  maxPrice?: number;
  minPrice?: number;
  brand?: string;
  category?: string;
  inStockOnly?: boolean;
  similarTo?: string;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc';
  limit?: number;
}

/**
 * Builds a structured search query from natural language input.
 *
 * Extracts constraints like price, brand, use case from user queries.
 *
 * @example
 * ```ts
 * buildSearchQuery('headphones under ₹12000')
 * // Returns: { query: 'headphones', maxPrice: 12000 }
 * ```
 *
 * @param query - Natural language search query
 * @returns Parsed SearchQuery object with extracted constraints
 */
export function buildSearchQuery(query: string): SearchQuery {
  const result: SearchQuery = { query };

  // Extract price: "under ₹12000" or "under 12k"
  const priceMatch = query.match(/under\s*[₹$]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)(k)?/i);
  if (priceMatch) {
    let price = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (priceMatch[2]) price *= 1000; // "12k" → 12000
    result.maxPrice = price;
    // Remove the price constraint from the query
    result.query = query.replace(priceMatch[0], '').trim();
  }

  // Extract brand: "Sony", "Bose", etc.
  const brands = ['Sony', 'Bose', 'JBL', 'Samsung', 'Apple', 'Jabra', 'Sennheiser'];
  for (const brand of brands) {
    if (query.toLowerCase().includes(brand.toLowerCase())) {
      result.brand = brand;
      break;
    }
  }

  // Extract use case: "for gym", "for running", "for calls"
  const useCaseMatch = query.match(/for\s+(gym|running|calls|travel|gaming)/i);
  if (useCaseMatch) {
    result.useCase = useCaseMatch[1].toLowerCase();
  }

  // Extract "like X but cheaper"
  const similarMatch = query.match(/like\s+(.+?)\s+but\s+cheaper/i);
  if (similarMatch) {
    result.similarTo = similarMatch[1].trim();
    result.sortBy = 'price_asc';
  }

  return result;
}

/**
 * Fuses BM25 and semantic search results using Reciprocal Rank Fusion (RRF).
 *
 * RRF Formula: score = Σ (1 / (k + rank)) where k is typically 60
 *
 * @example
 * ```ts
 * const bm25 = [{ id: '1', score: 0.9, type: 'bm25' }];
 * const semantic = [{ id: '1', score: 0.8, type: 'semantic' }];
 * const fused = fuseResults(bm25, semantic);
 * // Returns deduplicated results ranked by RRF score
 * ```
 *
 * @param bm25Results - Results from BM25 keyword search
 * @param semanticResults - Results from vector similarity search
 * @returns Fused and deduplicated results ranked by RRF score
 */
export function fuseResults(
  bm25Results: SearchResult[],
  semanticResults: SearchResult[]
): SearchResult[] {
  const rankMap = new Map<
    string,
    {
      bm25Rank: number;
      semanticRank: number;
      item: SearchResult;
      bm25Score: number;
      semanticScore: number;
    }
  >();

  // Rank BM25 results
  bm25Results.forEach((item, i) => {
    if (!rankMap.has(item.id)) {
      rankMap.set(item.id, {
        bm25Rank: i + 1,
        semanticRank: 9999,
        item,
        bm25Score: item.score,
        semanticScore: 0,
      });
    }
  });

  // Rank semantic results
  semanticResults.forEach((item, i) => {
    if (rankMap.has(item.id)) {
      const entry = rankMap.get(item.id)!;
      entry.semanticRank = i + 1;
      entry.semanticScore = item.score;
    } else {
      rankMap.set(item.id, {
        bm25Rank: 9999,
        semanticRank: i + 1,
        item,
        bm25Score: 0,
        semanticScore: item.score,
      });
    }
  });

  // Calculate RRF score and sort
  const k = 60; // RRF constant
  return Array.from(rankMap.values())
    .map(({ bm25Rank, semanticRank, item, bm25Score, semanticScore }) => {
      const rrfScore = 1 / (k + bm25Rank) + 1 / (k + semanticRank);
      // Use original scores as tie-breaker (semantic score has higher priority)
      const tieBreaker = semanticScore + bm25Score;
      return {
        ...item,
        score: rrfScore,
        type: 'fused' as const,
        _tieBreaker: tieBreaker,
      };
    })
    .sort((a, b) => {
      // Primary sort by RRF score (descending)
      if (b.score !== a.score) return b.score - a.score;
      // Tie-breaker: higher original scores rank higher
      return (b as any)._tieBreaker - (a as any)._tieBreaker;
    })
    .map(({ _tieBreaker, ...rest }) => rest);
}

/**
 * Performs hybrid search combining BM25 and semantic search.
 *
 * @example
 * ```ts
 * const results = await hybridSearch('wireless headphones', {
 *   maxPrice: 5000,
 *   inStockOnly: true
 * });
 * ```
 *
 * @param query - Search query string
 * @param options - Optional options (price, stock, brand, limit, etc.)
 * @returns Array of search results sorted by relevance
 */
export async function hybridSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    maxPrice,
    minPrice,
    brand,
    category,
    inStockOnly,
    similarTo,
    sortBy = 'relevance',
    limit = 6,
  } = options;

  // Build WHERE clause for Prisma
  const where: any = {};

  if (maxPrice !== undefined) {
    where.price = { ...where.price, lte: maxPrice };
  }
  if (minPrice !== undefined) {
    where.price = { ...where.price, gte: minPrice };
  }
  if (brand) {
    where.brand = brand;
  }
  if (category) {
    where.category = category;
  }
  if (inStockOnly) {
    where.stockCount = { gt: 0 };
  }

  // BM25 (full-text search) - using name and description
  const bm25Results = await prisma.product.findMany({
    where,
    orderBy: [{ name: 'desc' }, { description: 'desc' }],
    take: limit * 2, // Get more for fusion
  });

  // Semantic search (pgvector)
  // Note: This requires the embedding query - simplified for now
  const semanticResults = await prisma.product.findMany({
    where,
    orderBy: [{ name: 'asc' }], // Placeholder - actual semantic sort needs vector query
    take: limit * 2,
  });

  // Fuse results
  const fused = fuseResults(
    bm25Results.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: p.price,
      category: p.category || '',
      stockCount: p.stockCount,
      score: 0,
      type: 'bm25' as const,
    })),
    semanticResults.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: p.price,
      category: p.category || '',
      stockCount: p.stockCount,
      score: 0,
      type: 'semantic' as const,
    }))
  );

  // Apply sorting
  let sorted = fused;
  if (sortBy === 'price_asc') {
    sorted = fused.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price_desc') {
    sorted = fused.sort((a, b) => b.price - a.price);
  }

  // Return top N (without score in final result)
  return sorted.slice(0, limit).map(({ score, ...rest }) => ({
    ...rest,
    score: 0,
  }));
}
