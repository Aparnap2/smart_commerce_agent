import { OpenAI, AzureOpenAI } from 'openai';
import { env } from '../env.js';

/**
 * Determine which LLM provider to use based on environment
 * Priority: Azure OpenAI -> Ollama -> OpenAI
 * @returns {{provider: 'azure'|'ollama'|'openai', client: OpenAI | AzureOpenAI, modelName: string}}
 */
export function getLLMConfig() {
  if (env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_BASE_URL) {
    console.log('🔧 Using Azure OpenAI SDK (Primary)');

    const client = new AzureOpenAI({
      apiKey: env.AZURE_OPENAI_API_KEY,
      endpoint: env.AZURE_OPENAI_BASE_URL,
      apiVersion: env.AZURE_OPENAI_API_VERSION,
    });

    return {
      provider: 'azure',
      client,
      modelName: env.AZURE_OPENAI_DEPLOYMENT || 'gpt-oss-120b',
    };
  }

  if (env.OLLAMA_BASE_URL) {
    console.log('🔧 Using Ollama OpenAI-compatible endpoint');

    const client = new OpenAI({
      apiKey: 'ollama', // Dummy
      baseURL: `${env.OLLAMA_BASE_URL}/v1`,
    });

    return {
      provider: 'ollama',
      client,
      modelName: env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
    };
  }

  if (env.OPENAI_API_KEY) {
    console.log('🔧 Using OpenAI SDK');

    const client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });

    return {
      provider: 'openai',
      client,
      modelName: env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }

  throw new Error('No LLM provider configured. Set AZURE_OPENAI_API_KEY, OLLAMA_BASE_URL, or OPENAI_API_KEY.');
}

export function getLLMClient() {
  return getLLMConfig().client;
}

export function getLLMModel() {
  return getLLMConfig().modelName;
}

/**
 * Check if we're in development mode
 * @returns {boolean}
 */
export function isDevelopment() {
  return env.NODE_ENV === 'development';
}

/**
 * Get current LLM provider information
 * @returns {{provider: string, modelName: string, isDev: boolean}}
 */
export function getLLMInfo() {
  const config = getLLMConfig();
  return {
    provider: config.provider,
    modelName: config.modelName,
    isDev: isDevelopment(),
  };
}