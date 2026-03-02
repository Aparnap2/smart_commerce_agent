/**
 * CopilotKit Runtime API Route
 *
 * This endpoint serves as the bridge between the CopilotKit frontend and 
 * the LangGraph-powered commerce agent.
 * 
 * Now wired with Redis checkpointer for stateful conversations.
 * Thread_id is derived from user session for per-user session persistence.
 *
 * @file app/api/copilotkit/route.ts
 */

import { NextRequest } from 'next/server';
import {
  CopilotRuntime,
  LangChainAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { getSupervisorGraph } from '@/lib/agents/supervisor';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

const initRuntime = () => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: new CopilotRuntime(),
    serviceAdapter: new LangChainAdapter({
      chainFn: async ({ messages, tools }) => {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.id) {
          throw new Error("Unauthorized. Please sign in to chat.");
        }
        
        // Get the supervisor graph with Redis checkpointer
        const graph = await getSupervisorGraph();
        
        // Use user ID as thread_id for per-user session persistence
        const threadId = session.user.id;
        
        // Prepare the state from messages
        const state = {
          messages: messages.map((m: any) => 
            `${m._getType()}: ${m.content}`
          ),
          userId: session.user.id,
        };

        // Invoke the graph with thread_id for stateful conversation
        return graph.invoke(state, {
          configurable: {
            thread_id: threadId,
            user_id: session.user.id,
          },
        });
      },
    }),
    endpoint: '/api/copilotkit',
  });
  return handleRequest;
};

export const POST = async (req: NextRequest) => {
  return initRuntime()(req);
};

export const GET = async (req: NextRequest) => {
  return initRuntime()(req);
};

export const OPTIONS = async (req: NextRequest) => {
  return initRuntime()(req);
};
