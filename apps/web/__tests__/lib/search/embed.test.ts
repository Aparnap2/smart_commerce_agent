import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/llm/client', () => ({
  embeddingModel: {
    embedQuery: vi.fn(),
    embedDocuments: vi.fn(),
  }
}))

import { embeddingModel } from '@/lib/llm/client'
import { embedText, embedBatch } from '@/lib/search/embed'

describe('embedText', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns Float32Array of length 1536', async () => {
    vi.mocked(embeddingModel.embedQuery).mockResolvedValue(new Array(1536).fill(0.1))

    const result = await embedText('Sony headphones')

    expect(result).toBeInstanceOf(Float32Array)
    expect(result!.length).toBe(1536)
  })

  it('calls embedQuery with the provided text', async () => {
    vi.mocked(embeddingModel.embedQuery).mockResolvedValue(new Array(1536).fill(0))

    await embedText('wireless earbuds for gym')

    expect(embeddingModel.embedQuery).toHaveBeenCalledWith('wireless earbuds for gym')
  })

  it('returns null on API error (fails open)', async () => {
    vi.mocked(embeddingModel.embedQuery).mockRejectedValue(new Error('rate limit'))

    const result = await embedText('test')
    expect(result).toBeNull()
  })
})

describe('embedBatch', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns array of Float32Arrays', async () => {
    const fakeVectors = [
      new Array(1536).fill(0.1),
      new Array(1536).fill(0.2),
    ]
    vi.mocked(embeddingModel.embedDocuments).mockResolvedValue(fakeVectors as any)

    const results = await embedBatch([
      'Sony headphones',
      'Budget earbuds',
    ])

    expect(results).toHaveLength(2)
    expect(results[0]).toBeInstanceOf(Float32Array)
    expect(results[1]).toBeInstanceOf(Float32Array)
  })

  it('returns empty array on error', async () => {
    vi.mocked(embeddingModel.embedDocuments).mockRejectedValue(new Error('timeout'))

    const result = await embedBatch(['test'])
    expect(result).toEqual([])
  })
})
