// scripts/test-ollama.js
const { ChatOllama } = require('@langchain/ollama')
const { OllamaEmbeddings } = require('@langchain/ollama')

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

async function testChat() {
  console.log('🧪 Testing Ollama Chat Model...')
  
  const chatModel = new ChatOllama({
    baseUrl: OLLAMA_BASE_URL,
    model: 'qwen3:0.6b',
    temperature: 0,
    streaming: false,
  })
  
  try {
    const response = await chatModel.invoke([
      { role: 'user', content: 'Say hello in one word' }
    ])
    console.log('✅ Chat OK:', response.content.trim())
    return true
  } catch (error) {
    console.error('❌ Chat FAIL:', error.message)
    return false
  }
}

async function testEmbeddings() {
  console.log('🧪 Testing Ollama Embeddings...')
  
  const embeddings = new OllamaEmbeddings({
    baseUrl: OLLAMA_BASE_URL,
    model: 'nomic-embed-text:latest',
  })
  
  try {
    const vector = await embeddings.embedQuery('hello world')
    console.log('✅ Embeddings OK:', vector.length, 'dimensions')
    return true
  } catch (error) {
    console.error('❌ Embeddings FAIL:', error.message)
    return false
  }
}

async function main() {
  console.log('🚀 Ollama Integration Test\n')
  
  const chatOk = await testChat()
  const embeddingsOk = await testEmbeddings()
  
  console.log('\n' + '='.repeat(40))
  if (chatOk && embeddingsOk) {
    console.log('✅ ALL TESTS PASSED')
    process.exit(0)
  } else {
    console.log('❌ SOME TESTS FAILED')
    process.exit(1)
  }
}

main()
