/**
 * Full Stack E2E Smoke Test
 * 
 * Prerequisites (ALL must be running):
 *   - postgres + redis: make infra-up
 *   - commerce-api:     bun run src/index.ts (in apps/commerce-api/)
 *   - agent-core:       uvicorn main:app --port 8000 (in apps/agent-core/)
 *   - web:              pnpm dev (in apps/web/)
 * 
 * Run: pnpm vitest run tests/e2e/smoke.test.ts --reporter=verbose
 */

import { describe, it, expect, beforeAll } from 'vitest'

const WEB = 'http://localhost:3000'
const AGENT = 'http://localhost:8000'
const COMMERCE = 'http://localhost:3001'

let TOKEN = ''
let USER_ID = ''

beforeAll(async () => {
  // Login to get token
  const r = await fetch(`${WEB}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'shopper@test.com',
      password: 'Test1234!'
    })
  })
  const d = await r.json()
  TOKEN = d.token ?? d.accessToken ?? ''
  if (!TOKEN) throw new Error('Cannot get auth token - is web running?')

  // Decode userId from JWT
  const parts = TOKEN.split('.')
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  USER_ID = payload.userId ?? payload.sub ?? ''
})

async function readSSE(response: Response, timeoutMs = 20000) {
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

describe('Health Checks', () => {
  it.skip('commerce-api healthy', async () => {
    const r = await fetch(`${COMMERCE}/health`)
    expect((await r.json()).status).toBe('ok')
  })

  it.skip('agent-core healthy', async () => {
    const r = await fetch(`${AGENT}/health`)
    expect((await r.json()).status).toBe('ok')
  })

  it.skip('web responding', async () => {
    const r = await fetch(`${WEB}/`)
    expect([200, 307, 308]).toContain(r.status)
  })
})

describe('Full Stack: web → agent → commerce-api → postgres', () => {
  it.skip('product search returns complete SSE stream', async () => {
    const r = await fetch(`${WEB}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'x-user-id': USER_ID
      },
      body: JSON.stringify({ message: 'show me headphones' })
    })
    expect(r.status).toBe(200)
    const events = await readSSE(r, 25000)
    expect(events.some(e => e.type === 'complete')).toBe(true)
  }, 30000)

  it.skip('cart query completes cleanly', async () => {
    const r = await fetch(`${WEB}/api/agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'x-user-id': USER_ID
      },
      body: JSON.stringify({ message: 'what is in my cart?' })
    })
    const events = await readSSE(r, 25000)
    expect(events.some(e => e.type === 'complete')).toBe(true)
  }, 30000)
})
