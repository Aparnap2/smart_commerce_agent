/**
 * LLM Provider — OpenAI SDK Pattern (Provider-Swappable)
 * 
 * Works with: Azure AI Foundry, OpenAI, Together AI, Groq, Ollama, any OpenAI-compatible endpoint
 * Swap providers by changing .env vars — zero code changes.
 */

import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { createCircuitBreaker } from '../resilience/circuit-breaker';

const DEGRADED_RESPONSE = {
  content: 'Service temporarily unavailable. Please try again.',
  degraded: true,
};

function createLLMConfig() {
  if (!process.env.OPENAI_BASE_URL) {
    throw new Error('OPENAI_BASE_URL is required. Check .env.local');
  }

  const baseConfig = {
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY ?? 'placeholder',
  };

  // Add api-version query param for Azure AI Foundry
  if (process.env.OPENAI_API_VERSION) {
    return {
      ...baseConfig,
      defaultQuery: { 'api-version': process.env.OPENAI_API_VERSION },
    };
  }

  return baseConfig;
}

async function createLLMAsync() {
  return new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? 'gpt-oss-120b',
    temperature: 0.2,
    maxRetries: 2,
    configuration: createLLMConfig(),
  });
}

function createLLM() {
  return new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? 'gpt-oss-120b',
    temperature: 0.2,
    maxRetries: 2,
    configuration: createLLMConfig(),
  });
}

// Circuit-breaker wrapped export
export const llm = createCircuitBreaker(createLLMAsync, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

export function getLLM() {
  return createLLM();
}

/**
 * Get embeddings client — provider-swappable via env vars
 */
export function getEmbeddings() {
  return new OpenAIEmbeddings({
    model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
    configuration: createLLMConfig(),
  });
}

/**
 * Generate embeddings for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = getEmbeddings();
  const result = await embeddings.embedQuery(text);
  return result;
}
