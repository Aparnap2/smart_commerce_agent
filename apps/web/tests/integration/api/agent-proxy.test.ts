import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock fetch globally — we test proxy logic, not real agent-core
const mockFetch = vi.fn()
global.fetch    = mockFetch

// Import after mock is in place
const { POST } = await import('../../../app/api/agent/route')

function makeRequest(body: unknown, token = 'Bearer valid-token', userId = 'user-1') {
  return new NextRequest('http://localhost:3000/api/agent', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': token,
      'x-user-id':     userId,
    },
    body: JSON.stringify(body),
  })
}

describe('/api/agent proxy', () => {

  beforeEach(() => mockFetch.mockReset())

  it('proxies SSE stream from agent-core', async () => {
    const sseBody = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"type":"delta","content":"Hi"}\n\n'))
        c.enqueue(new TextEncoder().encode('data: {"type":"complete"}\n\n'))
        c.close()
      }
    })
    mockFetch.mockResolvedValueOnce(
      new Response(sseBody, {
        status:  200,
        headers: { 'Content-Type': 'text/event-stream' }
      })
    )
    const res = await POST(makeRequest({ message: 'hello' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('returns 401 when x-user-id header missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/agent', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: 'hello' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 502 when agent-core is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const res = await POST(makeRequest({ message: 'hello' }))
    expect(res.status).toBe(502)
  })

  it('forwards Authorization header to agent-core', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(new ReadableStream({ start(c) { c.close() } }), { status: 200 })
    )
    await POST(makeRequest({ message: 'test' }, 'Bearer my-jwt-token'))
    const callArgs = mockFetch.mock.calls[0]
    expect(callArgs[1].headers['Authorization']).toBe('Bearer my-jwt-token')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/agent', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-1' },
      body:    'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

})
