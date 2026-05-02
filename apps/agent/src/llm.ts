// apps/agent/src/llm.ts
import { ChatOllama } from '@langchain/ollama'
import { OllamaEmbeddings } from '@langchain/ollama'

// Ollama runs locally at http://localhost:11434
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

// Chat model for agent (use qwen3:0.6b - lightweight but capable)
export const chatModel = new ChatOllama({
  baseUrl: OLLAMA_BASE_URL,
  model: process.env.OLLAMA_CHAT_MODEL ?? 'qwen3:0.6b',
  temperature: 0,       // deterministic tool calls
  numPredict: 4096,     // max tokens
  streaming: true,      // required for GenUI streaming
})

// Embedding model for pgvector (use nomic-embed-text)
export const embeddingModel = new OllamaEmbeddings({
  baseUrl: OLLAMA_BASE_URL,
  model: process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text:latest',
})
