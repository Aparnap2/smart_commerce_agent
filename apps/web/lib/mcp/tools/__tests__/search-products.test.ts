import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { searchProducts } from '../search-products';
import { prisma } from '@/lib/prisma/client';

// Mock Prisma
vi.mock('@/lib/prisma/client', () => ({
  prisma: {
    product: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock Langfuse
vi.mock('@/lib/observability/langfuse', () => ({
  initializeLangfuse: () => ({
    trace: vi.fn(() => ({
      span: vi.fn(() => ({
        end: vi.fn(),
      })),
      end: vi.fn(),
    })),
  }),
}));

// Mock hybrid search
vi.mock('@/lib/search/hybrid', () => ({
  hybridSearch: vi.fn(),
}));

import { hybridSearch } from '@/lib/search/hybrid';

describe('searchProducts Tool', () => {
  describe('Schema Validation', () => {
    it('accepts valid search query with defaults', async () => {
      const result = await searchProducts.schema.parseAsync({
        query: 'headphones',
      });
      expect(result).toEqual({
        query: 'headphones',
        inStockOnly: true,
        limit: 6,
      });
    });

    it('accepts maxPrice constraint', async () => {
      const result = await searchProducts.schema.parseAsync({
        query: 'headphones',
        maxPrice: 5000,
      });
      expect(result.maxPrice).toBe(5000);
      expect(result.inStockOnly).toBe(true);
      expect(result.limit).toBe(6);
    });

    it('accepts brand filter', async () => {
      const result = await searchProducts.schema.parseAsync({
        query: 'headphones',
        brand: 'Sony',
      });
      expect(result.brand).toBe('Sony');
      expect(result.inStockOnly).toBe(true);
      expect(result.limit).toBe(6);
    });

    it('rejects negative prices', async () => {
      await expect(
        searchProducts.schema.parseAsync({
          query: 'headphones',
          maxPrice: -100,
        })
      ).rejects.toThrow();
    });

    it('rejects empty query', async () => {
      await expect(
        searchProducts.schema.parseAsync({ query: '' })
      ).rejects.toThrow();
    });
  });

  describe('Tool Execution', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('returns products matching query', async () => {
      // Mock hybrid search to return test data
      vi.mocked(hybridSearch).mockResolvedValue([
        {
          id: 'test-1',
          name: 'Sony WH-1000XM5',
          description: 'Wireless headphones',
          price: 29990,
          category: 'headphones',
          stockCount: 10,
          score: 0,
          type: 'fused',
        },
      ]);

      const result = await searchProducts.execute(
        { query: 'headphones' },
        'test-user'
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as any).products).toHaveLength(1);
      expect(hybridSearch).toHaveBeenCalledWith('headphones', expect.objectContaining({
        inStockOnly: true,
        limit: 6,
      }));
    });

    it('filters by maxPrice', async () => {
      vi.mocked(hybridSearch).mockResolvedValue([
        {
          id: 'test-1',
          name: 'Cheap Headphones',
          description: 'Budget friendly',
          price: 2999,
          category: 'headphones',
          stockCount: 5,
          score: 0,
          type: 'fused',
        },
      ]);

      const result = await searchProducts.execute(
        { query: 'headphones', maxPrice: 5000 },
        'test-user'
      );

      expect(result.success).toBe(true);
      expect((result.data as any).products).toHaveLength(1);
      expect((result.data as any).products[0].price).toBe(2999);
      expect(hybridSearch).toHaveBeenCalledWith('headphones', expect.objectContaining({
        maxPrice: 5000,
      }));
    });

    it('returns empty array when no results (no hallucination)', async () => {
      vi.mocked(hybridSearch).mockResolvedValue([]);

      const result = await searchProducts.execute(
        { query: 'nonexistent product xyz123' },
        'test-user'
      );

      expect(result.success).toBe(true);
      expect((result.data as any).products).toHaveLength(0);
    });

    it('rejects unknown brand (no hallucinated writes)', async () => {
      vi.mocked(hybridSearch).mockResolvedValue([]);

      const result = await searchProducts.execute(
        { query: 'headphones', brand: 'NonExistentBrand' },
        'test-user'
      );

      expect(result.success).toBe(true);
      expect((result.data as any).products).toHaveLength(0);
    });

    it('includes Langfuse tracing metadata', async () => {
      vi.mocked(hybridSearch).mockResolvedValue([]);

      const result = await searchProducts.execute(
        { query: 'headphones' },
        'test-user'
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.traced).toBe(true);
      expect(result.metadata?.userId).toBe('test-user');
    });

    it('handles errors gracefully', async () => {
      vi.mocked(hybridSearch).mockRejectedValue(new Error('Search service unavailable'));

      const result = await searchProducts.execute(
        { query: 'headphones' },
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Search service unavailable');
      expect(result.metadata?.traced).toBe(true);
    });
  });
});
