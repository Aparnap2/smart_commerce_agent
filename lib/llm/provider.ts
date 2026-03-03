/**
 * LLM Provider - Azure AI Foundry ONLY
 * 
 * NO Ollama, NO Google, NO OpenAI direct.
 * Azure AI Foundry is the sole LLM provider.
 */

import { AzureChatOpenAI } from '@langchain/openai';
import { createCircuitBreaker } from '../resilience/circuit-breaker';

const DEGRADED_RESPONSE = {
  content: 'Service temporarily unavailable. Please try again.',
  degraded: true,
};

async function createAzureLLMAsync() {
  if (!process.env.AZURE_OPENAI_BASE_URL) {
    throw new Error('AZURE_OPENAI_BASE_URL is required. Check .env.local');
  }

  return new AzureChatOpenAI({
    azureOpenAIEndpoint: process.env.AZURE_OPENAI_BASE_URL,
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o-mini',
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21',
    temperature: 0.2,
    maxRetries: 2,
  });
}

function createAzureLLM() {
  if (!process.env.AZURE_OPENAI_BASE_URL) {
    throw new Error('AZURE_OPENAI_BASE_URL is required. Check .env.local');
  }

  return new AzureChatOpenAI({
    azureOpenAIEndpoint: process.env.AZURE_OPENAI_BASE_URL,
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o-mini',
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21',
    temperature: 0.2,
    maxRetries: 2,
  });
}

// Circuit-breaker wrapped export
export const llm = createCircuitBreaker(createAzureLLMAsync, {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
});

export function getLLM() {
  return createAzureLLM();
}

/**
 * Generate embeddings using Azure text-embedding-3-small
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(
    `${process.env.AZURE_OPENAI_BASE_URL}/openai/deployments/${process.env.AZURE_EMBEDDING_DEPLOYMENT}/embeddings?api-version=${process.env.AZURE_OPENAI_API_VERSION ?? '2024-10-21'}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_API_KEY!,
      },
      body: JSON.stringify({ input: text }),
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data?.[0]?.embedding || [];
}
