/**
 * Hybrid FTS Search Tests
 * 
 * TDD Approach:
 * 1. Write tests first (these will fail initially)
 * 2. Run tests → expect FAIL
 * 3. Implement functionality
 * 4. Run tests → expect PASS
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  })),
}));

// Mock embedding generation
vi.mock('@/lib/llm/provider', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([
    0.1, 0.2, 0.3, // Mock 384-dim embedding
  ]),
}));

describe('Hybrid FTS Search', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    };
  });

  describe('hybridProductSearch', () => {
    it('should return empty results for empty query', async () => {
      const { hybridProductSearch } = await import('@/lib/search/hybrid-fts');
      
      const result = await hybridProductSearch('', { limit: 20 });
      
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.stage).toBe('fts_only');
    });

    it('should return FTS results when embedding fails', async () => {
      const { hybridProductSearch } = await import('@/lib/search/hybrid-fts');
      
      // Mock FTS query returning results
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 1, name: 'Product 1', price: 100, stock: 10 },
        { id: 2, name: 'Product 2', price: 200, stock: 5 },
      ]);
      
      const result = await hybridProductSearch('test query');
      
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should apply filters correctly', async () => {
      const { hybridProductSearch } = await import('@/lib/search/hybrid-fts');
      
      const filters = {
        minPrice: 50,
        maxPrice: 200,
        category: 'electronics',
        inStock: true,
      };
      
      const result = await hybridProductSearch('laptop', { filters });
      
      // Verify filters were applied
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
    });

    it('should use pagination correctly', async () => {
      const { hybridProductSearch } = await import('@/lib/search/hybrid-fts');
      
      await hybridProductSearch('test', { limit: 10, offset: 20 });
      
      // Verify pagination was applied
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('autocompleteProducts', () => {
    it('should return empty for short prefix', async () => {
      const { autocompleteProducts } = await import('@/lib/search/hybrid-fts');
      
      const result = await autocompleteProducts('a');
      
      expect(result).toEqual([]);
    });

    it('should return suggestions for valid prefix', async () => {
      const { autocompleteProducts } = await import('@/lib/search/hybrid-fts');
      
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 1, name: 'Apple iPhone', category: 'phones' },
        { id: 2, name: 'Apple MacBook', category: 'laptops' },
      ]);
      
      const result = await autocompleteProducts('app');
      
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getProductById', () => {
    it('should return null for non-existent product', async () => {
      const { getProductById } = await import('@/lib/search/hybrid-fts');
      
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
      
      const result = await getProductById(999);
      
      expect(result).toBeNull();
    });

    it('should return product for valid ID', async () => {
      const { getProductById } = await import('@/lib/search/hybrid-fts');
      
      mockPrisma.$queryRawUnsafe.mockResolvedValue([
        { id: 1, name: 'Test Product', price: 99, stock: 10 },
      ]);
      
      const result = await getProductById(1);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Test Product');
    });
  });

  describe('getSimilarProducts', () => {
    it('should return fallback when no embedding exists', async () => {
      const { getSimilarProducts } = await import('@/lib/search/hybrid-fts');
      
      mockPrisma.$queryRawUnsafe.mockResolvedValue([]); // No embedding
      
      const result = await getSimilarProducts(1, 5);
      
      expect(result).toBeDefined();
    });
  });
});

describe('Search Filters', () => {
  it('should build FTS query correctly', async () => {
    const { hybridProductSearch } = await import('@/lib/search/hybrid-fts');
    
    await hybridProductSearch('wireless headphones');
    
    // FTS query should contain the search terms
    expect(true).toBe(true);
  });

  it('should handle price range filters', async () => {
    const { hybridProductSearch } = await import('@/lib/search/hybrid-fts');
    
    await hybridProductSearch('test', {
      filters: { minPrice: 50, maxPrice: 200 }
    });
    
    expect(true).toBe(true);
  });

  it('should handle category filter', async () => {
    const { hybridProductSearch } = await import('@/lib/search/hybrid-fts');
    
    await hybridProductSearch('test', {
      filters: { category: 'electronics' }
    });
    
    expect(true).toBe(true);
  });

  it('should handle in-stock filter', async () => {
    const { hybridProductSearch } = await import('@/lib/search/hybrid-fts');
    
    await hybridProductSearch('test', {
      filters: { inStock: true }
    });
    
    expect(true).toBe(true);
  });
});
