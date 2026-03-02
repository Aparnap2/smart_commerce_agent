/**
 * Cross-Encoder Reranker for RAG
 *
 * Reranks retrieval candidates using cross-encoder scoring.
 * Supports both Ollama-based scoring and HuggingFace cross-encoder models.
 *
 * @packageDocumentation
 */

import { logger } from '../redis/logger.js';
import { env } from '../env.js';

/**
 * Document candidate for reranking
 */
export interface RerankCandidate {
  id: string | number;
  content: string;
  title?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Reranked result with new score
 */
export interface RerankResult extends RerankCandidate {
  rerankScore: number;
  originalScore?: number;
}

/**
 * Reranker configuration
 */
export interface RerankerConfig {
  /** Model to use for reranking */
  model: 'ollama' | 'cross-encoder';
  /** Cross-encoder model name (for HuggingFace) */
  crossEncoderModel?: string;
  /** Ollama model for scoring */
  ollamaModel?: string;
  /** Ollama base URL */
  ollamaBaseUrl?: string;
  /** Number of top results to return */
  topK: number;
  /** Minimum score threshold */
  minScore?: number;
}

/**
 * Default reranker configuration
 */
const DEFAULT_CONFIG: RerankerConfig = {
  model: 'ollama',
  ollamaModel: 'qwen2.5-coder:3b',
  ollamaBaseUrl: env.OLLAMA_BASE_URL || 'http://localhost:11434',
  topK: 5,
  minScore: 0.1,
};

/**
 * Calculate relevance score between query and document using Ollama
 */
export async function scoreWithOllama(
  query: string,
  document: string,
  config: RerankerConfig
): Promise<number> {
  const prompt = `You are a relevance scorer. Rate how relevant the document is to the query on a scale of 0 to 1.

Query: ${query}

Document: ${document.substring(0, 500)}

Respond with ONLY a number between 0 and 1, where:
- 0 = Completely irrelevant
- 0.5 = Somewhat relevant
- 1 = Perfectly relevant

Score:`;

  try {
    const response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.ollamaModel || 'qwen2.5-coder:3b',
        prompt,
        stream: false,
        options: {
          temperature: 0,
          num_predict: 5,
        },
      }),
    });

    if (!response.ok) {
      logger.warn('RAG', 'Ollama scoring failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return 0;
    }

    const data = await response.json() as { response: string };
    const scoreStr = data.response.trim();
    
    // Extract number from response
    const match = scoreStr.match(/(0?\.\d+|1\.0+|0|1)/);
    if (match) {
      const score = parseFloat(match[1]);
      if (!isNaN(score) && score >= 0 && score <= 1) {
        return score;
      }
    }

    logger.warn('RAG', 'Invalid score format from Ollama', { response: scoreStr });
    return 0;
  } catch (error) {
    logger.error('RAG', 'Ollama scoring error', error);
    return 0;
  }
}

/**
 * Score query-document pair using cross-encoder model
 * Note: This would require a HuggingFace Inference API or local model server
 */
async function scoreWithCrossEncoder(
  query: string,
  document: string,
  _config: RerankerConfig
): Promise<number> {
  // Placeholder for HuggingFace cross-encoder integration
  // In production, this would call a cross-encoder model server
  logger.debug('RAG', 'Cross-encoder scoring (placeholder)', {
    queryLength: query.length,
    docLength: document.length,
  });

  // Fallback: simple text overlap score as placeholder
  const queryWords = query.toLowerCase().split(/\s+/);
  const docWords = document.toLowerCase().split(/\s+/);
  const matches = queryWords.filter((w) => docWords.includes(w));
  
  return matches.length / queryWords.length;
}

/**
 * Rerank candidates based on query relevance
 *
 * @param query - The search query
 * @param candidates - Array of candidate documents to rerank
 * @param options - Reranker configuration options
 * @returns Reranked and sorted results
 *
 * @example
 * ```typescript
 * const reranked = await rerankCandidates(query, candidates, {
 *   topK: 5,
 *   model: 'ollama',
 * });
 * ```
 */
export async function rerankCandidates(
  query: string,
  candidates: RerankCandidate[],
  options: Partial<RerankerConfig> = {}
): Promise<RerankResult[]> {
  const config: RerankerConfig = {
    ...DEFAULT_CONFIG,
    ...options,
  };

  if (!query || query.trim().length === 0) {
    logger.warn('RAG', 'Empty query for reranking');
    return [];
  }

  if (candidates.length === 0) {
    logger.debug('RAG', 'No candidates to rerank');
    return [];
  }

  logger.info('RAG', 'Reranking candidates', {
    candidateCount: candidates.length,
    model: config.model,
    topK: config.topK,
  });

  try {
    // Score each candidate
    const scored: RerankResult[] = await Promise.all(
      candidates.map(async (candidate) => {
        let score: number;

        if (config.model === 'ollama') {
          score = await scoreWithOllama(query, candidate.content, config);
        } else {
          score = await scoreWithCrossEncoder(query, candidate.content, config);
        }

        return {
          ...candidate,
          rerankScore: score,
          originalScore: candidate.score,
        };
      })
    );

    // Sort by rerank score (descending)
    const sorted = scored.sort((a, b) => b.rerankScore - a.rerankScore);

    // Apply minimum score threshold
    const filtered = config.minScore
      ? sorted.filter((r) => r.rerankScore >= config.minScore)
      : sorted;

    // Return top K results
    const results = filtered.slice(0, config.topK);

    logger.info('RAG', 'Reranking completed', {
      inputCount: candidates.length,
      outputCount: results.length,
      avgScore: results.reduce((sum, r) => sum + r.rerankScore, 0) / (results.length || 1),
      maxScore: Math.max(...results.map((r) => r.rerankScore), 0),
    });

    return results;
  } catch (error) {
    logger.error('RAG', 'Reranking failed', error);
    // Return original candidates sorted by original score as fallback
    return candidates
      .map((c) => ({
        ...c,
        rerankScore: c.score || 0,
        originalScore: c.score,
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, config.topK);
  }
}

/**
 * Batch reranking for multiple queries
 */
export async function rerankBatch(
  queryDocs: Array<{ query: string; candidates: RerankCandidate[] }>,
  options: Partial<RerankerConfig> = {}
): Promise<RerankResult[][]> {
  return Promise.all(
    queryDocs.map(({ query, candidates }) => rerankCandidates(query, candidates, options))
  );
}

/**
 * Simple text-based relevance scoring (fallback)
 */
export function simpleRelevanceScore(query: string, document: string): number {
  const queryWords = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const docWords = document.toLowerCase().split(/\s+/);
  
  let matches = 0;
  for (const word of docWords) {
    if (queryWords.has(word)) {
      matches++;
    }
  }
  
  return matches / (queryWords.size || 1);
}
