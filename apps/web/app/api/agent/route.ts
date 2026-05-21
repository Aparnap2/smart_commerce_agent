import { NextRequest } from 'next/server'
import { chatRateLimit } from '@/lib/security/ratelimit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  const token  =
    req.headers.get('authorization') ??
    `Bearer ${req.cookies.get('token')?.value ?? ''}`

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = await chatRateLimit(userId)
  if (!limit.allowed) {
    return Response.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(limit.remaining),
          'X-RateLimit-Reset':     String(limit.resetAt),
          'Retry-After': String(limit.resetAt - Math.floor(Date.now() / 1000)),
        },
      }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const agentUrl = `${process.env.AGENT_CORE_URL ?? 'http://localhost:8000'}/agent/chat`

  let agentResp: Response
  try {
    agentResp = await fetch(agentUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': token,
        'x-test-mode':   req.headers.get('x-test-mode') ?? '',
        'x-user-id':     userId,
      },
      body:   JSON.stringify(body),
      // @ts-expect-error Next.js requires duplex for streaming proxy
      duplex: 'half',
    })
  } catch (err) {
    return Response.json(
      { error: 'Agent core unavailable', detail: String(err) },
      { status: 502 }
    )
  }

  if (!agentResp.ok) {
    const text = await agentResp.text()
    return Response.json(
      { error: 'Agent error', detail: text },
      { status: agentResp.status }
    )
  }

  return new Response(agentResp.body, {
    status:  200,
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
