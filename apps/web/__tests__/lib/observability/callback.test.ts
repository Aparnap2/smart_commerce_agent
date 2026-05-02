import { describe, it, expect, vi } from 'vitest'

vi.mock('langfuse-langchain', () => ({
  CallbackHandler: vi.fn().mockImplementation((opts) => ({
    _opts: opts,
    flushAsync: vi.fn().mockResolvedValue(undefined),
  })),
}))

import { createLangfuseCallback } from '@/lib/observability/callback'

describe('createLangfuseCallback', () => {
  it('creates handler with userId and sessionId', () => {
    const handler = createLangfuseCallback({
      userId: 'user-123',
      sessionId: 'session-abc',
    })
    expect(handler).toBeDefined()
    expect((handler as any)._opts.userId).toBe('user-123')
    expect((handler as any)._opts.sessionId).toBe('session-abc')
  })

  it('defaults tags to empty array', () => {
    const handler = createLangfuseCallback({
      userId: 'user-1',
      sessionId: 'sess-1',
    })
    expect((handler as any)._opts.tags).toEqual([])
  })

  it('accepts custom tags', () => {
    const handler = createLangfuseCallback({
      userId: 'user-1',
      sessionId: 'sess-1',
      tags: ['tag1', 'tag2'],
    })
    expect((handler as any)._opts.tags).toEqual(['tag1', 'tag2'])
  })

  it('accepts metadata', () => {
    const handler = createLangfuseCallback({
      userId: 'user-1',
      sessionId: 'sess-1',
      metadata: { key: 'value' },
    })
    expect((handler as any)._opts.metadata).toEqual({ key: 'value' })
  })

  it('flushAsync resolves without throwing', async () => {
    const handler = createLangfuseCallback({
      userId: 'user-1',
      sessionId: 'sess-1',
    })
    await expect(handler.flushAsync()).resolves.not.toThrow()
  })
})
