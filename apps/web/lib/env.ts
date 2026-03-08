/**
 * Environment Variables - Type-safe access
 * 
 * This file provides type-safe access to environment variables.
 * Uses process.env directly with validation.
 */

export interface Env {
  NODE_ENV: 'development' | 'production' | 'test';
  OPENAI_BASE_URL: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_API_VERSION: string;
  AZURE_OPENAI_API_KEY: string;
  AZURE_OPENAI_BASE_URL: string;
  AZURE_OPENAI_DEPLOYMENT_NAME: string;
  AZURE_OPENAI_DEPLOYMENT: string;
  AZURE_OPENAI_API_VERSION: string;
  AZURE_EMBEDDING_DEPLOYMENT: string;
  EMBEDDING_MODEL: string;
  EMBEDDING_DIMENSIONS: number;
  QDRANT_URL: string;
  QDRANT_API_KEY: string;
  QDRANT_COLLECTION: string;
  DATABASE_URL: string;
  REDIS_URL?: string;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_HOST?: string;
  OLLAMA_BASE_URL?: string;
  [key: string]: string | number | boolean | undefined;
}

export const env: Env = {
  NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test' || 'development',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || '',
  OPENAI_API_VERSION: process.env.OPENAI_API_VERSION || '',
  AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY || '',
  AZURE_OPENAI_BASE_URL: process.env.AZURE_OPENAI_BASE_URL || '',
  AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
  AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || '',
  AZURE_EMBEDDING_DEPLOYMENT: process.env.AZURE_EMBEDDING_DEPLOYMENT || process.env.EMBEDDING_MODEL || '',
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || '',
  EMBEDDING_DIMENSIONS: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10),
  QDRANT_URL: process.env.QDRANT_URL || '',
  QDRANT_API_KEY: process.env.QDRANT_API_KEY || '',
  QDRANT_COLLECTION: process.env.QDRANT_COLLECTION || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  REDIS_URL: process.env.REDIS_URL,
  LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
  LANGFUSE_HOST: process.env.LANGFUSE_HOST,
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
};
