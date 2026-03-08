import { describe, it, expect } from 'vitest';
import { buildSearchQuery, fuseResults, hybridSearch } from '../hybrid';

describe('Hybrid Search', () => {
  describe('buildSearchQuery', () => {
    it('extracts price constraint from "under ₹12000"', () => {
      const result = buildSearchQuery('headphones under ₹12000');
      expect(result.query).toBe('headphones');
      expect(result.maxPrice).toBe(12000);
    });

    it('extracts price constraint from "under 12k"', () => {
      const result = buildSearchQuery('earbuds under 12k');
      expect(result.maxPrice).toBe(12000);
    });

    it('extracts brand from "Sony headphones"', () => {
      const result = buildSearchQuery('Sony headphones');
      expect(result.brand).toBe('Sony');
    });

    it('handles "like X but cheaper" pattern', () => {
      const result = buildSearchQuery('something like Sony but cheaper');
      expect(result.similarTo).toContain('Sony');
      expect(result.sortBy).toBe('price_asc');
    });

    it('handles "for gym/running/calls" use case', () => {
      const result = buildSearchQuery('headphones for gym');
      expect(result.useCase).toBe('gym');
    });

    it('handles empty string with safe defaults', () => {
      const result = buildSearchQuery('');
      expect(result.query).toBe('');
      expect(result.maxPrice).toBeUndefined();
    });
  });

  describe('fuseResults', () => {
    it('deduplicates BM25 + pgvector overlap', () => {
      const bm25 = [
        { id: '1', score: 0.9, type: 'bm25' as const },
        { id: '2', score: 0.7, type: 'bm25' as const },
      ];
      const semantic = [
        { id: '2', score: 0.8, type: 'semantic' as const },
        { id: '3', score: 0.6, type: 'semantic' as const },
      ];
      const fused = fuseResults(bm25, semantic);
      // Check for deduplication (3 unique items, no duplicates)
      expect(fused).toHaveLength(3);
      expect(fused.map(r => r.id).sort()).toEqual(['1', '2', '3']);
      // Item 2 should rank highest (appears in both lists with good scores)
      expect(fused[0].id).toBe('2');
    });

    it('ranks by RRF score correctly', () => {
      const bm25 = [
        { id: '1', score: 0.9, type: 'bm25' as const },
        { id: '2', score: 0.7, type: 'bm25' as const },
      ];
      const semantic = [
        { id: '2', score: 0.9, type: 'semantic' as const },
        { id: '1', score: 0.6, type: 'semantic' as const },
      ];
      const fused = fuseResults(bm25, semantic);
      // Item 2 should rank higher (1st in semantic, 2nd in bm25)
      expect(fused[0].id).toBe('2');
    });

    it('returns empty array on both inputs empty', () => {
      const fused = fuseResults([], []);
      expect(fused).toHaveLength(0);
    });
  });

  describe('hybridSearch', () => {
    it('filters by maxPrice correctly', async () => {
      // This will fail initially (no implementation) - RED phase
      const result = await hybridSearch('headphones', { maxPrice: 5000 });
      expect(result.every((r: any) => r.price <= 5000)).toBe(true);
    });

    it('filters by inStockOnly correctly', async () => {
      // This will fail initially (no implementation) - RED phase
      const result = await hybridSearch('headphones', { inStockOnly: true });
      expect(result.every((r: any) => r.stockCount > 0)).toBe(true);
    });

    it('returns [] when no results (no hallucination)', async () => {
      // This will fail initially (no implementation) - RED phase
      const result = await hybridSearch('nonexistent product xyz123');
      expect(result).toEqual([]);
    });
  });
});
