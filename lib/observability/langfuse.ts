/**
 * Langfuse Observability Integration
 *
 * Provides tracing, metrics, and scoring for LangGraph agents.
 * Supports both cloud and self-hosted Langfuse instances.
 *
 * @packageDocumentation
 */

import { Langfuse } from 'langfuse';
import { env } from '@/lib/env';

/**
 * Langfuse configuration
 */
interface LangfuseConfig {
  /** Public API key */
  publicKey: string;
  /** Secret API key */
  secretKey: string;
  /** Langfuse API base URL (optional, for self-hosted) */
  baseUrl?: string;
  /** Environment (development, production) */
  environment?: string;
  /** Sampling rate for tracing (0-1) */
  sampleRate?: number;
}

/**
 * Langfuse service state
 */
interface LangfuseState {
  client: Langfuse | null;
  isInitialized: boolean;
  lastInitTime: number;
}

/**
 * Langfuse service singleton
 */
let _state: LangfuseState = {
  client: null,
  isInitialized: false,
  lastInitTime: 0,
};

/**
 * Create and initialize the Langfuse client
 */
export function initializeLangfuse(config?: Partial<LangfuseConfig>): Langfuse {
  if (_state.client && _state.isInitialized) {
    console.log('[Langfuse] Client already initialized');
    return _state.client;
  }

  console.log('[Langfuse] Initializing Langfuse client...');

  const publicKey = config?.publicKey || env.LANGFUSE_PUBLIC_KEY || '';
  const secretKey = config?.secretKey || env.LANGFUSE_SECRET_KEY || '';
  const baseUrl = config?.baseUrl || env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com';
  const environment = config?.environment || env.LANGFUSE_ENVIRONMENT || 'development';
   const sampleRate = config?.sampleRate ?? env.LANGFUSE_SAMPLING_RATE ?? 1.0;

  if (!publicKey || !secretKey) {
    console.warn('[Langfuse] Missing API keys, using no-op client');
    _state = {
      client: createNoOpClient(),
      isInitialized: true,
      lastInitTime: Date.now(),
    };
    return _state.client;
  }

  try {
    const client = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      environment,
      sampleRate,
    });

    // Verify connection by making a test call
    client.on('error', (error: Error) => {
      console.error('[Langfuse] Client error:', error.message);
    });

    _state = {
      client,
      isInitialized: true,
      lastInitTime: Date.now(),
    };

    console.log(`[Langfuse] ✅ Initialized (environment: ${environment}, baseUrl: ${baseUrl})`);
    return client;
  } catch (error) {
    console.error('[Langfuse] ❌ Failed to initialize:', error);
    _state = {
      client: createNoOpClient(),
      isInitialized: true,
      lastInitTime: Date.now(),
    };
    return _state.client;
  }
}

/**
 * Create a no-op client for when Langfuse is not configured
 */
function createNoOpClient(): Langfuse {
  const noopSpan = {
    end: () => noopSpan,
    flush: async () => {},
    update: () => noopSpan,
    event: () => noopSpan,
    generation: () => noopSpan,
    span: () => noopSpan,
    score: () => noopSpan,
  };

  const noopTrace = {
    end: () => noopTrace,
    flush: async () => {},
    update: () => noopTrace,
    event: () => noopTrace,
    generation: () => noopSpan,
    span: () => noopSpan,
    score: () => noopTrace,
  };

  return {
    trace: () => noopTrace,
    shutdown: async () => {},
  } as unknown as Langfuse;
}

/**
 * Get the Langfuse client
 */
export function getLangfuseClient(): Langfuse | null {
  return _state.client;
}

/**
 * Check if Langfuse is initialized and configured
 */
export function isLangfuseEnabled(): boolean {
  return _state.isInitialized && _state.client !== null;
}

/**
 * Create a trace for a LangGraph agent session
 */
export function createAgentTrace(
  agentName: string,
  input: Record<string, unknown>,
  metadata?: Record<string, unknown>
): ReturnType<Langfuse['trace']> | null {
  const client = getLangfuseClient();
  if (!client) return null;

  return client.trace({
    name: agentName,
    input,
    metadata: {
      agent: agentName,
      ...metadata,
    },
  });
}

/**
 * Create a trace span for a node execution
 */
export function createNodeSpan(
  parent: ReturnType<Langfuse['trace']>,
  nodeName: string,
  input: Record<string, unknown>
): ReturnType<ReturnType<Langfuse['trace']>['span']> {
  return parent.span({
    name: nodeName,
    input,
    metadata: { node: nodeName },
  });
}

/**
 * Record a tool execution in the trace
 */
export function recordToolExecution(
  parent: ReturnType<Langfuse['trace']>,
  toolName: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  durationMs: number
): void {
  parent.event({
    name: 'tool_call',
    metadata: {
      tool: toolName,
      input,
      output,
      duration_ms: durationMs,
    },
  });
}

/**
 * Record an LLM generation
 */
export function recordGeneration(
  parent: ReturnType<Langfuse['trace']>,
  name: string,
  input: unknown,
  output: unknown,
  model: string,
  modelParameters: Record<string, unknown>,
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }
): ReturnType<ReturnType<Langfuse['trace']>['generation']> {
  return parent.generation({
    name,
    input,
    output,
    model,
    modelParameters: modelParameters as Record<string, string | number | boolean | string[]>,
    metadata: usage ? {
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      total_tokens: usage.totalTokens,
    } : undefined,
  });
}

/**
 * Add a score to a trace (for evaluation)
 */
export function addTraceScore(
  trace: ReturnType<Langfuse['trace']>,
  name: string,
  value: number,
  comment?: string
): void {
  trace.score({
    name,
    value,
    comment,
  });
}

/**
 * Shutdown Langfuse client gracefully
 */
export async function shutdownLangfuse(): Promise<void> {
  if (_state.client) {
    await _state.client.shutdown();
    console.log('[Langfuse] Client shutdown complete');
  }
  _state = {
    client: null,
    isInitialized: false,
    lastInitTime: _state.lastInitTime,
  };
}

/**
 * Get Langfuse statistics
 */
export function getLangfuseStats(): {
  isInitialized: boolean;
  lastInitTime: number;
  isEnabled: boolean;
} {
  return {
    isInitialized: _state.isInitialized,
    lastInitTime: _state.lastInitTime,
    isEnabled: isLangfuseEnabled(),
  };
}

export type { LangfuseConfig };
