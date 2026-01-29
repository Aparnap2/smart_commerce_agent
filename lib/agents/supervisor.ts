/**
 * E-Commerce Support Agent - Supervisor Agent with LangGraph
 *
 * Implements the supervisor agent with stateful workflow:
 * - Intent classification via LLM
 * - Tool execution (ProductSearch, InventoryCheck via Qdrant/Redis)
 * - Persistent state via PostgresCheckpointer
 * - Human-in-the-loop for refunds
 *
 * @packageDocumentation
 */

import {
  StateGraph,
  END,
  START,
  Annotation,
  CompiledStateGraph,
} from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type {
  IntentClassification,
} from './state';
import { Message } from './state';
import { env } from '@/lib/env';
import {
  productSearch,
  inventoryCheck,
  orderLookup,
  refundRequest,
  ProductSearchInput,
  InventoryCheckInput,
} from './tools';
import {
  createCheckpointer,
  createThreadConfig,
  type AnyCheckpointer,
} from '@/lib/redis/langgraph-checkpoint';

/**
 * Define the state schema for LangGraph using Annotation
 */
const StateAnnotation = Annotation.Root({
  // Message history with automatic append
  messages: Annotation<Message[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),

  // Current intent classification
  intent: Annotation<IntentClassification | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),

  // Current routing target
  currentAgent: Annotation<'supervisor' | 'refund' | 'tool' | 'ui'>({
    reducer: (prev, next) => next ?? prev,
    default: () => 'supervisor',
  }),

  // Tool execution results
  toolResults: Annotation<unknown[]>({
    reducer: (left, right) => [...(left || []), ...(right || [])],
    default: () => [],
  }),

  // Pending tool calls (for ToolNode)
  pendingToolCalls: Annotation<any[]>({
    reducer: (prev, next) => [...(prev || []), ...(next || [])],
    default: () => [],
  }),

  // Error handling
  error: Annotation<string | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),

  // Metadata for tracking
  threadId: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
  }),

  userId: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
  }),
});

// ============================================
// ToolNode Setup
// ============================================

/**
 * Create the ToolNode for tool execution
 */
function createToolNode(): ToolNode {
  // Create LangChain tools using the `tool` function with Zod schemas
  // Cast to any to avoid Zod v4 type incompatibilities with ToolNode
  const tools = [
    tool(
      async (input: ProductSearchInput) => {
        console.log(`[Tool] 🔍 product_search: "${input.query.substring(0, 50)}..."`);
        return productSearch(input);
      },
      {
        name: 'product_search',
        description: 'Search for products using semantic similarity. Best for natural language queries like "find laptops for programming" or "show me affordable headphones".',
        schema: z.object({
          query: z.string().describe('Natural language search query'),
          limit: z.number().int().positive().default(10).describe('Maximum results to return'),
          minScore: z.number().min(0).max(1).default(0.5).describe('Minimum similarity score (0-1)'),
          category: z.string().optional().describe('Filter by product category'),
          priceRange: z.array(z.number()).length(2).optional().describe('Price filter [min, max]'),
        }),
      }
    ),
    tool(
      async (input: InventoryCheckInput) => {
        console.log(`[Tool] 📦 inventory_check: ${input.productIds.length} products`);
        return inventoryCheck(input);
      },
      {
        name: 'inventory_check',
        description: 'Check stock availability for specific products. Use to verify items are in stock before confirming orders.',
        schema: z.object({
          productIds: z.array(z.string()).min(1).max(20).describe('Product IDs to check'),
          location: z.string().optional().describe('Warehouse location code'),
        }),
      }
    ),
    tool(
      async (input: { orderId?: string; email?: string; status?: string; limit?: number }) => {
        console.log(`[Tool] 📋 order_lookup:`, input);
        return orderLookup(input as any);
      },
      {
        name: 'order_lookup',
        description: 'Look up customer orders by order ID, email, or status. Use for tracking and order-related queries.',
        schema: z.object({
          orderId: z.string().optional().describe('Specific order ID'),
          email: z.string().email().optional().describe('Customer email'),
          status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional().describe('Order status filter'),
          limit: z.number().int().positive().default(10).describe('Maximum results'),
        }),
      }
    ),
    tool(
      async (input: { orderId: string; amount: number; reason: string; idempotencyKey: string }) => {
        console.log(`[Tool] 💰 refund_request: Order ${input.orderId}, Amount $${input.amount}`);
        return refundRequest(input as any);
      },
      {
        name: 'refund_request',
        description: 'Process a refund request. Requires order ID, amount, and reason. Always confirm with user before processing.',
        schema: z.object({
          orderId: z.string().describe('Order ID to refund'),
          amount: z.number().positive().describe('Refund amount'),
          reason: z.string().min(10).describe('Reason for refund (min 10 chars)'),
          idempotencyKey: z.string().uuid().describe('UUID for idempotency'),
        }),
      }
    ),
  ] as any;

  return new ToolNode(tools);
}

// ============================================
// Node Implementations
// ============================================

/**
 * Node: Classify user intent using LLM
 */
