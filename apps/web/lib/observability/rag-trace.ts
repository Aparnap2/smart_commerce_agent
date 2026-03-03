/**
 * RAG Pipeline Tracing with Langfuse
 *
 * Provides comprehensive observability for RAG operations including
 * query transformation, retrieval, reranking, and generation spans.
 *
 * @packageDocumentation
 */

import { Langfuse } from 'langfuse';
import { logger } from '../redis/logger.js';
import { env } from '../env.js';

/**
 * RAG pipeline span types
 */
export type RAGSpanType =
  | 'query_transform'
  | 'vector_search'
  | 'document_search'
  | 'rerank'
  | 'llm_generation'
  | 'scoring'
  | 'cache_lookup';

/**
 * RAG trace context
 */
export interface RAGTraceContext {
  traceId: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Span data for RAG operations
 */
export interface RAGSpanData {
  type: RAGSpanType;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  level?: 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';
  statusMessage?: string;
  version?: string;
}

/**
 * RAG scoring metrics
 */
export interface RAGScores {
  faithfulness?: number;
  relevance?: number;
  contextPrecision?: number;
  answerRelevance?: number;
}

/**
 * Langfuse client wrapper for RAG tracing
 */
export class RAGTracer {
  private client: Langfuse | null = null;
  private enabled: boolean;

  constructor() {
    // Check if Langfuse is configured
    this.enabled = !!(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);

    if (this.enabled) {
      try {
        this.client = new Langfuse({
          publicKey: env.LANGFUSE_PUBLIC_KEY,
          secretKey: env.LANGFUSE_SECRET_KEY,
          baseUrl: env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
          requestTimeout: 10000,
        });

        this.client.on('error', (error) => {
          logger.error('RAG', 'Langfuse client error', error);
        });

        logger.info('RAG', 'Langfuse tracing enabled');
      } catch (error) {
        logger.error('RAG', 'Failed to initialize Langfuse', error);
        this.enabled = false;
      }
    } else {
      logger.warn('RAG', 'Langfuse not configured, tracing disabled');
    }
  }

