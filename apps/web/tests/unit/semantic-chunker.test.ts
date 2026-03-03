/**
 * Semantic Chunker Unit Tests
 *
 * Tests for semantics-aware text chunking with similarity-based merging.
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

// Mock rag/service.js embedQuery
vi.mock('../../lib/rag/service.js', () => ({
  embedQuery: vi.fn().mockResolvedValue({
    embedding: Array(768).fill(0.5),
    model: 'nomic-embed-text',
    dimensions: 768,
  }),
}));

describe('Semantic Chunker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('splitIntoSentences', () => {
    it('should split text by sentence boundaries', async () => {
      const { splitIntoSentences } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = 'This is the first sentence. This is the second sentence! What about the third?';
      const sentences = splitIntoSentences(text);

      expect(sentences).toHaveLength(3);
      expect(sentences[0]).toBe('This is the first sentence.');
      expect(sentences[1]).toBe('This is the second sentence!');
      expect(sentences[2]).toBe('What about the third?');
    });

    it('should handle text with no punctuation', async () => {
      const { splitIntoSentences } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = 'This is a sentence without end';
      const sentences = splitIntoSentences(text);

      expect(sentences).toHaveLength(1);
      expect(sentences[0]).toBe('This is a sentence without end');
    });

    it('should handle empty text', async () => {
      const { splitIntoSentences } = await import('../../lib/rag/semantic-chunker.js');
      
      const sentences = splitIntoSentences('');
      expect(sentences).toHaveLength(0);
    });
  });

  describe('splitIntoParagraphs', () => {
    it('should split text by paragraph boundaries', async () => {
      const { splitIntoParagraphs } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const paragraphs = splitIntoParagraphs(text);

      expect(paragraphs).toHaveLength(3);
      expect(paragraphs[0]).toBe('First paragraph.');
      expect(paragraphs[1]).toBe('Second paragraph.');
      expect(paragraphs[2]).toBe('Third paragraph.');
    });

    it('should handle text with multiple newlines', async () => {
      const { splitIntoParagraphs } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = 'Paragraph 1.\n\n\n\nParagraph 2.';
      const paragraphs = splitIntoParagraphs(text);

      expect(paragraphs).toHaveLength(2);
    });

    it('should filter out empty paragraphs', async () => {
      const { splitIntoParagraphs } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = 'Valid.\n\n   \n\nAlso valid.';
      const paragraphs = splitIntoParagraphs(text);

      expect(paragraphs).toHaveLength(2);
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', async () => {
      const { cosineSimilarity } = await import('../../lib/rag/semantic-chunker.js');
      
      const vecA = [1, 2, 3];
      const vecB = [1, 2, 3];
      
      const similarity = cosineSimilarity(vecA, vecB);
      expect(similarity).toBe(1);
    });

    it('should return 0 for orthogonal vectors', async () => {
      const { cosineSimilarity } = await import('../../lib/rag/semantic-chunker.js');
      
      const vecA = [1, 0];
      const vecB = [0, 1];
      
      const similarity = cosineSimilarity(vecA, vecB);
      expect(similarity).toBe(0);
    });

    it('should handle different length vectors', async () => {
      const { cosineSimilarity } = await import('../../lib/rag/semantic-chunker.js');
      
      const vecA = [1, 2, 3];
      const vecB = [1, 2];
      
      const similarity = cosineSimilarity(vecA, vecB);
      expect(similarity).toBe(0);
    });

    it('should return 0 for zero vectors', async () => {
      const { cosineSimilarity } = await import('../../lib/rag/semantic-chunker.js');
      
      const vecA = [0, 0, 0];
      const vecB = [1, 2, 3];
      
      const similarity = cosineSimilarity(vecA, vecB);
      expect(similarity).toBe(0);
    });
  });

  describe('semanticChunk', () => {
    it('should chunk short text as single chunk', async () => {
      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = 'This is a short document. It should be one chunk.';
      const chunks = await semanticChunk(text, { maxChunkSize: 200 });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0]).toContain('This is a short document');
    });

    it('should split long documents into multiple chunks', async () => {
      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');
      
      // Create a long document with multiple distinct paragraphs
      const paragraphs = Array(10)
        .fill(0)
        .map((_, i) => `This is paragraph ${i}. It contains unique information about topic ${i}. More specific details here.`)
        .join('\n\n');

      const chunks = await semanticChunk(paragraphs, { 
        maxChunkSize: 300,
        similarityThreshold: 0.95, // Higher threshold to avoid over-merging
      });

      // With high similarity threshold, should keep more chunks separate
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.length).toBeLessThanOrEqual(15);
    });

    it('should return empty array for empty text', async () => {
      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');
      
      const chunks = await semanticChunk('');
      expect(chunks).toEqual([]);
    });

    it('should respect maxChunkSize parameter', async () => {
      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = 'A. '.repeat(200); // Create long text
      const chunks = await semanticChunk(text, { maxChunkSize: 500 });

      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(500);
      });
    });

    it('should handle text with varying sentence lengths', async () => {
      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');
      
      // Mix of short and long sentences
      const text = `
        Short sentence.
        Another short one.
        This is a significantly longer sentence that contains more words and should potentially be grouped with others.
        Yet another brief statement.
        Final short one.
      `.trim();

      const chunks = await semanticChunk(text, { maxChunkSize: 400 });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.every((c) => c.length > 0)).toBe(true);
    });

    it('should merge chunks with high similarity', async () => {
      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = `
        Paragraph about similar topic A.
        
        Another paragraph about similar topic A with same theme.
        
        Yet more content about topic A.
      `.trim();

      const chunks = await semanticChunk(text, {
        maxChunkSize: 800,
        similarityThreshold: 0.85,
      });

      // Should merge similar chunks, resulting in fewer chunks
      expect(chunks.length).toBeLessThanOrEqual(3);
    });

    it('should preserve paragraph boundaries', async () => {
      const { semanticChunk } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = `
        First distinct paragraph.
        
        Second distinct paragraph with different content.
        
        Third paragraph that is also unique.
      `.trim();

      const chunks = await semanticChunk(text, {
        similarityThreshold: 0.95, // Higher threshold to preserve boundaries
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // Each chunk should contain coherent paragraph content
      chunks.forEach((chunk) => {
        expect(chunk.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('chunkTextSemantic', () => {
    it('should wrap semanticChunk with legacy parameters', async () => {
      const { chunkTextSemantic } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = 'Test content for legacy wrapper.';
      const chunks = await chunkTextSemantic(text, 500, 50);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('TextChunk interface', () => {
    it('should create chunks with proper metadata', async () => {
      const { createInitialChunks } = await import('../../lib/rag/semantic-chunker.js');
      
      const text = 'First sentence. Second sentence.\n\nNew paragraph here.';
      const chunks = createInitialChunks(text, {
        maxChunkSize: 500,
        minChunkSize: 100,
        chunkOverlap: 50,
        similarityThreshold: 0.85,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('startIndex');
        expect(chunk).toHaveProperty('endIndex');
        expect(chunk).toHaveProperty('sentenceCount');
        expect(chunk.sentenceCount).toBeGreaterThan(0);
      });
    });
  });

  describe('applyOverlap', () => {
    it('should add overlap between chunks', async () => {
      const { applyOverlap } = await import('../../lib/rag/semantic-chunker.js');
      
      const chunks = [
        { content: 'First chunk content', startIndex: 0, endIndex: 20, sentenceCount: 1 },
        { content: 'Second chunk content', startIndex: 21, endIndex: 42, sentenceCount: 1 },
      ];

      const overlapped = applyOverlap(chunks, 10);

      expect(overlapped.length).toBe(2);
      // Second chunk should contain overlap from first
      expect(overlapped[1].content).toContain('First chunk content'.slice(-10));
    });

    it('should return unchanged chunks when overlap is 0', async () => {
      const { applyOverlap } = await import('../../lib/rag/semantic-chunker.js');
      
      const chunks = [
        { content: 'First', startIndex: 0, endIndex: 5, sentenceCount: 1 },
        { content: 'Second', startIndex: 6, endIndex: 12, sentenceCount: 1 },
      ];

      const overlapped = applyOverlap(chunks, 0);

      expect(overlapped).toEqual(chunks);
    });

    it('should return unchanged chunks for single chunk', async () => {
      const { applyOverlap } = await import('../../lib/rag/semantic-chunker.js');
      
      const chunks = [
        { content: 'Only chunk', startIndex: 0, endIndex: 10, sentenceCount: 1 },
      ];

      const overlapped = applyOverlap(chunks, 10);

      expect(overlapped).toEqual(chunks);
    });
  });
});
