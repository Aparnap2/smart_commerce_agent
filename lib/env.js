/**
 * Environment variable validation
 * Validates all required environment variables at application startup
 *
 * FOR FREE CLOUD DEPLOYMENT:
 * - Use Neon.tech for DATABASE_URL (serverless Postgres)
 * - Use Upstash for REDIS_URL (serverless Redis)
 * - Use Qdrant Cloud for vector search
 * - Use Langfuse Cloud for observability
 */

const requiredEnvVars = {
  // LOCAL: postgresql://postgres:postgres@localhost:5432/smart_commerce
  // CLOUD: postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neon_db
  DATABASE_URL: process.env.DATABASE_URL,
};

const optionalEnvVars = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  // OpenAI API Key (production/serverless deployment)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  // Google Gemini API Key
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  // Azure OpenAI (Primary LLM)
  AZURE_OPENAI_BASE_URL: process.env.AZURE_OPENAI_BASE_URL,
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_BASE_URL, // Alias for consistency
  AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-oss-120b',
  AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || '2024-10-21',
  AZURE_EMBEDDING_DEPLOYMENT: process.env.AZURE_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small',
  // Ollama (local development fallback)
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
  // Supabase Configuration (optional, for pgvector + auth)
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  // Embedding Configuration
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
  EMBEDDING_DIMENSIONS: parseInt(process.env.EMBEDDING_DIMENSIONS || '384'),
  // Stripe Configuration (for refund processing)
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  // Refund Policy Configuration
  REFUND_MAX_DAYS: parseInt(process.env.REFUND_MAX_DAYS || '30'),
  REFUND_MIN_AMOUNT: parseInt(process.env.REFUND_MIN_AMOUNT || '100'),
  // Redis Configuration (for LangGraph checkpointing)
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: parseInt(process.env.REDIS_DB || '0', 10),
  REDIS_POOL_SIZE: parseInt(process.env.REDIS_POOL_SIZE || '10', 10),
  REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX || 'langgraph:',
  REDIS_USE_TLS: process.env.REDIS_USE_TLS === 'true',
  USE_REDIS: process.env.USE_REDIS === 'true',
  CHECKPOINT_TTL: parseInt(process.env.CHECKPOINT_TTL || '86400', 10), // 24 hours default
  // Checkpointer Configuration
  CHECKPOINT_TYPE: process.env.CHECKPOINT_TYPE || 'memory', // 'redis' | 'postgres' | 'memory'
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  // Neon Connection Pool (for serverless environments)
  NEON_POOL_MAX: parseInt(process.env.NEON_POOL_MAX || '10', 10),
  NEON_POOL_MIN: parseInt(process.env.NEON_POOL_MIN || '0', 10),
  NEON_IDLE_TIMEOUT: parseInt(process.env.NEON_IDLE_TIMEOUT || '30000', 10),
  // Langfuse Observability Configuration
  LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
  LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
  LANGFUSE_ENVIRONMENT: process.env.LANGFUSE_ENVIRONMENT || process.env.NODE_ENV || 'development',
  LANGFUSE_SAMPLING_RATE: parseFloat(process.env.LANGFUSE_SAMPLING_RATE || '1.0'),
};

function validateEnvironment() {
  // Only validate on the server side
  if (typeof window !== 'undefined') {
    // Client-side: return empty object to avoid validation errors
    return {
      ...requiredEnvVars,
      ...optionalEnvVars,
    };
  }

  const missing = [];

  // Check required variables
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env.local file and ensure all required variables are set.'
    );
  }

  // Log validation success (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Environment variables validated successfully');
  }

  return {
    ...requiredEnvVars,
    ...optionalEnvVars,
  };
}

// Validate on module load
const env = validateEnvironment();

export { env };
export default env;