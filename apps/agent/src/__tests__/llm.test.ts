// apps/agent/src/__tests__/llm.test.ts
import { describe, it, expect, vi } from 'vitest'

const mockChatModel = {
  bindTools: vi.fn().mockReturnThis(),
  invoke: vi.fn().mockResolvedValue({
    content: 'ready',
    tool_calls: [],
  }),
}

const mockEmbeddingModel = {
  embedQuery: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
}

vi.mock('@langchain/ollama', () => ({
  ChatOllama: class {
    constructor() {
      return mockChatModel
    }
  },
  OllamaEmbeddings: class {
    constructor() {
      return mockEmbeddingModel
    }
  },
}))

describe('ollama llm client', () => {
  it('exports chatModel', async () => {
    const { chatModel } = await import('../llm.js')
    expect(chatModel).toBeDefined()
    expect(typeof (chatModel as any).invoke).toBe('function')
  })

  it('exports embeddingModel', async () => {
    const { embeddingModel } = await import('../llm.js')
    expect(embeddingModel).toBeDefined()
    expect(typeof (embeddingModel as any).embedQuery).toBe('function')
  })
})
