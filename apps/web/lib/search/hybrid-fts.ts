/**
 * Hybrid FTS + pgvector Search Module
 * 
 * Two-stage retrieval for e-commerce search:
 * 1. Stage 1: PostgreSQL FTS (tsvector) - fast keyword matching
 * 2. Stage 2: pgvector rerank - semantic similarity reordering
 * 
 * Optimized for queries like:
 * - "Nike React" (brand + product)
 * - "wireless headphones under $100" (semantic + filter)
 * - "running shoes" (synonyms via vector)
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { generateEmbedding } from '@/lib/llm/provider';

const prisma = new PrismaClient();

/**
 * Search filters for product search
 */
export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  brand?: string;
  inStock?: boolean;
}

/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
}

/**
 * Product search result
 */
export interface ProductSearchResult {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image: string | null;
  category: string | null;
  brand: string | null;
  sku: string | null;
  rating: number | null;
  _score?: number;
  _distance?: number;
}

/**
 * Search result with metadata
 */
export interface SearchResult {
  results: ProductSearchResult[];
  total: number;
  query: string;
  latencyMs?: number;
  stage: 'fts_only' | 'hybrid_reranked';
}

/**
 * Build FTS query from user input
 * Handles prefix matching for autocomplete-style queries
 */
function buildFTSQuery(input: string): string {
  return input
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => `${term}:*`) // Prefix matching
    .join(' & ');
}

/**
 * Build WHERE clause for filters
 */
function buildFilterClause(filters: SearchFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (filters.minPrice !== undefined) {
    conditions.push(Prisma.sql`price >= ${filters.minPrice}`);
  }

  if (filters.maxPrice !== undefined) {
    conditions.push(Prisma.sql`price <= ${filters.maxPrice}`);
  }

  if (filters.category) {
    conditions.push(Prisma.sql`category = ${filters.category}`);
  }

  if (filters.brand) {
    conditions.push(Prisma.sql`brand = ${filters.brand}`);
  }

  if (filters.inStock) {
    conditions.push(Prisma.sql`stock > 0`);
  }

  if (conditions.length === 0) {
    return Prisma.empty;
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

/**
 * FTS-first hybrid search with pgvector reranking
 * 
 * Architecture:
 * 1. Use FTS to get top 50 candidates (fast, indexed)
 * 2. Generate query embedding
 * 3. Rerank candidates by vector similarity
 * 4. Apply pagination
 */
export async function hybridProductSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const startTime = Date.now();
  const { limit = 20, offset = 0, filters = {} } = options;

  if (!query || query.trim().length === 0) {
    return {
      results: [],
      total: 0,
      query,
      latencyMs: Date.now() - startTime,
      stage: 'fts_only',
    };
  }

  // Stage 1: FTS to get candidate pool
  const ftsQuery = buildFTSQuery(query);

  const filterClause = buildFilterClause(filters);

  // Get candidates with FTS score
  const candidates = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 
      id, 
      name, 
      description, 
      price, 
      stock, 
      image,
      category,
      brand,
      sku,
      rating,
      ts_rank("searchVector", to_tsquery('english', '${ftsQuery}')) as fts_score
    FROM "Product"
    WHERE "searchVector" @@ to_tsquery('english', '${ftsQuery}')
    ${filterClause}
    ORDER BY fts_score DESC
    LIMIT 50
  `);

  if (candidates.length === 0) {
    return {
      results: [],
      total: 0,
      query,
      latencyMs: Date.now() - startTime,
      stage: 'fts_only',
    };
  }

  // Stage 2: Generate query embedding and rerank by semantic similarity
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch (error) {
    // If embedding fails, return FTS results without reranking
    console.warn('[Search] Embedding generation failed, returning FTS results:', error);
    return {
      results: candidates.slice(offset, offset + limit).map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        price: c.price,
        stock: c.stock,
        image: c.image,
        category: c.category,
        brand: c.brand,
        sku: c.sku,
        rating: c.rating,
        _score: c.fts_score,
      })),
      total: candidates.length,
      query,
      latencyMs: Date.now() - startTime,
      stage: 'fts_only',
    };
  }

  // Rerank candidates by vector similarity using cosine distance
  const candidateIds = candidates.map(c => c.id);
  
  const reranked = await (prisma.$queryRawUnsafe as any)(`
    SELECT 
      p.id,
      p.name,
      p.description,
      p.price,
      p.stock,
      p.image,
      p.category,
      p.brand,
      p.sku,
      p.rating,
      (p.embedding <=> '${queryEmbedding}'::vector) as semantic_distance
    FROM unnest(ARRAY[${candidateIds.join(',')}]) WITH ORDINALITY AS t(id, ord)
    JOIN "Product" p ON p.id = t.id
    ORDER BY semantic_distance ASC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  return {
    results: reranked.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      stock: r.stock,
      image: r.image,
      category: r.category,
      brand: r.brand,
      sku: r.sku,
      rating: r.rating,
      _distance: r.semantic_distance,
    })),
    total: candidates.length,
    query,
    latencyMs: Date.now() - startTime,
    stage: 'hybrid_reranked',
  };
}

