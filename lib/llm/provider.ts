/**
 * LLM Provider Abstraction Layer
 *
 * Provides unified interface for LLM calls with production fallback:
 * - Primary: OpenAI API (production/serverless)
 * - Fallback: Ollama (local development)
 *
 * @packageDocumentation
 */

import { env } from '@/lib/env';

/**
 * LLM Provider type
 */
export type LLMProvider = 'openai' | 'ollama';

/**
 * Chat message format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  format?: 'json_object' | 'text';
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * LLM Provider Configuration
 */
interface LLMConfig {
  provider: LLMProvider;
  baseUrl: string;
  apiKey?: string;
  model: string;
  defaultTemperature: number;
}

/**
 * Get LLM configuration from environment
 */
function getLLMConfig(): LLMConfig {
  // Check for OpenAI first (production)
  if (env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      defaultTemperature: 0.7,
    };
  }

  // Fallback to Ollama (local development)
  return {
    provider: 'ollama',
    baseUrl: env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
    defaultTemperature: 0.7,
  };
}

/**
 * Check if LLM service is available
 */
export async function checkLLMAvailability(): Promise<{
  available: boolean;
  provider: LLMProvider;
  latency: number;
}> {
  const config = getLLMConfig();
  const start = Date.now();

  try {
    const url = config.provider === 'openai'
      ? `${config.baseUrl}/models`
      : `${config.baseUrl}/api/tags`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (config.provider === 'openai' && config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(url, { method: 'GET', headers });

    return {
      available: response.ok,
      provider: config.provider,
      latency: Date.now() - start,
    };
  } catch {
    return {
      available: false,
      provider: config.provider,
      latency: Date.now() - start,
    };
  }
}

/**
 * Create chat completion using configured LLM provider
 */
export async function createChatCompletion(
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const config = getLLMConfig();
  const model = request.model || config.model;
  const temperature = request.temperature ?? config.defaultTemperature;

  const payload = config.provider === 'openai'
    ? createOpenAIPayload(model, request, temperature)
    : createOllamaPayload(model, request, temperature);

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (config.provider === 'openai' && config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error (${config.provider}): ${error}`);
  }

  const data = await response.json();

  if (config.provider === 'openai') {
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: data.usage,
    };
  }

  // Ollama response format
  return {
    content: data.message?.content || data.choices?.[0]?.message?.content || '',
  };
}

/**
 * Create OpenAI-compatible payload
 */
function createOpenAIPayload(
  model: string,
  request: ChatCompletionRequest,
  temperature: number
) {
  return {
    model,
    messages: request.messages,
    temperature,
    max_tokens: request.maxTokens,
    response_format: request.format === 'json_object'
      ? { type: 'json_object' }
      : undefined,
  };
}

/**
 * Create Ollama-compatible payload
 */
function createOllamaPayload(
  model: string,
  request: ChatCompletionRequest,
  temperature: number
) {
  return {
    model,
    messages: request.messages,
    temperature,
    // Ollama expects "json" string for JSON mode, not object
    format: request.format === 'json_object' ? 'json' : undefined,
  };
}

/**
 * Generate embeddings for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const config = getLLMConfig();

  if (config.provider === 'openai') {
    const response = await fetch(`${config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate embedding');
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || [];
  }

  // Ollama embedding
  const response = await fetch(`${config.baseUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.EMBEDDING_MODEL || 'nomic-embed-text',
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate embedding');
  }

  const data = await response.json();
  return data.embedding || [];
}

/**
 * Get provider info for logging
 */
export function getLLMProviderInfo(): { provider: LLMProvider; model: string; baseUrl: string } {
  const config = getLLMConfig();
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
  };
}
