/**
 * Semantic Chunker for RAG
 *
 * Splits documents into semantically coherent chunks using sentence/paragraph boundaries
 * and merges nearby chunks based on embedding similarity thresholds.
 *
 * @packageDocumentation
 */

import { embedQuery } from './service.js';
import { logger } from '../redis/logger.js';

/**
 * Configuration for semantic chunking
 */
export interface SemanticChunkerConfig {
  /** Maximum chunk size in characters */
  maxChunkSize: number;
  /** Minimum chunk size in characters */
  minChunkSize: number;
  /** Overlap between chunks */
  chunkOverlap: number;
  /** Similarity threshold for merging chunks (0-1) */
  similarityThreshold: number;
  /** Maximum number of chunks to produce */
  maxChunks?: number;
}

/**
 * Default chunking configuration
 */
const DEFAULT_CONFIG: SemanticChunkerConfig = {
  maxChunkSize: 800,
  minChunkSize: 200,
  chunkOverlap: 100,
  similarityThreshold: 0.85,
  maxChunks: 100,
};

/**
 * Represents a text chunk with metadata
 */
export interface TextChunk {
  content: string;
  startIndex: number;
  endIndex: number;
  sentenceCount: number;
}

/**
 * Split text into sentences
 */
export function splitIntoSentences(text: string): string[] {
  // Match sentence endings with proper punctuation
  const sentencePattern = /[^.!?]+[.!?]+["']?|[^.!?]+$/g;
  const matches = text.match(sentencePattern);

  if (!matches) {
    return [];
  }

  return matches
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Split text into paragraphs
 */
export function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Split text into semantic chunks based on sentence/paragraph boundaries
 */
export function createInitialChunks(text: string, config: SemanticChunkerConfig): TextChunk[] {
  const paragraphs = splitIntoParagraphs(text);
  const chunks: TextChunk[] = [];

  let currentPos = 0;

  for (const paragraph of paragraphs) {
    const sentences = splitIntoSentences(paragraph);

    if (sentences.length === 0) {
      continue;
    }

    // If paragraph is small enough, keep it as one chunk
    if (paragraph.length <= config.maxChunkSize) {
      chunks.push({
        content: paragraph,
        startIndex: currentPos,
        endIndex: currentPos + paragraph.length,
        sentenceCount: sentences.length,
      });
      currentPos += paragraph.length + 2; // Account for newlines
      continue;
    }

    // Split large paragraphs into sentence groups
    let currentChunk = '';
    let chunkStart = currentPos;
    let sentenceCount = 0;

    for (const sentence of sentences) {
      const potentialChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;

      if (potentialChunk.length <= config.maxChunkSize) {
        currentChunk = potentialChunk;
        sentenceCount++;
      } else {
        // Save current chunk if it meets minimum size
        if (currentChunk.length >= config.minChunkSize) {
          chunks.push({
            content: currentChunk.trim(),
            startIndex: chunkStart,
            endIndex: chunkStart + currentChunk.length,
            sentenceCount,
          });
        }

        // Start new chunk with current sentence
        currentChunk = sentence;
        chunkStart = currentPos;
        sentenceCount = 1;
      }
    }

    // Add remaining chunk
    if (currentChunk.length >= config.minChunkSize) {
      chunks.push({
        content: currentChunk.trim(),
        startIndex: chunkStart,
        endIndex: chunkStart + currentChunk.length,
        sentenceCount,
      });
    }

    currentPos += paragraph.length + 2;
  }

  return chunks;
}

/**
 * Merge chunks based on embedding similarity
 */
async function mergeSimilarChunks(
  chunks: TextChunk[],
  config: SemanticChunkerConfig
): Promise<TextChunk[]> {
  if (chunks.length <= 1) {
    return chunks;
  }

  const merged: TextChunk[] = [];
  let currentChunk = { ...chunks[0] };

  for (let i = 1; i < chunks.length; i++) {
    const nextChunk = chunks[i];

    // Generate embeddings for similarity comparison
    const [currentEmbedding, nextEmbedding] = await Promise.all([
      embedQuery(currentChunk.content),
      embedQuery(nextChunk.content),
    ]);

    if (currentEmbedding.error || nextEmbedding.error) {
      logger.warn('RAG', 'Embedding failed during merge, skipping similarity check', {
        currentError: currentEmbedding.error,
        nextError: nextEmbedding.error,
      });
      // Push current and move to next without merging
      merged.push(currentChunk);
      currentChunk = nextChunk;
      continue;
    }

    const similarity = cosineSimilarity(
      currentEmbedding.embedding,
      nextEmbedding.embedding
    );

    // Merge if similarity exceeds threshold and size allows
    if (
      similarity >= config.similarityThreshold &&
      currentChunk.content.length + nextChunk.content.length <= config.maxChunkSize
    ) {
      currentChunk = {
        content: `${currentChunk.content} ${nextChunk.content}`,
        startIndex: currentChunk.startIndex,
        endIndex: nextChunk.endIndex,
        sentenceCount: currentChunk.sentenceCount + nextChunk.sentenceCount,
      };
    } else {
      // No merge, push current and start new
      merged.push(currentChunk);
      currentChunk = nextChunk;
    }

    // Check max chunks limit
    if (config.maxChunks && merged.length >= config.maxChunks - 1) {
      logger.warn('RAG', 'Approaching max chunks limit, forcing merge');
      break;
    }
  }

  // Push the last chunk
  merged.push(currentChunk);

  return merged;
}

/**
 * Apply overlap to chunks for better retrieval context
 */
export function applyOverlap(chunks: TextChunk[], overlap: number): TextChunk[] {
  if (chunks.length <= 1 || overlap <= 0) {
    return chunks;
  }

  const overlapped: TextChunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let content = chunk.content;

    // Add overlap from previous chunk
    if (i > 0) {
      const prevChunk = chunks[i - 1];
      const overlapText = prevChunk.content.slice(-overlap);
      content = `${overlapText} ${content}`;
    }

    // Add overlap from next chunk
    if (i < chunks.length - 1) {
      const nextChunk = chunks[i + 1];
      const overlapText = nextChunk.content.slice(0, overlap);
      content = `${content} ${overlapText}`;
    }

    overlapped.push({
      ...chunk,
      content: content.trim(),
    });
  }

  return overlapped;
}

/**
 * Split text into semantically coherent chunks with similarity-based merging
 *
 * @param text - The text to chunk
 * @param options - Optional chunking configuration
 * @returns Array of text chunks optimized for semantic retrieval
 *
 * @example
 * ```typescript
 * const chunks = await semanticChunk(documentContent, {
 *   maxChunkSize: 800,
 *   similarityThreshold: 0.85,
 * });
 * ```
 */
export async function semanticChunk(
  text: string,
  options: Partial<SemanticChunkerConfig> = {}
): Promise<string[]> {
  const config: SemanticChunkerConfig = {
    ...DEFAULT_CONFIG,
    ...options,
  };

  if (!text || text.trim().length === 0) {
    logger.warn('RAG', 'Empty text provided to semantic chunker');
    return [];
  }

  logger.debug('RAG', 'Starting semantic chunking', {
    textLength: text.length,
    config,
  });

  try {
    // Step 1: Create initial chunks based on sentence/paragraph boundaries
    const initialChunks = createInitialChunks(text, config);

    if (initialChunks.length === 0) {
      logger.warn('RAG', 'No chunks created from text');
      return [];
    }

    logger.debug('RAG', 'Initial chunks created', {
      count: initialChunks.length,
      avgSize: initialChunks.reduce((sum, c) => sum + c.content.length, 0) / initialChunks.length,
    });

    // Step 2: Merge similar chunks based on embedding similarity
    const mergedChunks = await mergeSimilarChunks(initialChunks, config);

    logger.debug('RAG', 'Chunks after merging', {
      count: mergedChunks.length,
      mergeRatio: (initialChunks.length - mergedChunks.length) / initialChunks.length,
    });

    // Step 3: Apply overlap for better retrieval context
    const finalChunks = applyOverlap(mergedChunks, config.chunkOverlap);

    // Extract just the content strings
    const result = finalChunks.map((c) => c.content);

    logger.info('RAG', 'Semantic chunking completed', {
      inputLength: text.length,
      outputChunks: result.length,
      avgChunkSize: result.reduce((sum, c) => sum + c.length, 0) / (result.length || 1),
    });

    return result;
  } catch (error) {
    logger.error('RAG', 'Semantic chunking failed', error);
    // Fallback to simple chunking
    return [text];
  }
}

/**
 * Legacy chunkText function wrapper for backward compatibility
 * Uses semantic chunking with default parameters
 *
 * @deprecated Use semanticChunk instead
 */
export async function chunkTextSemantic(
  text: string,
  chunkSize: number = 500,
  chunkOverlap: number = 50
): Promise<string[]> {
  return semanticChunk(text, {
    maxChunkSize: chunkSize,
    chunkOverlap,
    minChunkSize: Math.floor(chunkSize * 0.5),
  });
}
