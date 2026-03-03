/**
 * Cross-Encoder Reranker Unit Tests
 *
 * Tests for RAG candidate reranking with cross-encoder scoring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment before any imports
vi.mock('../../lib/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    OLLAMA_BASE_URL: 'http://localhost:11434',
    OLLAMA_MODEL: 'qwen2.5-coder:3b',
    EMBEDDING_MODEL: 'nomic-embed-text',
    EMBEDDING_DIMENSIONS: 768,
  },
}));

// Mock redis/logger.js
vi.mock('../../lib/redis/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Cross-Encoder Reranker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('simpleRelevanceScore', () => {
    it('should calculate word overlap score', async () => {
      const { simpleRelevanceScore } = await import('../../lib/rag/reranker.js');
      
      const query = 'wireless bluetooth headphones';
      const doc = 'These wireless headphones support bluetooth connectivity';
      
      const score = simpleRelevanceScore(query, doc);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return 0 for no overlap', async () => {
      const { simpleRelevanceScore } = await import('../../lib/rag/reranker.js');
      
      const query = 'laptop computer';
      const doc = 'fresh organic vegetables for sale';
      
      const score = simpleRelevanceScore(query, doc);
      
      expect(score).toBe(0);
    });

    it('should handle empty inputs', async () => {
      const { simpleRelevanceScore } = await import('../../lib/rag/reranker.js');
      
      const score1 = simpleRelevanceScore('', 'some document');
      const score2 = simpleRelevanceScore('query', '');
      
      expect(score1).toBe(0);
      expect(score2).toBe(0);
    });

    it('should ignore short words (stop words)', async () => {
      const { simpleRelevanceScore } = await import('../../lib/rag/reranker.js');
      
      const query = 'the best laptop';
      const doc = 'This is the laptop you are looking for';
      
      // 'the' should be ignored (length <= 2)
      const score = simpleRelevanceScore(query, doc);
      
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('rerankCandidates', () => {
    it('should rerank candidates by relevance', async () => {
      // Mock Ollama API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '0.85',
        }),
      });

      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      
      const query = 'wireless headphones';
      const candidates = [
        {
          id: 1,
          content: 'These headphones are wireless and have great sound quality',
          title: 'Product A',
          score: 0.9,
        },
        {
          id: 2,
          content: 'Wired earbuds with microphone for calls',
          title: 'Product B',
          score: 0.8,
        },
        {
          id: 3,
          content: 'Bluetooth wireless headphones with noise cancellation',
          title: 'Product C',
          score: 0.7,
        },
      ];

      const results = await rerankCandidates(query, candidates, {
        topK: 3,
        model: 'ollama',
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('rerankScore');
      expect(results[0]).toHaveProperty('originalScore');
    });

    it('should return top K results', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '0.75',
        }),
      });

      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      
      const query = 'test query';
      const candidates = Array(10)
        .fill(0)
        .map((_, i) => ({
          id: i,
          content: `Document ${i} with some content`,
          score: 0.9 - i * 0.05,
        }));

      const results = await rerankCandidates(query, candidates, {
        topK: 5,
      });

      expect(results).toHaveLength(5);
    });

    it('should apply minimum score threshold', async () => {
      global.fetch = vi.fn().mockImplementation((url, options) => {
        const body = JSON.parse((options as RequestInit).body as string);
        // Return varying scores
        const score = body.prompt.includes('Document 1') ? '0.9' : '0.05';
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: score,
          }),
        });
      });

      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      
      const query = 'test';
      const candidates = [
        { id: 1, content: 'Document 1 highly relevant', score: 0.9 },
        { id: 2, content: 'Document 2 not relevant', score: 0.8 },
      ];

      const results = await rerankCandidates(query, candidates, {
        topK: 5,
        minScore: 0.5,
      });

      // Only high-scoring documents should remain
      results.forEach((r) => {
        expect(r.rerankScore).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should handle empty candidate list', async () => {
      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      
      const query = 'test query';
      const results = await rerankCandidates(query, []);

      expect(results).toEqual([]);
    });

    it('should handle empty query', async () => {
      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      
      const candidates = [{ id: 1, content: 'some content' }];
      const results = await rerankCandidates('', candidates);

      expect(results).toEqual([]);
    });

    it('should handle Ollama API errors gracefully', async () => {
      // Mock fetch to return error status - scoreWithOllama returns 0 for errors
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      
      const query = 'test';
      const candidates = [
        { id: 1, content: 'Document content', score: 0.8 },
        { id: 2, content: 'Another document', score: 0.6 },
      ];

      // Without minScore, should return results even with 0 scores
      const results = await rerankCandidates(query, candidates, {
        model: 'ollama',
        minScore: 0, // Explicitly set to 0 to include error results
      });

      // Should return all candidates with 0 scores (error fallback)
      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r).toHaveProperty('rerankScore');
        expect(r.rerankScore).toBeGreaterThanOrEqual(0);
      });
    });

    it('should sort by rerank score descending', async () => {
      global.fetch = vi.fn().mockImplementation((url, options) => {
        const body = JSON.parse((options as RequestInit).body as string);
        // Return different scores based on content
        const score = body.prompt.includes('Best') ? '0.95' : '0.3';
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: score,
          }),
        });
      });

      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      
      const query = 'best product';
      const candidates = [
        { id: 1, content: 'Average product description', score: 0.8 },
        { id: 2, content: 'Best product ever made with amazing features', score: 0.7 },
      ];

      const results = await rerankCandidates(query, candidates, {
        topK: 2,
      });

      // Highest rerank score should be first
      expect(results[0].rerankScore).toBeGreaterThanOrEqual(results[1].rerankScore);
    });
  });

  describe('rerankBatch', () => {
    it('should rerank multiple query-candidate pairs', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '0.8',
        }),
      });

      const { rerankBatch } = await import('../../lib/rag/reranker.js');
      
      const queryDocs = [
        {
          query: 'wireless headphones',
          candidates: [
            { id: 1, content: 'Wireless audio device', score: 0.9 },
            { id: 2, content: 'Wired cable', score: 0.5 },
          ],
        },
        {
          query: 'laptop stand',
          candidates: [
            { id: 3, content: 'Desk accessory for laptops', score: 0.8 },
          ],
        },
      ];

      const results = await rerankBatch(queryDocs, { topK: 5 });

      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(Array);
      expect(results[1]).toBeInstanceOf(Array);
    });
  });

  describe('RerankerConfig', () => {
    it('should use default configuration', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '0.7',
        }),
      });

      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      
      const query = 'test';
      const candidates = [{ id: 1, content: 'content' }];
      
      // Call with minimal options to test defaults
      const results = await rerankCandidates(query, candidates);

      expect(results).toBeDefined();
      expect(results[0]).toHaveProperty('rerankScore');
    });

    it('should accept custom Ollama configuration', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '0.75',
        }),
      });

      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      
      const query = 'test';
      const candidates = [{ id: 1, content: 'content' }];
      
      const results = await rerankCandidates(query, candidates, {
        model: 'ollama',
        ollamaModel: 'qwen2.5-coder:3b',
        ollamaBaseUrl: 'http://localhost:11434',
        topK: 3,
        minScore: 0.2,
      });

      expect(results).toBeDefined();
    });
  });

  describe('RerankResult type', () => {
    it('should include both rerankScore and originalScore', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '0.9',
        }),
      });

      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      
      const query = 'test';
      const candidate = {
        id: 1,
        content: 'relevant content',
        title: 'Test Doc',
        score: 0.85,
      };

      const results = await rerankCandidates(query, [candidate]);

      expect(results[0]).toHaveProperty('rerankScore', 0.9);
      expect(results[0]).toHaveProperty('originalScore', 0.85);
      expect(results[0]).toHaveProperty('id', 1);
      expect(results[0]).toHaveProperty('content');
    });
  });
});
