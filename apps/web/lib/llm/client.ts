/**
 * Azure OpenAI LLM Client
 *
 * Singleton client for Azure OpenAI Foundry integration.
 * This is the ONLY way to access the LLM in the entire app.
 *
 * Features:
 * - Singleton pattern (single client instance)
 * - Health check functionality
 * - Embedding model for RAG
 * - Type-safe configuration
 *
 * @file lib/llm/client.ts
 */

import { createAzure } from '@ai-sdk/azure';
import { generateText } from 'ai';

// Read environment variables directly (Azure-specific only, no fallbacks)
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY || '';
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || '';
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '';  // Let SDK use default
const AZURE_EMBEDDING_DEPLOYMENT = process.env.AZURE_EMBEDDING_DEPLOYMENT || '';

// Extract resource name from endpoint URL
// e.g., https://aparnaopenai.openai.azure.com/ -> aparnaopenai
const resourceName = AZURE_OPENAI_ENDPOINT
  .replace('https://', '')
  .replace('.openai.azure.com/', '')
  .replace('.openai.azure.com', '');

// Create Azure provider instance using resourceName (preferred method)
// Don't pass apiVersion - let SDK use its default
const azureConfig: ConstructorParameters<typeof createAzure>[0] = {
  apiKey: AZURE_OPENAI_API_KEY,
  resourceName: resourceName,
};

// Only add apiVersion if explicitly set
if (AZURE_OPENAI_API_VERSION) {
  azureConfig.apiVersion = AZURE_OPENAI_API_VERSION;
}

const azure = createAzure(azureConfig);

// LLM model instance for chat completions
// Uses the deployment name configured in environment
export const llm = azure.chat(AZURE_OPENAI_DEPLOYMENT);

// Embedding model for RAG (Retrieval-Augmented Generation)
// Used for vector search and semantic similarity
export const embeddingModel = azure.textEmbeddingModel(AZURE_EMBEDDING_DEPLOYMENT);

// Export model ID for reference
export const modelId = AZURE_OPENAI_DEPLOYMENT;

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  ok: boolean;
  latency?: number;
  text?: string;
  error?: string;
}

/**
 * Check LLM health by making a test request
 *
 * @returns Health check result with ok status and optional latency
 *
 * @example
 * ```typescript
 * const result = await checkLLMHealth();
 * if (result.ok) {
 *   console.log(`LLM is healthy, latency: ${result.latency}ms`);
 * } else {
 *   console.error(`LLM health check failed: ${result.error}`);
 * }
 * ```
 */
export async function checkLLMHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { text } = await generateText({
      model: llm,
      prompt: 'Say hello in one word',
      maxTokens: 10,
    });

    const latency = Date.now() - start;

    return {
      ok: text.length > 0,
      latency,
      text,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      ok: false,
      latency: Date.now() - start,
      error: errorMessage,
    };
  }
}
