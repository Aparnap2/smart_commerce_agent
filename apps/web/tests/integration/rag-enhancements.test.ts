/**
 * RAG Enhancement Integration Tests
 *
 * End-to-end tests for the complete RAG enhancement pipeline:
 * - Semantic chunking → Indexing → Reranking → Query transformation → Caching
 * - Guardrails validation
 * - Observability tracing
 *
 * These tests verify the integration between all new modules.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment
vi.mock('../../lib/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    OLLAMA_BASE_URL: 'http://localhost:11434',
    OLLAMA_MODEL: 'qwen2.5-coder:3b',
    EMBEDDING_MODEL: 'nomic-embed-text',
    EMBEDDING_DIMENSIONS: 768,
    LANGFUSE_PUBLIC_KEY: undefined,
    LANGFUSE_SECRET_KEY: undefined,
  },
}));

// Mock logger
vi.mock('../../lib/redis/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RAG Enhancement Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Complete RAG Pipeline', () => {
    it('should process document through complete pipeline', async () => {
      // Mock embedQuery for semantic chunking
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: Array(768).fill(0.5),
          token_count: 10,
        }),
      });

      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');
      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      const { transformQuery } = await import('../../lib/rag/query-transform.js');

      // Step 1: Chunk document
      const document = `
        Our return policy allows returns within 30 days of purchase.
        Items must be in original condition with tags attached.
        Refunds are processed within 5-7 business days.
        
        For warranty claims, contact support with your order number.
        Warranty covers manufacturing defects for 1 year from purchase date.
      `;

      const chunks = await semanticChunk(document, {
        maxChunkSize: 300,
        similarityThreshold: 0.85,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(c => c.length > 0)).toBe(true);

      // Step 2: Transform query
      const query = 'What is the return policy?';
      const transformed = await transformQuery(query, {
        enableRewriting: false, // Disable LLM calls in test
        enableHyDE: false,
      });

      expect(transformed.rewrittenQueries).toContain(query);

      // Step 3: Rerank chunks
      const candidates = chunks.map((chunk, i) => ({
        id: i,
        content: chunk,
        score: 0.9 - i * 0.1,
      }));

      const reranked = await rerankCandidates(query, candidates, {
        topK: 3,
        minScore: 0, // Allow all scores in test
      });

      expect(reranked.length).toBeLessThanOrEqual(3);
      if (reranked.length > 0) {
        expect(reranked[0]).toHaveProperty('rerankScore');
      }
    });

    it('should validate input and output through guardrails', async () => {
      const { validateInput, validateOutput, sanitizeInput } = await import('../../lib/guardrails/index.js');

      // Test input validation
      const cleanInput = 'Show me available laptops';
      const cleanResult = validateInput(cleanInput);
      expect(cleanResult.valid).toBe(true);
      expect(cleanResult.action).toBe('allow');

      // Test PII detection and sanitization
      const piiInput = 'My email is test@example.com';
      const piiResult = validateInput(piiInput);
      expect(piiResult.issues.length).toBeGreaterThan(0);

      const sanitized = sanitizeInput(piiInput);
      expect(sanitized).toContain('[REDACTED_EMAIL]');
      expect(sanitized).not.toContain('test@example.com');

      // Test output validation
      const validOutput = 'We have several laptops available.';
      const outputResult = validateOutput(validOutput, 'Available products include laptops.');
      expect(outputResult.valid).toBe(true);
    });

    it('should handle cache operations', async () => {
      const { createSemanticCache } = await import('../../lib/rag/semantic-cache.js');

      // Create cache instance (will fail gracefully without Redis)
      const cache = createSemanticCache({
        ttlSeconds: 60,
        similarityThreshold: 0.95,
      });

      expect(cache).toBeDefined();
      expect(cache.get).toBeDefined();
      expect(cache.set).toBeDefined();
    });
  });

  describe('Query Transformation Pipeline', () => {
    it('should expand query with synonyms', async () => {
      const { expandQuerySimple } = await import('../../lib/rag/query-transform.js');

      const query = 'cheap laptops';
      const expanded = expandQuerySimple(query);

      expect(expanded).toContain(query);
      expect(expanded.length).toBeGreaterThan(1);
      // Should include synonym variations
      expect(expanded.some(e => e.includes('affordable') || e.includes('budget'))).toBe(true);
    });

    it('should detect when to use retrieval', async () => {
      const { decideRetrievalNecessity } = await import('../../lib/agents/adaptive-rag-node.js');

      // Product query should use retrieval
      const productQuery = 'Show me wireless headphones';
      const productDecision = await decideRetrievalNecessity(productQuery);
      expect(productDecision.useRetrieval).toBe(true);

      // Greeting should not use retrieval
      const greetingQuery = 'Hello, how are you?';
      const greetingDecision = await decideRetrievalNecessity(greetingQuery);
      expect(greetingDecision.useRetrieval).toBe(false);
    });
  });

  describe('User Memory Operations', () => {
    it('should store and recall user preferences', async () => {
      const { setUserPreference, getUserPreference, recallUserContext } = await import('../../lib/memory/user-memory.js');

      // Without Mem0 configured, should return defaults
      const userId = 'test-user-123';

      // Try to set preference (will fail gracefully)
      const setResult = await setUserPreference(userId, 'currency', 'USD');
      // Returns false when Mem0 not configured

      // Get preference (returns default)
      const preference = await getUserPreference(userId, 'currency', 'USD');
      expect(preference).toBeDefined();

      // Recall context (returns default structure)
      const context = await recallUserContext(userId);
      expect(context).toHaveProperty('preferences');
      expect(context).toHaveProperty('facts');
      expect(context).toHaveProperty('conversationSummary');
    });
  });

  describe('Proactive CX Triggers', () => {
    it('should initialize manager', async () => {
      const { getProactiveCXManager } = await import('../../lib/agents/cx-proactive.js');

      const manager = getProactiveCXManager();

      expect(manager).toBeDefined();
      expect(manager.createTrigger).toBeDefined();
      // Don't call createTrigger without Redis running
    });
  });

  describe('Observability Integration', () => {
    it('should create trace spans', async () => {
      const { getTracer, traceRAGPipeline } = await import('../../lib/observability/rag-trace.js');

      const tracer = getTracer();
      expect(tracer).toBeDefined();

      // Test tracing (will be no-op without Langfuse configured)
      const ctx = tracer.trace('test query', { userId: 'test' });
      expect(ctx).toHaveProperty('traceId');

      // End trace
      tracer.end(ctx);
    });

    it('should evaluate RAG output', async () => {
      const { evaluateRAGOutput } = await import('../../lib/observability/llm-judge.js');

      const result = await evaluateRAGOutput({
        query: 'What is the return policy?',
        context: 'Returns accepted within 30 days',
        answer: 'You can return items within 30 days',
      });

      expect(result).toHaveProperty('faithfulness');
      expect(result).toHaveProperty('relevance');
      expect(result).toHaveProperty('answerRelevance');
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should handle Ollama API failures gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const { rerankCandidates } = await import('../../lib/rag/reranker.js');

      const candidates = [
        { id: 1, content: 'Test content', score: 0.8 },
      ];

      // Should return fallback results with minScore 0
      const result = await rerankCandidates('test', candidates, { minScore: 0 });
      // Fallback returns candidates sorted by original score
      expect(result).toBeDefined();
    });

    it('should handle empty inputs', async () => {
      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');
      const { validateInput } = await import('../../lib/guardrails/index.js');
      const { transformQuery } = await import('../../lib/rag/query-transform.js');

      // Empty text chunking
      const emptyChunks = await semanticChunk('');
      expect(emptyChunks).toEqual([]);

      // Empty input validation
      const emptyValidation = validateInput('');
      expect(emptyValidation).toBeDefined();

      // Empty query transformation
      const emptyTransform = await transformQuery('');
      expect(emptyTransform.rewrittenQueries).toEqual(['']);
    });
  });

  describe('Configuration and Customization', () => {
    it('should accept custom configurations', async () => {
      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');
      const { rerankCandidates } = await import('../../lib/rag/reranker.js');
      const { validateInput } = await import('../../lib/guardrails/index.js');

      // Custom chunking config
      const chunks = await semanticChunk('Test content', {
        maxChunkSize: 200,
        similarityThreshold: 0.9,
        maxChunks: 5,
      });
      expect(chunks).toBeDefined();

      // Custom reranker config
      const reranked = await rerankCandidates('query', [
        { id: 1, content: 'content' }
      ], {
        topK: 3,
        minScore: 0.5,
        model: 'ollama',
      });
      expect(reranked).toBeDefined();

      // Custom guardrails config
      const validation = validateInput('test', {
        enablePIIDetection: false,
        enableToxicityDetection: false,
        toxicityThreshold: 0.9,
      });
      expect(validation).toBeDefined();
    });
  });

  describe('Performance Characteristics', () => {
    it('should process multiple chunks in parallel', async () => {
      const start = Date.now();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          embedding: Array(768).fill(0.5),
          token_count: 10,
        }),
      });

      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');

      const longDocument = Array(20)
        .fill(0)
        .map((_, i) => `Paragraph ${i}. Contains information about topic ${i}.`)
        .join('\n\n');

      const chunks = await semanticChunk(longDocument, {
        maxChunkSize: 300,
        similarityThreshold: 0.85,
      });

      const duration = Date.now() - start;

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.length).toBeLessThanOrEqual(20);
      // Should complete in reasonable time (< 5 seconds for test)
      expect(duration).toBeLessThan(5000);
    });
  });
});
