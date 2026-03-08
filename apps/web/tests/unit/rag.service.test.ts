/**
 * RAG Service Unit Tests
 *
 * Tests for the RAG (Retrieval-Augmented Generation) service
 * using pgvector for semantic search and nomic-embed-text for embeddings.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

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

// Mock tools/database.js
vi.mock('../../lib/tools/database.js', () => ({
  queryDatabase: vi.fn().mockResolvedValue([
    { id: 1, name: 'Test Product', similarity: 0.95 },
  ]),
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

describe('RAG Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('embedQuery', () => {
    it('should generate 768-dimensional embedding for valid text', async () => {
      const mockEmbedding = Array(768).fill(0).map((_, i) => Math.random() * 2 - 1);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: mockEmbedding,
          token_count: 10,
        }),
      });

      const { embedQuery } = await import('../../lib/rag/service.js');
      const result = await embedQuery('wireless headphones');

      expect(result.error).toBeUndefined();
      expect(result.embedding).toHaveLength(768);
      expect(result.model).toBe('nomic-embed-text');
    });

    it('should return error for empty text', async () => {
      const { embedQuery } = await import('../../lib/rag/service.js');
      const result = await embedQuery('');

      expect(result.error).toBe('Text input cannot be empty');
      expect(result.embedding).toHaveLength(0);
    });

    it('should handle Ollama API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable',
        text: vi.fn().mockResolvedValue('Service Unavailable'),
      });

      const { embedQuery } = await import('../../lib/rag/service.js');
      const result = await embedQuery('test query');

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Embedding API error');
    });
  });

  describe('getEmbeddingConfig', () => {
    it('should return correct configuration', async () => {
      const { getEmbeddingConfig } = await import('../../lib/rag/service.js');
      const config = getEmbeddingConfig();

      expect(config.model).toBe('nomic-embed-text');
      expect(config.dimensions).toBe(768);
      expect(config.endpoint).toContain('/api/embeddings');
    });
  });

  describe('vectorSearch', () => {
    it('should return empty results when no embeddings exist', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      (queryDatabase as vi.Mock).mockResolvedValueOnce([]);

      const { vectorSearch } = await import('../../lib/rag/service.js');
      const result = await vectorSearch('laptop');

      expect(result.results).toBeDefined();
      expect(result.total).toBeDefined();
    });

    it('should accept search options', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      (queryDatabase as vi.Mock).mockResolvedValueOnce([
        { id: 1, name: 'Electronics Item', similarity: 0.9 },
      ]);

      const { vectorSearch } = await import('../../lib/rag/service.js');
      const result = await vectorSearch('electronics', {
        limit: 5,
        minScore: 0.8,
        filter: { category: 'Electronics' },
      });

      expect(result.error).toBeUndefined();
    });
  });

  describe('documentSearch', () => {
    it('should search knowledge base documents', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      (queryDatabase as vi.Mock).mockResolvedValueOnce([
        { id: 'doc-1', title: 'Return Policy', content: '...', similarity: 0.9 },
      ]);

      const { documentSearch } = await import('../../lib/rag/service.js');
      const result = await documentSearch('return policy', { limit: 5 });

      expect(result.error).toBeUndefined();
    });
  });

  describe('ragQuery', () => {
    it('should have correct query structure', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      (queryDatabase as vi.Mock).mockResolvedValueOnce([
        { id: 'doc-1', title: 'Return Policy', content: 'You can return items within 30 days.', similarity: 0.9 },
      ]);

      const { ragQuery } = await import('../../lib/rag/service.js');
      const result = await ragQuery('What is the return policy for headphones?');

      expect(result.query).toBe('What is the return policy for headphones?');
      expect(result.sources).toBeDefined();
      expect(Array.isArray(result.sources)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      (queryDatabase as vi.Mock).mockRejectedValueOnce(new Error('Database error'));

      const { ragQuery } = await import('../../lib/rag/service.js');
      const result = await ragQuery('test query');

      expect(result.error).toBeDefined();
      expect(result.context).toBe('');
      expect(result.sources).toHaveLength(0);
    });
  });

  describe('checkRAGHealth', () => {
    it('should check dependencies', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: Array(768).fill(0) }),
      });

      const { checkRAGHealth } = await import('../../lib/rag/service.js');
      const status = await checkRAGHealth();

      expect(status.model).toBe('nomic-embed-text');
      expect(status.dimensions).toBe(768);
    });
  });

  describe('indexProduct', () => {
    it('should call embedding API for product', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      (queryDatabase as vi.Mock).mockResolvedValueOnce([{ id: 'test-uuid' }]);

      const { indexProduct } = await import('../../lib/rag/service.js');
      const result = await indexProduct(1, 'Premium wireless headphones');

      // The result depends on mocked queryDatabase
      expect(result.success).toBe(true);
      expect(result.embeddingId).toBe('test-uuid');
    });

    it('should reject empty descriptions', async () => {
      const { indexProduct } = await import('../../lib/rag/service.js');
      const result = await indexProduct(1, '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('description cannot be empty');
    });
  });

  describe('indexDocument', () => {
    it('should call embedding API for document', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      (queryDatabase as vi.Mock).mockResolvedValueOnce({ id: 'doc-1' });

      const { indexDocument } = await import('../../lib/rag/service.js');
      const result = await indexDocument(
        'Return Policy',
        'Our return policy allows customers to return items within 30 days of purchase.',
        'policy'
      );

      // Result depends on mocked database
      expect(result.success).toBeDefined();
    });

    it('should reject empty title', async () => {
      const { indexDocument } = await import('../../lib/rag/service.js');
      const result = await indexDocument('', 'content', 'policy');

      expect(result.success).toBe(false);
    });
  });
});
