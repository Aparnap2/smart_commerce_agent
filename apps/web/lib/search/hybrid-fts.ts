/**
 * Hybrid FTS Search — Migration Stub
 * 
 * Real implementation moved to apps/commerce-api.
 * This stub delegates to commerce-api for backward compatibility.
 * TODO: Delete after all import sites migrate to commerce-api directly.
 */

import type { Product } from '@smart-commerce/types';

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  brand?: string;
  inStock?: boolean;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
}

export interface ProductSearchResult {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image: string | null;
  category: string | null;
  brand: string | null;
}

/**
 * Hybrid search via commerce-api MCP endpoint
 */
export async function hybridProductSearch(
  query: string,
  options: SearchOptions = {}
): Promise<ProductSearchResult[]> {
  const base = process.env.COMMERCE_API_URL ?? 'http://localhost:3001';
  
  try {
    const res = await fetch(`${base}/mcp/graphql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query HybridSearch($q: String!, $limit: Int, $filters: SearchFilters) {
            hybridSearch(query: $q, limit: $limit, filters: $filters) {
              results {
                id
                name
                description
                price
                stock
                image
                category
                brand
              }
            }
          }
        `,
        variables: {
          q: query,
          limit: options.limit ?? 10,
          filters: options.filters,
        },
      }),
    });

    if (!res.ok) {
      console.warn(`[hybrid-fts] commerce-api returned ${res.status}`);
      return [];
    }

    const json = await res.json();
    return json?.data?.hybridSearch?.results ?? [];
  } catch (err) {
    console.warn('[hybrid-fts] Search failed:', err);
    return [];
  }
}

/**
 * Autocomplete via commerce-api
 */
export async function autocompleteProducts(
  query: string,
  limit = 5
): Promise<Array<{ id: string; name: string }>> {
  const base = process.env.COMMERCE_API_URL ?? 'http://localhost:3001';
  
  try {
    const res = await fetch(`${base}/mcp/graphql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query Autocomplete($q: String!, $limit: Int) {
            autocomplete(query: $q, limit: $limit) {
              id
              name
            }
          }
        `,
        variables: { q: query, limit },
      }),
    });

    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.autocomplete ?? [];
  } catch {
    return [];
  }
}

/**
 * Get product by ID via commerce-api
 */
export async function getProductById(
  id: string
): Promise<ProductSearchResult | null> {
  const base = process.env.COMMERCE_API_URL ?? 'http://localhost:3001';
  
  try {
    const res = await fetch(`${base}/mcp/graphql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetProduct($id: ID!) {
            product(id: $id) {
              id
              name
              description
              price
              stock
              image
              category
              brand
            }
          }
        `,
        variables: { id },
      }),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.product ?? null;
  } catch {
    return null;
  }
}

/**
 * Get similar products via commerce-api
 */
export async function getSimilarProducts(
  productId: string,
  limit = 5
): Promise<ProductSearchResult[]> {
  const base = process.env.COMMERCE_API_URL ?? 'http://localhost:3001';
  
  try {
    const res = await fetch(`${base}/mcp/graphql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query SimilarProducts($id: ID!, $limit: Int) {
            similarProducts(productId: $id, limit: $limit) {
              id
              name
              description
              price
              stock
              image
              category
              brand
            }
          }
        `,
        variables: { id: productId, limit },
      }),
    });

    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.similarProducts ?? [];
  } catch {
    return [];
  }
}

export default hybridProductSearch;
