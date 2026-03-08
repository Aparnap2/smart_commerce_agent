import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  const token  =
    req.headers.get('authorization') ??
    `Bearer ${req.cookies.get('token')?.value ?? ''}`

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
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
