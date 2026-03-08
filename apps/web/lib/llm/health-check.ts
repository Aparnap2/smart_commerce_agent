/**
 * Azure LLM Health Check - Standalone Test
 *
 * Tests the real Azure OpenAI connection outside of vitest.
 * Run with: npx tsx lib/llm/health-check.ts
 */

// MUST load dotenv BEFORE any other imports
import dotenv from 'dotenv';
import path from 'path';

// .env.local is at project root (apps/web is a subdirectory)
const envPath = path.join(process.cwd(), '../../.env.local');
dotenv.config({ path: envPath });

// Now import the client (will use the loaded env vars)
import { checkLLMHealth } from './client.js';

async function main() {
  console.log('🔍 Azure OpenAI Health Check\n');
  console.log('Environment:');
  console.log(`  AZURE_OPENAI_BASE_URL: ${process.env.AZURE_OPENAI_BASE_URL || 'NOT SET'}`);
  console.log(`  AZURE_OPENAI_DEPLOYMENT: ${process.env.AZURE_OPENAI_DEPLOYMENT || 'NOT SET'}`);
  console.log(`  AZURE_OPENAI_API_VERSION: ${process.env.AZURE_OPENAI_API_VERSION || 'NOT SET'}`);
  console.log(`  AZURE_EMBEDDING_DEPLOYMENT: ${process.env.AZURE_EMBEDDING_DEPLOYMENT || 'NOT SET'}`);
  console.log(`  AZURE_OPENAI_API_KEY: ${process.env.AZURE_OPENAI_API_KEY ? 'SET (hidden)' : 'NOT SET'}`);
  console.log('');

  console.log('Running health check...');
  const result = await checkLLMHealth();

  console.log('\n📊 Result:');
  console.log(`  OK: ${result.ok ? '✅ Yes' : '❌ No'}`);
  console.log(`  Latency: ${result.latency}ms`);
  if (result.text) {
    console.log(`  Response: "${result.text}"`);
  }
  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }

  if (result.ok) {
    console.log('\n✅ Azure OpenAI is healthy and responding!');
    process.exit(0);
  } else {
    console.log('\n❌ Azure OpenAI health check failed!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