async function classifyIntentNode(state: typeof StateAnnotation.State): Promise<Partial<typeof StateAnnotation.State>> {
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';

  console.log(`[Supervisor] 🔍 Classifying: "${lastMessage.substring(0, 50)}..."`);

  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
        messages: [
          {
            role: 'system',
            content: `You are an intent classifier for an e-commerce support system.

Classify the user query into one of:
- product_search: "find/show/recommend products", "what do you have"
- order_inquiry: "track/order status", "where is my order"
- inventory_check: "is X in stock", "check availability"
- refund_request: "refund/money back", "return item"
- general_support: "other questions"

Respond with JSON: {"intent": "...", "confidence": 0.x, "reasoning": "..."}`
          },
          { role: 'user', content: lastMessage },
        ],
        temperature: 0.1,
        format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    const parsed = JSON.parse(content);
    const intent = parsed.intent || 'general_support';
    const confidence = parsed.confidence || 0.5;

    console.log(`[Supervisor] ✅ Intent: ${intent} (${confidence})`);

    return {
      intent: {
        intent: intent as any,
        confidence,
        extracted_entities: {},
        suggested_routing: intent === 'refund_request' ? 'refund' : 'tool',
      },
      currentAgent: intent === 'refund_request' ? 'refund' : 'tool',
    };
  } catch (error) {
    console.error('[Supervisor] ❌ Classification failed:', error);
    return {
      intent: {
        intent: 'general_support',
        confidence: 0.5,
        extracted_entities: {},
        suggested_routing: 'ui',
      },
      currentAgent: 'ui',
    };
  }
}

/**
 * Node: Generate tool calls based on intent
 */
async function generateToolCalls(state: typeof StateAnnotation.State): Promise<Partial<typeof StateAnnotation.State>> {
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';
  const intent = state.intent?.intent;

  console.log(`[ToolAgent] 🔧 Generating tool calls for: ${intent}`);

  const toolCalls: any[] = [];

  switch (intent) {
    case 'product_search': {
      toolCalls.push({
        id: `call-${Date.now()}-1`,
        type: 'function',
        function: {
          name: 'product_search',
          arguments: JSON.stringify({
            query: lastMessage,
            limit: 10,
            minScore: 0.5,
          }),
        },
      });
      break;
    }

    case 'inventory_check': {
      // Try to extract product IDs from message
      const productIdMatch = lastMessage.match(/[A-Z]{2,3}-?\d{3,}/g) || ['PROD-001', 'PROD-002'];
      toolCalls.push({
        id: `call-${Date.now()}-1`,
        type: 'function',
        function: {
          name: 'inventory_check',
          arguments: JSON.stringify({
            productIds: productIdMatch.slice(0, 5),
            location: 'main-warehouse',
          }),
        },
      });
      break;
    }

    case 'order_inquiry': {
      const emailMatch = lastMessage.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      toolCalls.push({
        id: `call-${Date.now()}-1`,
        type: 'function',
        function: {
          name: 'order_lookup',
          arguments: JSON.stringify({
            email: emailMatch?.[0] || undefined,
            limit: 5,
          }),
        },
      });
      break;
    }

    case 'refund_request': {
      toolCalls.push({
        id: `call-${Date.now()}-1`,
        type: 'function',
        function: {
          name: 'refund_request',
          arguments: JSON.stringify({
            orderId: 'ORD-001', // Would extract from message
            amount: 0, // Would calculate from order
            reason: 'Customer requested refund',
            idempotencyKey: crypto.randomUUID(),
          }),
        },
      });
      break;
    }
  }

  if (toolCalls.length > 0) {
    console.log(`[ToolAgent] ✅ Generated ${toolCalls.length} tool calls`);
  }

  return { pendingToolCalls: toolCalls };
}

/**
 * Node: Process tool results and generate response
 */
