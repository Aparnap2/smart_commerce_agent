/**
 * Chat API Route - Real LLM Function Calling with official OpenAI SDK (Azure)
 * 
 * Intelligently decides between text and Generative UI components.
 *
 * @file app/api/chat/route.ts
 */

import { AzureOpenAI } from 'openai';
import { PrismaClient } from '@prisma/client';
import { env } from '../../../lib/env.js';
import { z } from 'zod';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Initialize OpenAI Client (Priority: Azure -> Ollama)
let client: any;
let isAzure = false;

if (env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_BASE_URL) {
  console.log('[CHAT_API] 🤖 Using Azure OpenAI SDK (gpt-oss-120b)');
  isAzure = true;
  client = new AzureOpenAI({
    apiKey: env.AZURE_OPENAI_API_KEY,
    endpoint: env.AZURE_OPENAI_BASE_URL,
    apiVersion: env.AZURE_OPENAI_API_VERSION,
  });
} else {
  console.log('[CHAT_API] 🤖 Using Ollama OpenAI-compatible endpoint');
  client = new AzureOpenAI({
    apiKey: 'ollama', // Dummy key
    baseURL: `${env.OLLAMA_BASE_URL}/v1`,
    apiVersion: '', // Not needed for Ollama
  });
}

const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_products',
      description: 'Get products from the catalog. Use when users ask about products, recommendations, or want to browse.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by category (e.g., Computers, Audio, Phones)' },
          limit: { type: 'number', default: 10, description: 'Number of products to return' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_orders',
      description: 'Get customer order history. Requires customer email address.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email', description: 'Customer email address' },
        },
        required: ['email'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_to_cart',
      description: 'Add a product to the shopping cart',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID to add' },
          quantity: { type: 'number', default: 1, description: 'Quantity' },
        },
        required: ['productId'],
      },
    },
  },
];

async function executeTool(name: string, args: any) {
  console.log('[TOOL] Executing:', name, args);

  if (name === 'get_products') {
    const { category, limit = 10 } = args;
    const where = category ? { category } : {};
    const products = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) return { message: 'No products found.', products: [] };
    return {
      message: `Found ${products.length} products.`,
      type: 'product_list',
      products: products, // Return full objects for GenUI
    };
  }

  if (name === 'get_orders') {
    const { email } = args;
    const orders = await prisma.order.findMany({
      where: { customer: { email } },
      include: {
        product: true,
        customer: true
      },
      orderBy: { orderDate: 'desc' },
      take: 5,
    });

    if (orders.length === 0) return { message: `No orders for ${email}.`, orders: [] };
    return {
      message: `Found ${orders.length} orders.`,
      type: 'order_history',
      orders: orders, // Return full objects for GenUI
    };
  }

  if (name === 'add_to_cart') {
    return { success: true, message: `Added to cart!`, item: args };
  }

  return { error: 'Unknown tool' };
}

export async function POST(req: Request): Promise<Response> {
  console.log('\n' + '='.repeat(60));
  console.log('[CHAT_API] 🚀 NEW REQUEST - GENUI INTELLIGENCE');
  console.log('='.repeat(60));

  try {
    const { messages } = await req.json();

    const systemPrompt = `You are TechTrend Support Assistant. 
You can fulfill user requests by calling tools.

When the user asks for products or orders:
1. Call the appropriate tool.
2. If the tool returns data, you should decide whether to show a Text summary or a Generative UI component.
3. For product lists with > 1 items, prefer UI. For a single item, use text unless it is a recommendation.
4. For order history, always prefer UI.

After you get tool results, provide a brief, helpful summary in text. The UI component will be injected automatically based on the tool result type.`;

    // Initial completion request
    const response = await client.chat.completions.create({
      model: isAzure ? env.AZURE_OPENAI_DEPLOYMENT : env.OLLAMA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools: tools,
      tool_choice: 'auto',
    });

    let finalResponse = response.choices[0].message;
    const toolCalls = finalResponse.tool_calls;
    let uiPayload: any = null;

    if (toolCalls) {
      console.log('[CHAT_API] 🔧 Tool calls detected:', toolCalls.length);
      const conversationHistory = [
        { role: 'system', content: systemPrompt },
        ...messages,
        finalResponse
      ];

      for (const toolCall of toolCalls) {
        const result = await executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));

        // Capture data for GenUI if applicable
        if (result.type === 'product_list' && result.products.length > 0) {
          uiPayload = { type: 'ProductGrid', props: { products: result.products } };
        } else if (result.type === 'order_history' && result.orders.length > 0) {
          uiPayload = { type: 'OrderList', props: { orders: result.orders } };
        }

        conversationHistory.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        } as any);
      }

      // Second completion with tool results
      const secondResponse = await client.chat.completions.create({
        model: isAzure ? env.AZURE_OPENAI_DEPLOYMENT : env.OLLAMA_MODEL,
        messages: conversationHistory,
      });
      finalResponse = secondResponse.choices[0].message;
    }

    const content = finalResponse.content || 'I have processed your request.';

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const sseData = `data: ${JSON.stringify({
          id: 'chatcmpl-' + Date.now(),
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: isAzure ? env.AZURE_OPENAI_DEPLOYMENT : env.OLLAMA_MODEL,
          choices: [{ index: 0, delta: { content, ui: uiPayload }, finish_reason: 'stop' }],
        })}\n\n`;
        controller.enqueue(encoder.encode(sseData));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[CHAT_API] 💥 Error:', error);
    return new Response(JSON.stringify({ error: true, message: error instanceof Error ? error.message : 'Unknown error' }), { status: 500 });
  }
}
