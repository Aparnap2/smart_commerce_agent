import { describe, it, expect, vi } from 'vitest'

describe('LLM client', () => {
  it('exports llm as a defined value', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com/'
    process.env.AZURE_OPENAI_DEPLOYMENT = 'gpt-test'
    process.env.AZURE_OPENAI_API_VERSION = '2025-01-01-preview'

    const { llm } = await import('@/lib/llm/client')
    expect(llm).toBeDefined()
  })

  it('exports embeddingModel as a defined value', async () => {
    const { embeddingModel } = await import('@/lib/llm/client')
    expect(embeddingModel).toBeDefined()
  })
})
