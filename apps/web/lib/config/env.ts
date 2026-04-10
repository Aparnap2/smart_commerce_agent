const required = {
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  LLM_API_KEY: process.env.LLM_API_KEY,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  LLM_MODEL: process.env.LLM_MODEL,
} as const

const optional = {
  LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
  LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
  LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
  EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY,
  EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL,
  REDIS_URL: process.env.REDIS_URL,
} as const

function validateEnv() {
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k)

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n` +
      missing.map(k => `  - ${k}`).join('\n') +
      `\n\nCopy .env.example to .env.local and fill in values.`
    )
  }

  const missingOptional = Object.entries(optional)
    .filter(([, v]) => !v)
    .map(([k]) => k)

  if (missingOptional.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn(
      `[config] Optional env vars not set (features degraded):\n` +
      missingOptional.map(k => `  - ${k}`).join('\n')
    )
  }
}

if (process.env.NODE_ENV !== 'test') {
  validateEnv()
}

export const env = {
  ...required,
  ...optional,
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
} as const
