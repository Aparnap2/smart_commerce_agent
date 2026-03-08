import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

// CopilotKit frontend sends POST here.
// We proxy to agent-core which handles all LangGraph logic.
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  const token  =
    req.headers.get('authorization') ??
    `Bearer ${req.cookies.get('token')?.value ?? ''}`

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Normalize CopilotKit message format → agent-core format
  // CopilotKit sends: { messages: [{role, content}], threadId?, ... }
  // agent-core expects: { message: string, thread_id?: string }
  const messages  = (body.messages as Array<{role:string;content:string}>) ?? []
  const lastUser  = [...messages].reverse().find(m => m.role === 'user')
  const agentBody = {
    message:   lastUser?.content ?? '',
    thread_id: (body.threadId as string | undefined) ??
               (body.thread_id as string | undefined),
  }

  if (!agentBody.message) {
    return Response.json({ error: 'No user message found' }, { status: 400 })
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
      body:   JSON.stringify(agentBody),
      // @ts-expect-error
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
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
