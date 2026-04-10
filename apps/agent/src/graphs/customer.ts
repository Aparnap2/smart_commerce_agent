import { Annotation, MessagesAnnotation, StateGraph } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { SystemMessage } from '@langchain/core/messages'
import { v4 as uuidv4 } from 'uuid'
import {
  searchProductsHandler,
  addToCartHandler,
  getCartHandler,
  getOrdersHandler,
  initiateReturnHandler,
  sanitizeForLLM,
  buildSystemContext,
} from '../handlers/index.js'
import type { SearchParams, CartParams, OrderParams, ReturnParams } from '../handlers/index.js'
import { createLangfuseCallback } from '../observability/callback.js'

const CustomerState = Annotation.Root({
  ...MessagesAnnotation.spec,
  userId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
})

const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'searchProducts',
      description: 'Search products by name, category, price, brand, or use case.',
      parameters: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'Search terms' },
          maxPrice: { type: 'number' as const, description: 'Maximum price in INR' },
          minPrice: { type: 'number' as const, description: 'Minimum price in INR' },
          brand: { type: 'string' as const, description: 'Filter by brand name' },
          category: { type: 'string' as const, description: 'Filter by category' },
          inStockOnly: { type: 'boolean' as const, description: 'Only return in-stock products' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'addToCart',
      description: 'Add a product to cart. Use productId from searchProducts results.',
      parameters: {
        type: 'object' as const,
        properties: {
          productId: { type: 'number' as const, description: 'Product ID to add' },
          quantity: { type: 'number' as const, description: 'Quantity to add' },
        },
        required: ['productId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getCart',
      description: "Show the user's current cart.",
      parameters: {
        type: 'object' as const,
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'getOrders',
      description: 'Get recent orders for tracking or history.',
      parameters: {
        type: 'object' as const,
        properties: {
          limit: { type: 'number' as const, description: 'Max orders to return' },
          status: { type: 'string' as const, description: 'Filter by status' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'initiateReturn',
      description: 'Start a return. Validates 7-day window.',
      parameters: {
        type: 'object' as const,
        properties: {
          orderId: { type: 'string' as const, description: 'Order ID to return' },
          reason: { type: 'string' as const, description: 'Return reason' },
        },
        required: ['orderId', 'reason'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'confirmAction',
      description: 'Show confirmation before any irreversible action.',
      parameters: {
        type: 'object' as const,
        properties: {
          action: { type: 'string' as const, description: 'Action to confirm' },
          detail: { type: 'string' as const, description: 'Additional details' },
          danger: { type: 'boolean' as const, description: 'Whether this is a dangerous action' },
        },
        required: ['action', 'detail'],
      },
    },
  },
]

async function agentNode(state: typeof CustomerState.State, config: { configurable?: { userId?: string; threadId?: string } }) {
  const userId = state.userId || config?.configurable?.userId || 'anonymous'
  const sessionId = config?.configurable?.threadId || 'unknown'

  const llm = new ChatOpenAI({
    model: process.env.LLM_MODEL ?? 'qwen3:0.6b',
    temperature: 0.3,
    apiKey: process.env.LLM_API_KEY ?? 'test-key',
    configuration: { baseURL: process.env.LLM_BASE_URL ?? 'http://localhost:11434/v1' },
  })

  const langfuseHandler = createLangfuseCallback({
    userId,
    sessionId,
    tags: ['customer-chat'],
    metadata: { messageCount: state.messages.length },
  })

  const systemContext = await buildSystemContext(userId)

  const systemPrompt = `You are a helpful shopping assistant for TechTrend, a premium electronics retailer in India.
Prices are in ₹ (INR).

Rules:
- NEVER navigate away. Everything happens in this chat.
- ALWAYS use confirmAction before checkout or returns.
- NEVER invent product IDs or prices not from tools.
- Keep responses concise — let UI components do visual work.
- No sycophantic openers.
${systemContext ? `\nUser context: ${systemContext}` : ''}`

  const llmWithTools = llm.bindTools(tools)
  const response = await llmWithTools.invoke(
    [new SystemMessage(systemPrompt), ...state.messages],
    { callbacks: [langfuseHandler as any] }
  )

  await langfuseHandler.flushAsync()

  if (!response.tool_calls?.length) {
    return { messages: [response] }
  }

  const toolResults = []

  for (const toolCall of response.tool_calls) {
    const { name, args, id } = toolCall
    let result: unknown

    try {
      if (name === 'searchProducts') {
        result = await searchProductsHandler(args as SearchParams, userId)
      } else if (name === 'addToCart') {
        result = await addToCartHandler(args as CartParams, userId)
      } else if (name === 'getCart') {
        result = await getCartHandler(userId)
      } else if (name === 'getOrders') {
        result = await getOrdersHandler(args as OrderParams, userId)
      } else if (name === 'initiateReturn') {
        result = await initiateReturnHandler(args as ReturnParams, userId)
      } else if (name === 'confirmAction') {
        result = 'Confirmation shown to user.'
      }
    } catch (e) {
      result = `Error: ${(e as Error).message}`
    }

    toolResults.push({
      type: 'tool' as const,
      tool_call_id: id!,
      content: String(result ?? 'Done'),
    })
  }

  return { messages: [response, ...toolResults] }
}

function shouldContinue(state: typeof CustomerState.State): 'agent' | '__end__' {
  const last = state.messages[state.messages.length - 1]
  if ((last as any)?.type === 'tool') return 'agent'
  return '__end__'
}

export const graph = new StateGraph(CustomerState)
  .addNode('agent', agentNode)
  .addEdge('__start__', 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    agent: 'agent',
    __end__: '__end__',
  })
  .compile()
