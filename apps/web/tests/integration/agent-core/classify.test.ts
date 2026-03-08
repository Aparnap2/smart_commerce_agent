/**
 * Agent Core Integration Tests
 * 
 * Prerequisites:
 *   - agent-core running on http://localhost:8000
 *   - Azure/OpenAI LLM configured
 * 
 * Run: pnpm vitest run tests/integration/agent-core/classify.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'

const AGENT = 'http://localhost:8000'
let TOKEN = ''

beforeAll(async () => {
  // Generate test token directly
  const jwt = await import('jose')
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'test-secret-change-in-prod-min-32-chars-long')
  TOKEN = await new jwt.SignJWT({
    userId: 'test-user-1',
    email: 'shopper@test.com',
    role: 'SHOPPER'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)
})

async function readSSE(response: Response, timeoutMs = 15000) {
  const events: any[] = []
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try { events.push(JSON.parse(line.slice(6))) } catch {}
      }
    }
    if (events.some(e => e.type === 'complete')) break
  }
  reader.cancel()
  return events
}

describe('Agent Core Chat', () => {
  it('valid token returns SSE stream', async () => {
    const r = await fetch(`${AGENT}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ message: 'hello' })
    })
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toContain('text/event-stream')
  })

  it('SSE stream ends with complete event', async () => {
    const r = await fetch(`${AGENT}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify({ message: 'show me products' })
    })
    const events = await readSSE(r, 20000)
    expect(events.some(e => e.type === 'complete')).toBe(true)
  }, 25000)

  it('missing token returns 401', async () => {
    const r = await fetch(`${AGENT}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' })
    })
    expect(r.status).toBe(401)
  })

  it('/health is unauthenticated', async () => {
    const r = await fetch(`${AGENT}/health`)
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(b.status).toBe('ok')
  })
})