async function processToolResults(state: typeof StateAnnotation.State): Promise<Partial<typeof StateAnnotation.State>> {
  const toolResults = state.toolResults || [];
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';

  console.log(`[UIAgent] 📝 Processing ${toolResults.length} tool results`);

  try {
    // Build context from tool results
    const toolContext = toolResults.length > 0
      ? `\n\n## Tool Results:\n${JSON.stringify(toolResults, null, 2)}`
      : '';

    const response = await fetch(`${env.OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
        messages: [
          {
            role: 'system',
            content: `You are TechTrend Support AI. Use the tool results to answer the user's question.
Format responses as markdown with tables for data.
If no results found, say "I couldn't find matching records."
${toolContext}`
          },
          { role: 'user', content: lastMessage },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

    console.log(`[UIAgent] ✅ Response generated (${responseText.length} chars)`);

    return {
      messages: [{
        id: crypto.randomUUID(),
        role: 'ai',
        content: responseText,
        timestamp: Date.now(),
      }],
    };
  } catch (error) {
    console.error('[UIAgent] ❌ Response generation failed:', error);
    return {
      messages: [{
        id: crypto.randomUUID(),
        role: 'ai',
        content: 'I apologize, but I encountered an error while generating my response.',
        timestamp: Date.now(),
      }],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Node: Direct response for general support
 */
async function directResponseNode(state: typeof StateAnnotation.State): Promise<Partial<typeof StateAnnotation.State>> {
  const lastMessage = state.messages[state.messages.length - 1]?.content || '';

  console.log(`[UIAgent] 💬 Direct response for: "${lastMessage.substring(0, 30)}..."`);

  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL || 'qwen2.5-coder:3b',
        messages: [
          {
            role: 'system',
            content: 'You are TechTrend Support AI. Be helpful, concise, and friendly. Format responses with markdown.'
          },
          { role: 'user', content: lastMessage },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || 'How can I help you today?';

    return {
      messages: [{
        id: crypto.randomUUID(),
        role: 'ai',
        content: responseText,
        timestamp: Date.now(),
      }],
    };
  } catch (error) {
    return {
      messages: [{
        id: crypto.randomUUID(),
        role: 'ai',
        content: 'How can I help you today?',
        timestamp: Date.now(),
      }],
    };
  }
}

/**
 * Conditional edge: Route based on intent
 */
function shouldUseTools(state: typeof StateAnnotation.State): 'use_tools' | 'direct_response' | 'human_review' {
  const intent = state.intent?.intent;

  console.log(`[Supervisor] 🚦 Routing decision: ${intent}`);

  switch (intent) {
    case 'refund_request':
      return 'human_review'; // Interrupt for approval
    case 'product_search':
    case 'inventory_check':
    case 'order_inquiry':
      return 'use_tools';
    default:
      return 'direct_response';
  }
}

/**
 * Conditional edge: Continue or end after tool execution
 */
function shouldContinueAfterTools(state: typeof StateAnnotation.State): 'generate_response' | 'generate_response' {
  // After tools execute, always generate response
  return 'generate_response';
}

// ============================================
// Graph Construction
// ============================================

export async function createSupervisorGraph(checkpointer?: any): Promise<any> {
  console.log('[Supervisor] 🏗️ Building supervisor graph with tools...');

  const workflow = new StateGraph(StateAnnotation);

  // Add nodes
  workflow.addNode('classify_intent', classifyIntentNode);
  workflow.addNode('generate_tool_calls', generateToolCalls);
  workflow.addNode('tools', createToolNode());
  workflow.addNode('generate_response', processToolResults);
  workflow.addNode('direct_response', directResponseNode);
  workflow.addNode('human_review', async (state) => ({
    messages: [{
      id: crypto.randomUUID(),
      role: 'ai',
      content: 'I need your approval to process this refund. Would you like to continue?',
      timestamp: Date.now(),
    }],
  }));

  // Entry point
  (workflow as any).addEdge(START, 'classify_intent');

  // After intent classification, route based on intent
  (workflow as any).addConditionalEdges(
    'classify_intent',
    shouldUseTools,
    {
      use_tools: 'generate_tool_calls',
      direct_response: 'direct_response',
      human_review: 'human_review',
    }
  );

  // Tool execution flow
  (workflow as any).addEdge('generate_tool_calls', 'tools');
  (workflow as any).addConditionalEdges(
    'tools',
    shouldContinueAfterTools,
    {
      generate_response: 'generate_response',
    }
  );

  // End after response generation
  (workflow as any).addEdge('generate_response', END);
  (workflow as any).addEdge('direct_response', END);
  (workflow as any).addEdge('human_review', END);

  const compiled = (workflow as any).compile({
    checkpointer,
    interruptBefore: ['human_review'], // Human-in-the-loop for refunds
  });

  console.log('[Supervisor] ✅ Graph compiled successfully');

  return compiled;
}

/**
 * Convenience function to run the supervisor graph
 * Creates checkpointer based on CHECKPOINT_TYPE env var
 */
export async function runSupervisor(
  input: { message: string; threadId: string; userId: string },
  checkpointer?: AnyCheckpointer | undefined
): Promise<typeof StateAnnotation.State> {
  // Create checkpointer if not provided
  const cp = checkpointer || await createCheckpointer();

  console.log(`[Supervisor] 🔧 Checkpointer type: ${cp.constructor.name}`);

  const graph = await createSupervisorGraph(cp);

  const initialState = {
    messages: [{
      id: crypto.randomUUID(),
      role: 'human',
      content: input.message,
      timestamp: Date.now(),
    }],
    intent: undefined,
    currentAgent: 'supervisor',
    toolResults: [],
    pendingToolCalls: [],
    error: undefined,
    threadId: input.threadId,
    userId: input.userId,
  };

  console.log(`[Supervisor] 🚀 Invoking graph (thread: ${input.threadId})`);

  // Use the thread config helper
  const config = createThreadConfig(input.threadId, 'supervisor_session');

  try {
    const result = await graph.invoke(initialState, config);
    console.log(`[Supervisor] ✅ Graph execution complete`);
    return result;
  } catch (error) {
    console.error('[Supervisor] ❌ Graph execution failed:', error);
    throw error;
  }
}
