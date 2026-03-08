/**
 * Search Products MCP Tool
 *
 * Provides hybrid search (BM25 + pgvector) for product catalog with
 * Zod validation, Langfuse tracing, and comprehensive filtering.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { hybridSearch, type SearchOptions } from '@/lib/search/hybrid';
import { initializeLangfuse } from '@/lib/observability/langfuse';

/**
 * Search products input schema with comprehensive validation
 */
export const searchProductsSchema = z.object({
  /** Natural language search query */
  query: z.string().min(1, 'Query cannot be empty'),
  /** Maximum price filter (in INR) */
  maxPrice: z.number().positive('Price must be positive').optional(),
  /** Minimum price filter (in INR) */
  minPrice: z.number().nonnegative('Price cannot be negative').optional(),
  /** Brand filter */
  brand: z.string().optional(),
  /** Category filter */
  category: z.string().optional(),
  /** Only show in-stock items */
  inStockOnly: z.boolean().default(true),
  /** Maximum results to return (1-20) */
  limit: z.number().int().positive('Limit must be positive').max(20, 'Limit cannot exceed 20').default(6),
});

/**
 * Inferred input type from schema
 */
export type SearchProductsInput = z.infer<typeof searchProductsSchema>;

/**
 * Product search result item
 */
export interface ProductSearchResult {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  stockCount: number;
}

/**
 * Search products tool result
 */
export type SearchProductsResult = {
  success: boolean;
  data?: {
    products: ProductSearchResult[];
    total: number;
  };
  error?: string;
  metadata?: {
    executionTime?: number;
    cached?: boolean;
    userId?: string;
    traced?: boolean;
  };
};

/**
 * MCP Tool definition for catalog.search
 *
 * Features:
 * - Zod schema validation at input boundary
 * - Hybrid search (BM25 + semantic) via pgvector
 * - Langfuse tracing for observability
 * - Comprehensive error handling
 *
 * @example
 * ```typescript
 * const result = await searchProducts.execute(
 *   { query: 'wireless headphones', maxPrice: 5000, inStockOnly: true },
 *   'user-123'
 * );
 * ```
 */
export const searchProducts = {
  /** Tool name for MCP protocol */
  name: 'catalog.search',

  /** Human-readable description */
  description: 'Search for products using natural language with hybrid matching (BM25 + pgvector)',

  /** Zod schema for input validation */
  schema: searchProductsSchema,

  /** Whether user ID is required for execution */
  requireUserId: false,

  /**
   * Execute the search products tool
   *
   * @param args - Search parameters validated against schema
   * @param userId - Optional user ID for tracing and personalization
   * @returns Search results with products matching the query
   *
   * @throws {z.ZodError} If input validation fails
   * @throws {Error} If database search fails
   */
  execute: async (args: unknown, userId: string | null): Promise<SearchProductsResult> => {
    // Initialize Langfuse for tracing
    const langfuse = initializeLangfuse();

    // Create trace for observability
    const trace = langfuse.trace({
      name: 'mcp.catalog.search',
      userId: userId ?? undefined,
      metadata: { input: args },
    });

    // Create span for execution tracking
    const span = trace.span({
      name: 'searchProducts.execute',
      input: args,
    });

    const startTime = Date.now();

    try {
      // Validate input with Zod (double-check even if MCP layer validated)
      const validatedArgs = await searchProductsSchema.parseAsync(args);

      // Build search options for hybrid search
      const searchOptions: SearchOptions = {
        maxPrice: validatedArgs.maxPrice,
        minPrice: validatedArgs.minPrice,
        brand: validatedArgs.brand,
        category: validatedArgs.category,
        inStockOnly: validatedArgs.inStockOnly,
        limit: validatedArgs.limit,
      };

      // Execute hybrid search
      const products = await hybridSearch(validatedArgs.query, searchOptions);

      const executionTime = Date.now() - startTime;

      // End span with success metadata
      span.end({
        output: { productCount: products.length },
        metadata: { latency: executionTime },
      });

      return {
        success: true,
        data: { products, total: products.length },
        metadata: {
          executionTime,
          userId: userId ?? undefined,
          traced: true,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Search failed';

      // End span with error
      span.end({
        level: 'ERROR',
        statusMessage: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        metadata: {
          executionTime,
          userId: userId ?? undefined,
          traced: true,
        },
      };
    }
  },
};
