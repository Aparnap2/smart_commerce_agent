/**
 * E-Commerce Agent SSE API Route
 * 
 * Real LangGraph implementation with SSE streaming.
 * Proxies to the LangGraph supervisor workflow.
 */

import { createSupervisorGraph } from '@/lib/agents/supervisor';

export async function POST(req: Request) {
  const body = await req.json();
  const userId = req.headers.get('x-user-id') ?? 'anonymous';
  const role = req.headers.get('x-user-role') ?? 'SHOPPER';
  const threadId = body.threadId ?? crypto.randomUUID();
  const message = body.message as string;

  if (!message) {
    return Response.json({ error: 'message required' }, { status: 400 });
  }

  const graph = await createSupervisorGraph();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        const events = graph.streamEvents(
          {
            messages: [`user: ${message}`],
            userId,
          },
          { version: 'v2', configurable: { thread_id: threadId } }
        );

        for await (const event of events) {
          if (event.event === 'on_chat_model_stream') {
            const chunk = event.data?.chunk?.content;
            if (chunk) {
              send({ type: 'delta', content: chunk });
            }
          }
          if (event.event === 'on_tool_start') {
            send({ type: 'tool_call', tool: event.name });
          }
          if (event.event === 'on_tool_end') {
            send({ type: 'tool_complete', tool: event.name });
          }
          if (event.event === 'on_chain_end' && event.name === 'LangGraph') {
            const state = event.data?.output;
            if (state?.uiComponents?.length) {
              send({ type: 'ui_actions', actions: state.uiComponents });
            }
            send({ type: 'thread_id', threadId });
            send({ type: 'complete' });
          }
        }
      } catch (err: unknown) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Agent error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
