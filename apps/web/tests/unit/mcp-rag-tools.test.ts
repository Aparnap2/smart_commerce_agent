/**
 * MCP RAG Tools Unit Tests
 *
 * Tests for the MCP (Model Context Protocol) RAG tools
 * including vector_search, document_search, rag_query, etc.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the RAG service
vi.mock('../../lib/rag/service.js', () => ({
  vectorSearch: vi.fn(),
  documentSearch: vi.fn(),
  ragQuery: vi.fn(),
  indexProduct: vi.fn(),
  indexDocument: vi.fn(),
  checkRAGHealth: vi.fn(),
  getRAGStats: vi.fn(),
}));

// Mock fetch globally for health checks
global.fetch = vi.fn();

describe('MCP RAG Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createRAGTools', () => {
    it('should create all RAG tools', async () => {
      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();

      expect(tools.size).toBe(7);
      expect(tools.has('vector_search')).toBe(true);
      expect(tools.has('document_search')).toBe(true);
      expect(tools.has('rag_query')).toBe(true);
      expect(tools.has('index_product')).toBe(true);
      expect(tools.has('index_document')).toBe(true);
      expect(tools.has('hybrid_search')).toBe(true);
      expect(tools.has('rag_health')).toBe(true);
    });
  });

  describe('vector_search tool', () => {
    it('should execute vector search with valid parameters', async () => {
      const { vectorSearch } = await import('../../lib/rag/service.js');
      (vectorSearch as vi.Mock).mockResolvedValueOnce({
        results: [
          { id: 1, name: 'Headphones', description: 'Wireless', price: 99.99, similarity: 0.85 },
        ],
        total: 1,
      });

      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('vector_search')!;

      const result = await tool.execute({
        query: 'wireless audio',
        limit: 10,
        minScore: 0.1,
      }, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('results');
      expect(result.data).toHaveProperty('total', 1);
    });

    it('should handle errors gracefully', async () => {
      const { vectorSearch } = await import('../../lib/rag/service.js');
      (vectorSearch as vi.Mock).mockResolvedValueOnce({
        error: 'Database connection failed',
        results: [],
        total: 0,
      });

      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('vector_search')!;

      const result = await tool.execute({
        query: 'test',
        limit: 10,
      }, null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Search failed');
    });

    it('should not require userId', async () => {
      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('vector_search')!;

      expect(tool.requireUserId).toBe(false);
    });
  });

  describe('document_search tool', () => {
    it('should search knowledge base documents', async () => {
      const { documentSearch } = await import('../../lib/rag/service.js');
      (documentSearch as vi.Mock).mockResolvedValueOnce({
        results: [
          {
            id: 'doc-1',
            title: 'Return Policy',
            content: '30-day return policy...',
            docType: 'policy',
            category: 'returns',
            similarity: 0.92,
          },
        ],
        total: 1,
      });

      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('document_search')!;

      const result = await tool.execute({
        query: 'return policy',
        limit: 5,
        docType: 'policy',
      }, null);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('results');
    });
  });

  describe('rag_query tool', () => {
    it('should execute full RAG query', async () => {
      const { ragQuery } = await import('../../lib/rag/service.js');
      (ragQuery as vi.Mock).mockResolvedValueOnce({
        query: 'What is the return policy?',
        context: '[Document: Return Policy] 30-day return policy...',
        sources: [
          { type: 'document', id: 'doc-1', title: 'Return Policy', relevance: 0.92 },
        ],
        totalResults: 1,
      });

      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('rag_query')!;

      const result = await tool.execute({
        query: 'What is the return policy?',
        productLimit: 5,
        documentLimit: 3,
      }, null);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('context');
      expect(result.data).toHaveProperty('sources');
    });

    it('should allow configuring search scope', async () => {
      const { ragQuery } = await import('../../lib/rag/service.js');
      (ragQuery as vi.Mock).mockResolvedValueOnce({
        query: 'laptop recommendations',
        context: '',
        sources: [],
        totalResults: 0,
      });

      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('rag_query')!;

      const result = await tool.execute({
        query: 'laptop recommendations',
        includeProducts: true,
        includeDocuments: false,
      }, null);

      expect(result.success).toBe(true);
    });
  });

  describe('index_product tool', () => {
    it('should index a product for semantic search', async () => {
      const { indexProduct } = await import('../../lib/rag/service.js');
      (indexProduct as vi.Mock).mockResolvedValueOnce({
        success: true,
        embeddingId: 'emb-123',
      });

      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('index_product')!;

      const result = await tool.execute({
        productId: 1,
        description: 'Premium wireless headphones with noise cancellation',
      }, null);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('embeddingId');
    });
  });

  describe('index_document tool', () => {
    it('should index a knowledge base document', async () => {
      const { indexDocument } = await import('../../lib/rag/service.js');
      (indexDocument as vi.Mock).mockResolvedValueOnce({
        success: true,
        documentId: 'doc-123',
        chunkCount: 5,
      });

      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('index_document')!;

      const result = await tool.execute({
        title: 'Return Policy',
        content: 'Full document content here...',
        docType: 'policy',
        category: 'returns',
      }, null);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('documentId');
      expect(result.data).toHaveProperty('chunkCount');
    });

    it('should validate required parameters', async () => {
      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('index_document')!;

      // Tool should return error for empty title, not throw
      const result = await tool.execute({
        title: '',
        content: 'Content',
        docType: 'policy',
      }, null);

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
    });
  });

  describe('hybrid_search tool', () => {
    it('should combine vector and keyword search', async () => {
      const { vectorSearch, documentSearch } = await import('../../lib/rag/service.js');
      (vectorSearch as vi.Mock).mockResolvedValueOnce({
        results: [
          { id: 1, name: 'Headphones', similarity: 0.9 },
        ],
        total: 1,
      });
      (documentSearch as vi.Mock).mockResolvedValueOnce({
        results: [
          { id: 'doc-1', title: 'Guide', similarity: 0.8 },
        ],
        total: 1,
      });

      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('hybrid_search')!;

      const result = await tool.execute({
        query: 'wireless headphones guide',
        limit: 10,
        vectorWeight: 0.7,
        keywordWeight: 0.3,
      }, null);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('results');
      expect(result.data).toHaveProperty('reranked', true);
    });
  });

  describe('rag_health tool', () => {
    it('should check RAG service health', async () => {
      const { checkRAGHealth, getRAGStats } = await import('../../lib/rag/service.js');
      (checkRAGHealth as vi.Mock).mockResolvedValueOnce({
        healthy: true,
        ollama: true,
        database: true,
        model: 'nomic-embed-text',
        dimensions: 768,
      });
      (getRAGStats as vi.Mock).mockResolvedValueOnce({
        productCount: 100,
        documentCount: 50,
        chunkCount: 500,
        embeddingModel: 'nomic-embed-text',
        dimensions: 768,
      });

      (global.fetch as unknown as vi.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: Array(768).fill(0) }),
      });

      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();
      const tool = tools.get('rag_health')!;

      const result = await tool.execute({}, null);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('healthy', true);
      expect(result.data).toHaveProperty('ollama', true);
      expect(result.data).toHaveProperty('database', true);
    });
  });

  describe('Tool Parameters', () => {
    it('should have proper Zod schema validation', async () => {
      const { createRAGTools } = await import('../../lib/mcp/rag-tools.js');
      const tools = createRAGTools();

      const vectorTool = tools.get('vector_search')!;
      expect(vectorTool.parameters).toBeDefined();

      const docTool = tools.get('document_search')!;
      expect(docTool.parameters).toBeDefined();

      const ragTool = tools.get('rag_query')!;
      expect(ragTool.parameters).toBeDefined();
    });
  });
});
