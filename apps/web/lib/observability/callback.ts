import { CallbackHandler } from 'langfuse-langchain'

export function createLangfuseCallback(opts: {
  userId: string
  sessionId: string
  tags?: string[]
  metadata?: Record<string, unknown>
}): CallbackHandler {
  return new CallbackHandler({
    userId: opts.userId,
    sessionId: opts.sessionId,
    tags: opts.tags ?? [],
    metadata: opts.metadata,
  })
}
