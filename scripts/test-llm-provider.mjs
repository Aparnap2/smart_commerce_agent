/**
 * Test script for LLM provider abstraction
 * Tests both Ollama (local) and validates OpenAI configuration
 */

import { createChatCompletion, checkLLMAvailability, getLLMProviderInfo } from '../lib/llm/provider.ts';

async function testLLMProvider() {
  console.log('='.repeat(60));
  console.log('🧪 Testing LLM Provider Abstraction');
  console.log('='.repeat(60));

  // Check provider info
  const providerInfo = getLLMProviderInfo();
  console.log(`\n📋 Provider Info:`);
  console.log(`   Provider: ${providerInfo.provider}`);
  console.log(`   Model: ${providerInfo.model}`);
  console.log(`   Base URL: ${providerInfo.baseUrl}`);

  // Check availability
  console.log(`\n🔍 Checking LLM availability...`);
  const availability = await checkLLMAvailability();
  console.log(`   Available: ${availability.available}`);
  console.log(`   Latency: ${availability.latency}ms`);

  if (!availability.available) {
    console.log(`\n❌ LLM not available. Make sure Ollama is running or set OPENAI_API_KEY.`);
    process.exit(1);
  }

  // Test chat completion
  console.log(`\n💬 Testing chat completion...`);
  const response = await createChatCompletion({
    messages: [
      { role: 'user', content: 'What is 2+2? Answer in exactly 4 characters.' }
    ],
    temperature: 0.3,
  });

  console.log(`   Response: "${response.content}"`);
  if (response.usage) {
    console.log(`   Tokens: ${response.usage.promptTokens} + ${response.usage.completionTokens} = ${response.usage.totalTokens}`);
  }

  // Test JSON mode
  console.log(`\n📝 Testing JSON mode...`);
  const jsonResponse = await createChatCompletion({
    messages: [
      { role: 'user', content: 'Return a JSON object with keys "name" and "age"' }
    ],
    format: 'json_object',
    temperature: 0.2,
  });

  console.log(`   Response: ${jsonResponse.content}`);

  // Test embedding (if using OpenAI)
  if (providerInfo.provider === 'openai') {
    console.log(`\n🔢 Testing embeddings...`);
    const embedding = await generateEmbedding('Hello world');
    console.log(`   Embedding dimensions: ${embedding.length}`);
  }

  console.log(`\n✅ All tests passed!`);
  console.log('='.repeat(60));
}

// Wrapper for embedding test
async function generateEmbedding(text) {
  const { generateEmbedding } = await import('../lib/llm/provider.ts');
  return generateEmbedding(text);
}

testLLMProvider().catch(err => {
  console.error(`\n❌ Test failed: ${err.message}`);
  process.exit(1);
});