  /**
   * Start a new RAG trace
   */
  trace(
    query: string,
    options: {
      userId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): RAGTraceContext {
    if (!this.client || !this.enabled) {
      return {
        traceId: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...options,
      };
    }

    const trace = this.client.trace({
      id: `rag-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: 'rag_pipeline',
      input: { query },
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: {
        ...options.metadata,
        timestamp: new Date().toISOString(),
        source: 'rag_service',
      },
    });

    logger.debug('RAG', 'Trace started', { traceId: trace.id });

    return {
      traceId: trace.id,
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: options.metadata,
    };
  }

  /**
   * Create a span for RAG operations
   */
  span(
    ctx: RAGTraceContext,
    data: RAGSpanData
  ): { end: (output?: unknown, scores?: RAGScores) => void } {
    if (!this.client || !this.enabled) {
      // No-op span when tracing disabled
      logger.debug('RAG', `Span (disabled): ${data.type}`);
      return {
        end: () => {},
      };
    }

    try {
      const trace = this.client.trace({ id: ctx.traceId });
      
      const span = trace.span({
        name: data.type,
        input: data.input,
        metadata: {
          ...data.metadata,
          spanType: data.type,
        },
        level: data.level || 'DEFAULT',
        statusMessage: data.statusMessage,
        version: data.version,
      });

      logger.debug('RAG', `Span created: ${data.type}`, { traceId: ctx.traceId });

      return {
        end: (output?: unknown, scores?: RAGScores) => {
          span.end({
            output,
            metadata: scores ? { scores } : undefined,
          });

          // Score the span if provided
          if (scores) {
            this.scoreSpan(ctx, data.type, scores);
          }

          logger.debug('RAG', `Span ended: ${data.type}`, { traceId: ctx.traceId });
        },
      };
    } catch (error) {
      logger.error('RAG', 'Failed to create span', error);
      return {
        end: () => {},
      };
    }
  }

  /**
   * Score a span with RAG metrics
   */
  scoreSpan(
    ctx: RAGTraceContext,
    spanName: string,
    scores: RAGScores
  ): void {
    if (!this.client || !this.enabled) {
      return;
    }

    try {
      const trace = this.client.trace({ id: ctx.traceId });

      // Score each metric
      Object.entries(scores).forEach(([key, value]) => {
        if (value !== undefined) {
          trace.score({
            name: `${spanName}_${key}`,
            value,
            comment: `${key} score for ${spanName}`,
          });
        }
      });

      logger.debug('RAG', 'Scores recorded', { traceId: ctx.traceId, scores });
    } catch (error) {
      logger.error('RAG', 'Failed to score span', error);
    }
  }

  /**
   * End the trace
   */
  end(ctx: RAGTraceContext, output?: unknown): void {
    if (!this.client || !this.enabled) {
      return;
    }

    try {
      const trace = this.client.trace({ id: ctx.traceId });
      trace.update({ output });
      this.client.flush();
      logger.debug('RAG', 'Trace ended', { traceId: ctx.traceId });
    } catch (error) {
      logger.error('RAG', 'Failed to end trace', error);
    }
  }

  /**
   * Flush all pending events
   */
  flush(): void {
    if (!this.client || !this.enabled) {
      return;
    }

    try {
      this.client.flush();
    } catch (error) {
      logger.error('RAG', 'Failed to flush Langfuse client', error);
    }
  }
}

/**
 * Singleton tracer instance
 */
let tracerInstance: RAGTracer | null = null;

/**
 * Get or create tracer instance
 */
export function getTracer(): RAGTracer {
  if (!tracerInstance) {
    tracerInstance = new RAGTracer();
  }
  return tracerInstance;
}

/**
 * Trace the complete RAG pipeline
 *
 * @param query - User query
 * @param fn - Async function to trace
 * @param options - Trace options
 */
export async function traceRAGPipeline<T>(
  query: string,
  fn: (ctx: RAGTraceContext) => Promise<T>,
  options: {
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const tracer = getTracer();
  const ctx = tracer.trace(query, options);

  try {
    // Query transform span
    const transformSpan = tracer.span(ctx, { type: 'query_transform', input: { query } });
    
    // Execute pipeline
    const result = await fn(ctx);

    // End transform span
    transformSpan.end({ result });

    // End trace
    tracer.end(ctx, result);

    return result;
  } catch (error) {
    // Record error
    tracer.span(ctx, {
      type: 'query_transform',
      input: { query },
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : 'Unknown error',
    }).end();

    tracer.end(ctx, { error: error instanceof Error ? error.message : 'Unknown' });
    throw error;
  }
}

/**
 * Create span helpers for specific RAG operations
 */
export function createRAGSpanHelpers(ctx: RAGTraceContext) {
  const tracer = getTracer();

  return {
    queryTransform: (input: string) =>
      tracer.span(ctx, { type: 'query_transform', input: { query: input } }),

    vectorSearch: (query: string, options?: unknown) =>
      tracer.span(ctx, { type: 'vector_search', input: { query, options } }),

    documentSearch: (query: string, options?: unknown) =>
      tracer.span(ctx, { type: 'document_search', input: { query, options } }),

    rerank: (query: string, candidates: unknown[]) =>
      tracer.span(ctx, { type: 'rerank', input: { query, candidateCount: candidates.length } }),

    llmGeneration: (prompt: string, context?: string) =>
      tracer.span(ctx, { type: 'llm_generation', input: { prompt, context } }),

    scoring: (scores: RAGScores) =>
      tracer.span(ctx, { type: 'scoring', input: scores }),

    cacheLookup: (query: string) =>
      tracer.span(ctx, { type: 'cache_lookup', input: { query } }),
  };
}
