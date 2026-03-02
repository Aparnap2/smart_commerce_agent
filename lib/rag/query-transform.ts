/**
 * Query Transformation Utilities for RAG
 *
 * Provides query rewriting and HyDE (Hypothetical Document Embeddings)
 * for improving retrieval quality.
 *
 * @packageDocumentation
 */

import { logger } from '../redis/logger.js';
import { env } from '../env.js';

/**
 * Query transformation result
 */
export interface QueryTransformResult {
  originalQuery: string;
  rewrittenQueries: string[];
  hydeDocument?: string;
  metadata: {
    transformationType: string[];
    modelUsed: string;
    timestamp: number;
  };
}

/**
 * Query transformation configuration
 */
export interface QueryTransformConfig {
  /** Number of query variations to generate */
  numVariations: number;
  /** Enable query rewriting */
  enableRewriting: boolean;
  /** Enable HyDE expansion */
  enableHyDE: boolean;
  /** Ollama model to use */
  model: string;
  /** Ollama base URL */
  baseUrl: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: QueryTransformConfig = {
  numVariations: 3,
  enableRewriting: true,
  enableHyDE: true,
  model: env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
  baseUrl: env.OLLAMA_BASE_URL || 'http://localhost:11434',
};

/**
 * Rewrite query to generate alternative formulations
 *
 * @param query - Original user query
 * @param config - Transformation configuration
 * @returns Array of rewritten queries
 */
export async function rewriteQuery(
  query: string,
  config: Partial<QueryTransformConfig> = {}
): Promise<string[]> {
  const fullConfig: QueryTransformConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  if (!query || query.trim().length === 0) {
    logger.warn('RAG', 'Empty query for rewriting');
    return [];
  }

  logger.debug('RAG', 'Rewriting query', {
    query: query.substring(0, 100),
    numVariations: fullConfig.numVariations,
  });

  const prompt = `You are helping to improve search query performance.
Given the following search query, generate ${fullConfig.numVariations} alternative formulations that might help find better results.

Original query: "${query}"

Generate ${fullConfig.numVariations} variations that:
1. Use different wording but keep the same intent
2. Include relevant synonyms
3. Vary in specificity (some more specific, some more general)
4. Are natural search queries

Respond with ONLY the variations, one per line, like:
variation 1
variation 2
variation 3`;

  try {
    const response = await fetch(`${fullConfig.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: fullConfig.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 200,
        },
      }),
    });

    if (!response.ok) {
      logger.warn('RAG', 'Query rewriting failed', {
        status: response.status,
      });
      return [query]; // Return original on failure
    }

    const data = await response.json() as { response: string };
    const variations = data.response
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line !== query)
      .slice(0, fullConfig.numVariations);

    // Always include original query
    const result = [query, ...variations];

    logger.info('RAG', 'Query rewritten', {
      originalQuery: query.substring(0, 50),
      variationCount: variations.length,
      variations: result,
    });

    return result;
  } catch (error) {
    logger.error('RAG', 'Query rewriting error', error);
    return [query];
  }
}

/**
 * Generate hypothetical document (HyDE) for query expansion
 *
 * HyDE works by generating a hypothetical document that would be
 * relevant to the query, then using that document's embedding
 * for semantic search.
 *
 * @param query - Original user query
 * @param config - Transformation configuration
 * @returns Hypothetical document text
 */
export async function hydeExpand(
  query: string,
  config: Partial<QueryTransformConfig> = {}
): Promise<string> {
  const fullConfig: QueryTransformConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  if (!query || query.trim().length === 0) {
    logger.warn('RAG', 'Empty query for HyDE expansion');
    return '';
  }

  logger.debug('RAG', 'Generating HyDE document', {
    query: query.substring(0, 100),
  });

  const prompt = `You are helping to improve search retrieval.
Given the following search query, write a short hypothetical document (2-3 paragraphs) that would be highly relevant to this query.

Query: "${query}"

Write a hypothetical document that:
1. Directly addresses the query
2. Contains relevant facts and details
3. Uses natural language that would appear in real documents
4. Is approximately 150-200 words

Hypothetical document:`;

  try {
    const response = await fetch(`${fullConfig.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: fullConfig.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 300,
        },
      }),
    });

    if (!response.ok) {
      logger.warn('RAG', 'HyDE generation failed', {
        status: response.status,
      });
      return query; // Return original query as fallback
    }

    const data = await response.json() as { response: string };
    const hydeDoc = data.response.trim();

    logger.info('RAG', 'HyDE document generated', {
      query: query.substring(0, 50),
      documentLength: hydeDoc.length,
    });

    return hydeDoc;
  } catch (error) {
    logger.error('RAG', 'HyDE generation error', error);
    return query;
  }
}

