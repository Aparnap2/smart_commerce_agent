import { Annotation, MessagesAnnotation, StateGraph } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { SystemMessage } from '@langchain/core/messages'
import { prisma } from '../db.js'
import { createLangfuseCallback } from '../observability/callback.js'
import { v4 as uuidv4 } from 'uuid'

const MerchantState = Annotation.Root({
  ...MessagesAnnotation.spec,
  userId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  userRole: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
})

const merchantTools = [
  {
    name: 'getRevenue',
    description: 'Get today revenue vs yesterday and last week.',
    schema: {},
  },
  {
    name: 'getAnomalies',
    description: 'Run operations briefing: inventory, orders, carts.',
    schema: {},
  },
  {
    name: 'getInventory',
    description: 'Show low stock products for reordering.',
    schema: {},
  },
  {
    name: 'confirmMerchantAction',
    description: 'Confirm single-record mutations.',
    schema: {
      action: { type: 'string' },
      detail: { type: 'string' },
      danger: { type: 'boolean', default: false },
    },
  },
  {
    name: 'bulkAction',
    description: 'Confirm bulk operations affecting >1 record.',
    schema: {
      action: { type: 'string' },
      scope: { type: 'string' },
      affectedCount: { type: 'number' },
    },
  },
]

async function merchantAgentNode(state: typeof MerchantState.State, config: { configurable?: { userId?: string; threadId?: string } }) {
  if (state.userRole !== 'MERCHANT') {
    return { messages: [{ id: uuidv4(), type: 'ai' as const, content: 'Access denied. Merchant account required.' }] }
  }

  const userId = state.userId || config?.configurable?.userId || 'anonymous'
  const sessionId = config?.configurable?.threadId || 'unknown'

  const langfuseHandler = createLangfuseCallback({
    userId,
    sessionId,
    tags: ['merchant-chat'],
    metadata: { userRole: state.userRole },
  })

  const llm = new ChatOpenAI({
    model: process.env.LLM_MODEL ?? 'gpt-4o',
    temperature: 0.2,
    apiKey: process.env.LLM_API_KEY,
    configuration: { baseURL: process.env.LLM_BASE_URL },
  })

  const llmWithTools = llm.bindTools(merchantTools)
  const response = await llmWithTools.invoke(
    [new SystemMessage(`You are an operations assistant for TechTrend merchants. Be precise with numbers. Use INR (₹). NEVER expose customer PII.`),
    ...state.messages],
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
      if (name === 'getRevenue') {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayRevenue = await prisma.order.aggregate({
          where: { orderDate: { gte: todayStart }, paymentStatus: 'PAID' },
          _sum: { total: true },
        })
        result = { today: todayRevenue._sum.total ?? 0 }
      } else if (name === 'getAnomalies') {
        const [lowStock, pendingOrders] = await Promise.all([
          prisma.product.count({ where: { stock: { gt: 0, lt: 5 } } }),
          prisma.order.count({ where: { status: 'PENDING' } }),
        ])
        result = { lowStock, pendingOrders }
      } else if (name === 'getInventory') {
        const products = await prisma.product.findMany({
          where: { stock: { gt: 0, lt: 5 } },
          orderBy: { stock: 'asc' },
          take: 20,
        })
        result = products
      } else if (name === 'confirmMerchantAction' || name === 'bulkAction') {
        result = 'Confirmation shown.'
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

function shouldContinue(state: typeof MerchantState.State): 'agent' | '__end__' {
  const last = state.messages[state.messages.length - 1]
  if ((last as any)?.type === 'tool') return 'agent'
  return '__end__'
}

export const graph = new StateGraph(MerchantState)
  .addNode('agent', merchantAgentNode)
  .addEdge('__start__', 'agent')
  .addConditionalEdges('agent', shouldContinue, {
    agent: 'agent',
    __end__: '__end__',
  })
  .compile()
