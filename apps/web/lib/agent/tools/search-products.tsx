"use server";

/**
 * Search Products Tool - NL Filtering with LLM-Native Extraction
 *
 * Implements natural language filtering where the LLM extracts constraints
 * directly as Zod parameters from multi-turn conversation.
 *
 * Key features:
 * - Zod schema for structured parameter extraction
 * - Multi-turn context support via AI state
 * - Redis memory persistence for cross-session context
 * - Returns ProductGrid component for inline rendering
 * - Limits results to 6 items max (cognitive load management)
 * - **COMPACT SUMMARY**: Stores ~100 token summary in AIState, not full product array
 *
 * @file lib/agent/tools/search-products.ts
 */

import { z } from "zod";
import { hybridProductSearch, type ProductSearchResult } from "@/lib/search/hybrid-fts";
import { ProductGrid } from "@/components/genui/ProductGrid";
import { saveLastSearch, addToUserContext } from "@/lib/redis/memory";
import { generateToolSummary, type ProductSummaryData } from "./summarizer";
import { sanitizeForLLMContext } from "@/lib/safety/sanitize";

// ============================================================================
// Zod Schema for NL Filter Extraction
// ============================================================================

/**
 * Search products parameters schema
 *
 * The LLM extracts these parameters directly from natural language queries.
 * No Azure Language NER is used - the LLM handles extraction natively.
 */
export const SearchProductsParams = z.object({
  query: z.string().describe("What the user is searching for"),
  maxPrice: z.number().optional().describe("Maximum price constraint"),
  minPrice: z.number().optional().describe("Minimum price constraint"),
  brand: z.string().optional().describe("Brand name if mentioned"),
  useCase: z.string().optional().describe("Use case: gym, calls, gaming, etc."),
  similarTo: z.string().optional().describe("Product to find similar items to"),
  inStockOnly: z.boolean().default(true).describe("Only show in-stock items"),
  category: z.string().optional().describe("Product category"),
  limit: z.number().int().positive().max(6).default(6).describe("Maximum number of results (capped at 6)"),
});

export type SearchProductsParams = z.infer<typeof SearchProductsParams>;

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Search products tool configuration
 *
 * This tool is designed for use with Vercel AI SDK's tool calling patterns.
 * The LLM extracts filter parameters directly from conversation context.
 */
export const searchProductsTool = {
  description: "Search for products using natural language filters. Extract constraints from user queries and return matching products.",
  parameters: SearchProductsParams,
  generate: async function* (params: SearchProductsParams, options?: { userId?: string }) {
    // Yield intermediate "Searching..." state for better UX
    yield (
      <div className="text-zinc-500 dark:text-zinc-400 text-sm">
        Searching for {params.query}...
      </div>
    );

    // Build filters for hybrid search
    const filters: {
      maxPrice?: number;
      minPrice?: number;
      brand?: string;
      category?: string;
      inStock?: boolean;
    } = {};

    if (params.maxPrice !== undefined) {
      filters.maxPrice = params.maxPrice;
    }
    if (params.minPrice !== undefined) {
      filters.minPrice = params.minPrice;
    }
    if (params.brand !== undefined) {
      filters.brand = params.brand;
    }
    if (params.category !== undefined) {
      filters.category = params.category;
    }
    if (params.inStockOnly !== undefined) {
      filters.inStock = params.inStockOnly;
    }

    // Call existing hybrid search
    const results = await hybridProductSearch(params.query, {
      limit: params.limit,
      filters,
    });

    // Map results to ProductGrid format
    // CRITICAL: Sanitize ALL database content before LLM context to prevent prompt injection
    const products = results.map((result) => ({
      id: result.id,
      name: sanitizeForLLMContext(result.name),
      price: result.price,
      description: result.description ? sanitizeForLLMContext(result.description) : undefined,
      image: result.image ?? "/placeholder-product.jpg",
      inStock: result.stock > 0,
      stockCount: result.stock,
      originalPrice: undefined, // Can be extended if discount data available
    }));

    // Generate compact summary for AIState storage (~100 tokens vs 3000+)
    // Full products array goes to UI component only, summary goes to AIState
    const summary = generateToolSummary('searchProducts', products, {
      query: params.query,
      filters: {
        maxPrice: params.maxPrice,
        minPrice: params.minPrice,
        brand: params.brand,
        category: params.category,
        inStockOnly: params.inStockOnly,
      },
    });

    // Log summary for debugging (optional - can be removed in production)
    console.log(`[SearchProducts] Summary: ${summary.summary} (${summary.tokenCount} tokens)`);

    // Save to Redis memory if userId is available
    if (options?.userId) {
      try {
        // Save last search context for multi-turn conversations
        await saveLastSearch(options.userId, {
          query: params.query,
          filters: {
            maxPrice: params.maxPrice,
            minPrice: params.minPrice,
            brand: params.brand,
            useCase: params.useCase,
            inStockOnly: params.inStockOnly,
            category: params.category,
          },
          resultsCount: results.length,
          summary: summary.summary, // Store compact summary, not full results
          timestamp: Date.now(),
        });

        // Track search action in user context
        await addToUserContext(options.userId, {
          type: 'search',
          data: {
            query: params.query,
            filters,
            resultsCount: results.length,
            summary: summary.summary,
          },
          timestamp: Date.now(),
        });
      } catch (error) {
        // Log error but don't fail the search - memory is optional
        console.error('Failed to save search to memory:', error);
      }
    }

    // Return ProductGrid component for inline rendering
    // Note: The full products array is passed to the component, but only the summary
    // should be stored in AIState by the calling code
    return (
      <ProductGrid
        products={products}
        total={products.length}
        query={params.query}
        summary={summary.summary}
      />
    );
  },
};

// ============================================================================
// Multi-Turn Context Helper
// ============================================================================

/**
 * Search context stored in AI state for multi-turn conversations
 *
 * Example usage:
 * ```typescript
 * // User: "Show me headphones"
 * // → searchProducts({ query: "headphones", inStockOnly: true })
 *
 * // User: "Actually under ₹10k"
 * // → searchProducts({
 * //      query: "headphones",  // ← from lastSearch
 * //      maxPrice: 10000,      // ← new constraint
 * //      inStockOnly: true
 * //    })
 * ```
 */
export interface SearchContext {
  query: string;
  filters: SearchProductsParams;
  resultsCount: number;
  summary: string; // Compact summary for AIState (~100 tokens)
  timestamp: number;
}

/**
 * Build search params from conversation context
 *
 * Combines new constraints with previous search context for follow-up queries.
 */
export function buildSearchParams(
  newParams: Partial<SearchProductsParams>,
  lastSearch?: SearchContext
): SearchProductsParams {
  // Safely get filters from last search
  const lastFilters = lastSearch?.filters;

  // Start with defaults, then inherit from last search, then apply new params
  const params: SearchProductsParams = {
    query: newParams.query ?? lastSearch?.query ?? "",
    maxPrice: newParams.maxPrice ?? lastFilters?.maxPrice,
    minPrice: newParams.minPrice ?? lastFilters?.minPrice,
    brand: newParams.brand ?? lastFilters?.brand,
    useCase: newParams.useCase ?? lastFilters?.useCase,
    similarTo: newParams.similarTo ?? lastFilters?.similarTo,
    inStockOnly: newParams.inStockOnly ?? lastFilters?.inStockOnly ?? true,
    category: newParams.category ?? lastFilters?.category,
    limit: newParams.limit ?? lastFilters?.limit ?? 6,
  };

  return params;
}

export default searchProductsTool;
