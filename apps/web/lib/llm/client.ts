import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'

if (!process.env.LLM_API_KEY) {
  throw new Error('LLM_API_KEY is required. Set in .env - works for OpenAI, Groq, Together, Mistral, Ollama, or any OpenAI-compatible API.')
}

if (!process.env.LLM_BASE_URL) {
  throw new Error('LLM_BASE_URL is required. Examples: https://api.openai.com/v1, https://api.groq.com/openai/v1, http://localhost:11434/v1')
}

const sharedConfig = {
  apiKey: process.env.LLM_API_KEY,
  configuration: {
    baseURL: process.env.LLM_BASE_URL,
  },
}

export const llm = new ChatOpenAI({
  model: process.env.LLM_MODEL ?? 'gpt-4o',
  temperature: 0.3,
  streaming: true,
  ...sharedConfig,
})

export const embeddingModel = new OpenAIEmbeddings({
  model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
  apiKey: process.env.EMBEDDING_API_KEY ?? process.env.LLM_API_KEY,
  configuration: {
    baseURL: process.env.EMBEDDING_BASE_URL ?? process.env.LLM_BASE_URL,
  },
})
