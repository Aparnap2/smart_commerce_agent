import { NextRequest } from 'next/server'
import { chatRateLimit } from '@/lib/security/ratelimit'

export const runtime = 'nodejs'

/**
 * Agent API Route
 *
 * Validates session headers injected by middleware (x-role, x-user-id)
 * before proxying requests to agent-core.
 *
 * Security checks:
 *  1. x-user-id must be present (injected by middleware for auth'd users)
 *  2. x-role must be present for agent tool filtering
 *  3. Rate limiting per user
 *  4. Session headers forwarded to agent-core for department-level isolation
 */

export async function POST(req: NextRequest) {
  // ── Session validation (headers injected by middleware) ─────────────
  const userId = req.headers.get('x-user-id')
  const role   = req.headers.get('x-role')
  const departmentId = req.headers.get('x-department-id')

  // If middleware injected these headers, they MUST be present for auth'd routes.
  // This is a defence-in-depth check: even if someone bypasses middleware,
  // the API route still enforces auth.
  if (!userId) {
    return Response.json({ error: 'Unauthorized — missing x-user-id' }, { status: 401 })
  }

  if (!role) {
    return Response.json({ error: 'Unauthorized — missing x-role' }, { status: 401 })
  }

  const token  =
    req.headers.get('authorization') ??
    `Bearer ${req.cookies.get('token')?.value ?? ''}`

  // ── Rate limit per user ─────────────────────────────────────────────
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

  // ── Parse request body ──────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Inject session context from middleware headers ──────────────────
  // The agent-core router reads body.configurable.role for tool filtering
  // and body.configurable.department_id for data isolation.
  const proxiedBody = {
    ...body,
    configurable: {
      ...(body.configurable as Record<string, unknown> | undefined),
      role: role,
      department_id: departmentId ?? '',
      user_id: userId,
    },
  }

  // ── Proxy to agent-core with session context ────────────────────────
  const agentUrl = `${process.env.AGENT_CORE_URL ?? 'http://localhost:8000'}/agent/chat`

  let agentResp: Response
  try {
    agentResp = await fetch(agentUrl, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'Authorization':    token,
        'x-test-mode':      req.headers.get('x-test-mode') ?? '',
        'x-user-id':        userId,
        'x-role':           role,
        'x-department-id':  departmentId ?? '',
      },
      body:   JSON.stringify(proxiedBody),
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
