/**
 * Test setup file - loads environment variables before tests
 */
import dotenv from 'dotenv';
import path from 'path';
import '@testing-library/jest-dom/vitest';

// Load .env.local first so env vars are available
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Also load .env as fallback
dotenv.config();

// Set default DATABASE_URL if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/smart_commerce';
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6379';
}

console.log('[Test Setup] Loaded env vars:');
console.log('  AZURE_OPENAI_BASE_URL:', process.env.AZURE_OPENAI_BASE_URL);
console.log('  AZURE_OPENAI_DEPLOYMENT:', process.env.AZURE_OPENAI_DEPLOYMENT);
console.log('  DATABASE_URL:', process.env.DATABASE_URL);