/**
 * Apply all query transformations
 *
 * @param query - Original user query
 * @param options - Transformation options
 * @returns Complete transformation result
 */
export async function transformQuery(
  query: string,
  options: {
    enableRewriting?: boolean;
    enableHyDE?: boolean;
    config?: Partial<QueryTransformConfig>;
  } = {}
): Promise<QueryTransformResult> {
  const {
    enableRewriting = true,
    enableHyDE = true,
    config = {},
  } = options;

  const fullConfig: QueryTransformConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  logger.info('RAG', 'Transforming query', {
    query: query.substring(0, 100),
    enableRewriting,
    enableHyDE,
  });

  const transformations: string[] = [];
  let hydeDoc: string | undefined;

  try {
    // Apply transformations in parallel
    const promises: Promise<void>[] = [];

    if (enableRewriting) {
      promises.push(
        rewriteQuery(query, fullConfig).then((variations) => {
          transformations.push(...variations);
        })
      );
    }

    if (enableHyDE) {
      promises.push(
        hydeExpand(query, fullConfig).then((doc) => {
          hydeDoc = doc;
        })
      );
    }

    await Promise.all(promises);

    // If no transformations applied, use original query
    if (transformations.length === 0) {
      transformations.push(query);
    }

    const result: QueryTransformResult = {
      originalQuery: query,
      rewrittenQueries: transformations,
      hydeDocument: hydeDoc,
      metadata: {
        transformationType: [
          ...(enableRewriting ? ['rewriting'] : []),
          ...(enableHyDE ? ['hyde'] : []),
        ],
        modelUsed: fullConfig.model,
        timestamp: Date.now(),
      },
    };

    logger.info('RAG', 'Query transformation complete', {
      queryCount: result.rewrittenQueries.length,
      hasHyDE: !!result.hydeDocument,
    });

    return result;
  } catch (error) {
    logger.error('RAG', 'Query transformation failed', error);
    // Return minimal result on failure
    return {
      originalQuery: query,
      rewrittenQueries: [query],
      hydeDocument: undefined,
      metadata: {
        transformationType: [],
        modelUsed: fullConfig.model,
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * Simple query expansion using synonyms (no LLM required)
 * Fast fallback when LLM is unavailable
 */
export function expandQuerySimple(query: string): string[] {
  const commonSynonyms: Record<string, string[]> = {
    cheap: ['affordable', 'inexpensive', 'budget', 'low-cost'],
    expensive: ['premium', 'high-end', 'costly', 'luxury'],
    good: ['quality', 'reliable', 'excellent', 'top-rated'],
    bad: ['poor', 'defective', 'low-quality', 'unreliable'],
    fast: ['quick', 'rapid', 'speedy', 'efficient'],
    slow: ['sluggish', 'delayed', 'unresponsive'],
    new: ['latest', 'recent', 'fresh', 'modern'],
    old: ['vintage', 'classic', 'previous', 'older'],
    buy: ['purchase', 'order', 'get', 'acquire'],
    return: ['refund', 'exchange', 'send back'],
    shipping: ['delivery', 'postage', 'dispatch'],
    warranty: ['guarantee', 'protection', 'coverage'],
  };

  const expanded: string[] = [query];
  const lowerQuery = query.toLowerCase();

  for (const [word, synonyms] of Object.entries(commonSynonyms)) {
    if (lowerQuery.includes(word)) {
      // Generate variations with synonyms
      for (const synonym of synonyms.slice(0, 2)) {
        const variation = query.replace(new RegExp(word, 'gi'), synonym);
        if (variation !== query) {
          expanded.push(variation);
        }
      }
    }
  }

  return expanded.slice(0, 5);
}