/**
 * Pure semantic search using pgvector (fallback for complex queries)
 */
export async function semanticProductSearch(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const startTime = Date.now();
  const { limit = 20, filters = {} } = options;

  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(query);
  } catch (error) {
    console.error('[Search] Embedding generation failed:', error);
    return {
      results: [],
      total: 0,
      query,
      latencyMs: Date.now() - startTime,
      stage: 'fts_only',
    };
  }

  const filterClause = buildFilterClause(filters);

  // Use raw query with proper type casting
  const embeddingJson = JSON.stringify(queryEmbedding);
  
  const results = await (prisma.$queryRawUnsafe as any)(`
    SELECT 
      id, name, description, price, stock, image, category, brand, sku, rating,
      (embedding <=> '${embeddingJson}'::vector) as distance
    FROM "Product"
    WHERE embedding IS NOT NULL
    ${filterClause}
    ORDER BY distance ASC
    LIMIT ${limit}
  `);

  return {
    results: results.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      stock: r.stock,
      image: r.image,
      category: r.category,
      brand: r.brand,
      sku: r.sku,
      rating: r.rating,
      _distance: r.distance,
    })),
    total: results.length,
    query,
    latencyMs: Date.now() - startTime,
    stage: 'fts_only',
  };
}

/**
 * Autocomplete using trigram similarity
 * Uses PostgreSQL's pg_trgm extension for fast prefix matching
 */
export async function autocompleteProducts(
  prefix: string,
  limit: number = 5
): Promise<{ name: string; id: number; category: string | null }[]> {
  if (!prefix || prefix.length < 2) {
    return [];
  }

  const results = await (prisma.$queryRawUnsafe as any)(`
    SELECT DISTINCT 
      id,
      name,
      category,
      similarity(name, '${prefix}') as sim_score
    FROM "Product"
    WHERE name % '${prefix}'
    ORDER BY sim_score DESC, name
    LIMIT ${limit}
  `);

  return results.map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
  }));
}

/**
 * Get similar products using vector similarity
 */
export async function getSimilarProducts(
  productId: number,
  limit: number = 5
): Promise<ProductSearchResult[]> {
  const product = await (prisma.$queryRawUnsafe as any)(`
    SELECT embedding FROM "Product" WHERE id = ${productId}
  `);

  if (!product[0]?.embedding) {
    // Fallback to category-based similarity
    const fallback = await prisma.product.findMany({
      where: { id: { not: productId } },
      take: limit,
    });
    return fallback.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      stock: p.stock,
      image: p.image,
      category: p.category,
      brand: (p as any).brand || null,
      sku: p.sku,
      rating: p.rating,
    }));
  }

  const similar = await (prisma.$queryRawUnsafe as any)(`
    SELECT 
      id,
      name,
      description,
      price,
      stock,
      image,
      category,
      brand,
      sku,
      rating,
      (embedding <=> '${product[0].embedding}'::vector) as distance
    FROM "Product"
    WHERE id != ${productId}
      AND embedding IS NOT NULL
    ORDER BY distance ASC
    LIMIT ${limit}
  `);

  return similar.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    price: r.price,
    stock: r.stock,
    image: r.image,
    category: r.category,
    brand: r.brand,
    sku: r.sku,
    rating: r.rating,
    _distance: r.distance,
  }));
}

/**
 * Get product by ID
 */
export async function getProductById(productId: number): Promise<ProductSearchResult | null> {
  const product = await (prisma.$queryRawUnsafe as any)(`
    SELECT id, name, description, price, stock, image, category, brand, sku, rating
    FROM "Product" WHERE id = ${productId}
  `);

  if (!product[0]) {
    return null;
  }

  const r = product[0];
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    price: r.price,
    stock: r.stock,
    image: r.image,
    category: r.category,
    brand: r.brand,
    sku: r.sku,
    rating: r.rating,
  };
}

/**
 * Generate and store embeddings for all products without them
 * Used for initial setup or batch updates
 */
export async function generateProductEmbeddings(): Promise<number> {
  const productsWithoutEmbedding = await prisma.product.findMany({
    where: {
      embeddings: null,
    } as any,
    select: { id: true, name: true, description: true },
  });

  let count = 0;
  for (const product of productsWithoutEmbedding) {
    try {
      const text = `${product.name} ${product.description || ''}`;
      const embedding = await generateEmbedding(text);

      await prisma.$executeRawUnsafe(
        `UPDATE "Product" SET embedding = $1::vector WHERE id = $2`,
        JSON.stringify(embedding),
        product.id
      );
      count++;
    } catch (error) {
      console.error(`[Search] Failed to generate embedding for product ${product.id}:`, error);
    }
  }

  return count;
}

export default {
  hybridProductSearch,
  semanticProductSearch,
  autocompleteProducts,
  getSimilarProducts,
  getProductById,
  generateProductEmbeddings,
};
