/**
 * Direct test of Ollama API (used by LLM provider abstraction)
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b';

async function testChatCompletion() {
  console.log('='.repeat(60));
  console.log('🧪 Testing Ollama Chat Completion');
  console.log('='.repeat(60));

  console.log(`\n📋 Configuration:`);
  console.log(`   URL: ${OLLAMA_BASE_URL}/v1/chat/completions`);
  console.log(`   Model: ${MODEL}`);

  // Test chat completion
  console.log(`\n💬 Testing chat completion...`);
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'What is 2+2?' }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No response';

    console.log(`   Response: "${content}"`);
    console.log(`   Tokens: ${data.usage?.total_tokens || 'N/A'}`);

    // Test JSON mode
    console.log(`\n📝 Testing JSON mode...`);
    const jsonResponse = await fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'user', content: 'Return a JSON object with keys "name" and "age"' }
        ],
        temperature: 0.2,
        format: { type: 'json_object' },
      }),
    });

    if (!jsonResponse.ok) {
      console.log(`   JSON mode failed: HTTP ${jsonResponse.status}`);
    } else {
      const jsonData = await jsonResponse.json();
      console.log(`   Response: ${jsonData.choices?.[0]?.message?.content}`);
    }

    // Track test results
    let allPassed = true;

    // Test embedding
    console.log(`\n🔢 Testing embeddings...`);
    const embedResponse = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: 'Hello world',
      }),
    });

    if (embedResponse.ok) {
      const embedData = await embedResponse.json();
      console.log(`   Embedding dimensions: ${embedData.embedding?.length || 'N/A'}`);
    } else {
      console.log(`   Embedding failed: HTTP ${embedResponse.status}`);
      allPassed = false;
    }

    if (allPassed) {
      console.log(`\n✅ All Ollama tests passed!`);
    } else {
      console.log(`\n⚠️ Some Ollama tests failed (see above)`);
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

testChatCompletion();
