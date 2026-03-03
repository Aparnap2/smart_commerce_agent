/**
 * Supervisor Agent - LangGraph Graph Assembly
 * 
 * Assembles the complete LangGraph workflow for the commerce agent.
 * Includes intent classification, tool routing, and response generation.
 * 
 * Wired with Redis checkpointer for stateful conversations.
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import { AgentState, type AgentStateType } from './state';
import { classifyIntent } from './nodes/classify';
import { getCheckpointSaver } from '../redis/checkpointer';

/**
 * Route to appropriate node based on intent
 */
function routeByIntent(state: AgentStateType): string {
  const intent = state.intent;

  const routeMap: Record<string, string> = {
    product_search: 'search_node',
    cart_add: 'cart_node',
    cart_update: 'cart_node',
    cart_remove: 'cart_node',
    cart_view: 'cart_node',
    checkout: 'checkout_node',
    payment: 'checkout_node',
    order_status: 'order_node',
    order_history: 'order_node',
    order_cancel: 'order_node',
    refund_request: 'refund_node',
    support: 'support_node',
    recommendation: 'search_node',
    general: 'response_node',
  };

  return routeMap[intent || 'general'] || 'response_node';
}

/**
 * Create the supervisor graph with Redis checkpointer
 * 
 * @returns Compiled LangGraph workflow with checkpointing
 */
export async function createSupervisorGraph() {
  // Initialize graph with typed state
  const workflow = new StateGraph(AgentState);

  // Add classify node
  workflow.addNode('classify', classifyIntent);

  // Add placeholder nodes (to be implemented in Phase 3)
  workflow.addNode('search_node', async (state: AgentStateType) => {
    console.log('[SEARCH] Would search for products:', state.entities);
    return {
      toolResults: [{ tool: 'search', success: true, data: { products: [] } }],
    };
  });

  workflow.addNode('cart_node', async (state: AgentStateType) => {
    console.log('[CART] Would modify cart:', state.entities);
    return {
      toolResults: [{ tool: 'cart', success: true, data: { cartId: 'mock' } }],
    };
  });

  workflow.addNode('checkout_node', async (state: AgentStateType) => {
    console.log('[CHECKOUT] Would start checkout');
    return {
      toolResults: [{ tool: 'checkout', success: true, data: { sessionId: 'mock' } }],
    };
  });

  workflow.addNode('order_node', async (state: AgentStateType) => {
    console.log('[ORDER] Would fetch orders');
    return {
      toolResults: [{ tool: 'order', success: true, data: { orders: [] } }],
    };
  });

  workflow.addNode('refund_node', async (state: AgentStateType) => {
    console.log('[REFUND] Would process refund');
    return {
      toolResults: [{ tool: 'refund', success: true, data: { refundId: 'mock' } }],
    };
  });

  workflow.addNode('support_node', async (state: AgentStateType) => {
    console.log('[SUPPORT] Would create support ticket');
    return {
      toolResults: [{ tool: 'support', success: true, data: { ticketId: 'mock' } }],
    };
  });

  workflow.addNode('response_node', async (state: AgentStateType) => {
    // Generate response based on state
    const intent = state.intent;
    const sentiment = state.sentiment;

    let response = '';

    if (sentiment === 'frustrated') {
      response = "I understand your frustration. Let me help you with this issue.";
    } else if (intent === 'general') {
      response = "Hello! How can I assist you today?";
    } else {
      response = `I'll help you with ${intent}. Let me fetch that information.`;
    }

    return {
      messages: [`assistant: ${response}`],
    };
  });

  // Set entry point
  workflow.addEdge(START, 'classify');

  // Add conditional edges from classify
  workflow.addConditionalEdges('classify', routeByIntent, {
    search_node: 'search_node',
    cart_node: 'cart_node',
    checkout_node: 'checkout_node',
    order_node: 'order_node',
    refund_node: 'refund_node',
    support_node: 'support_node',
    response_node: 'response_node',
  });

  // Add edges from tool nodes to response
  workflow.addEdge('search_node', 'response_node');
  workflow.addEdge('cart_node', 'response_node');
  workflow.addEdge('checkout_node', 'response_node');
  workflow.addEdge('order_node', 'response_node');
  workflow.addEdge('refund_node', 'response_node');
  workflow.addEdge('support_node', 'response_node');

  // End from response
  workflow.addEdge('response_node', END);

  // Get the checkpoint saver
  const { saver } = await getCheckpointSaver();
  console.log(`[Supervisor] Using checkpointer type: ${saver instanceof MemorySaver ? 'memory' : 'redis'}`);

  // Compile with Redis checkpointer for stateful conversations
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return workflow.compile({
    checkpointer: saver as any,
  });
}

/**
 * Get or create supervisor graph instance (cached)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let graphInstance: any = null;

export async function getSupervisorGraph(): Promise<any> {
  if (!graphInstance) {
    graphInstance = await createSupervisorGraph();
  }
  return graphInstance;
}

/**
 * Get supervisor graph with a specific thread_id for testing
 */
export async function getSupervisorGraphForThread(threadId: string) {
  const graph = await getSupervisorGraph();
  return {
    graph,
    config: {
      configurable: {
        thread_id: threadId,
      },
    },
  };
}
