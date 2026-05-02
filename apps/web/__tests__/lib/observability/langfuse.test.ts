import { describe, it, expect, vi } from 'vitest'

vi.mock('langfuse', () => ({
  Langfuse: vi.fn().mockImplementation(() => ({
    shutdownAsync: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe('langfuse singleton', () => {
  it('exports a langfuse instance', async () => {
    const { langfuse } = await import('@/lib/observability/langfuse')
    expect(langfuse).toBeDefined()
    expect(typeof langfuse.shutdownAsync).toBe('function')
  })
})
