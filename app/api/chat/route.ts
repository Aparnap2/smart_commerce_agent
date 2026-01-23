/**
 * Chat API Route - Using OpenAI SDK with Ollama + MCP Tools (Prisma)
 *
 * This route integrates with the existing MCP infrastructure in lib/mcp/
 * for database access via Prisma ORM.
 *
 * @file route.ts
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { env } from '../../../lib/env.js';

// Initialize Prisma client for database access
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Initialize OpenAI client with Ollama's OpenAI-compatible endpoint
const ollamaClient = new OpenAI({
  baseURL: `${env.OLLAMA_BASE_URL}/v1`,
  apiKey: 'ollama',
  dangerouslyAllowBrowser: false,
});

// ============================================================================
// MCP-STYLE TOOL DEFINITIONS (Integrated from lib/mcp/tools.ts)
// ============================================================================

/**
 * Tool result interface matching MCP types
 */
interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    cached?: boolean;
  };
}

/**
 * Database query types
 */
type QueryType = 'orders' | 'products' | 'customers' | 'tickets';

/**
 * Execute database query via Prisma (MCP-style tool)
 */
async function executeDbQueryTool(
  queryType: QueryType,
  userEmail: string | null
): Promise<ToolResult> {
  const startTime = Date.now();
  console.log(`[MCP_TOOL] 🔧 Executing db_query: ${queryType} for ${userEmail ?? 'anonymous'}`);

  try {
    let result: unknown;

    switch (queryType) {
      case 'orders': {
        if (!userEmail) {
          throw new Error('Email required for order lookup');
        }
        const orders = await prisma.order.findMany({
          where: {
            customer: { email: userEmail },
          },
          include: {
            customer: true,
            product: true,
          },
          orderBy: { orderDate: 'desc' },
          take: 10,
        });

        result = {
          type: 'orders',
          data: orders.map((o) => ({
            id: o.id,
            product: o.product.name,
            price: `$${parseFloat(String(o.product.price)).toFixed(2)}`,
            quantity: o.quantity,
            status: o.status,
            orderDate: o.orderDate.toLocaleDateString(),
            tracking: o.trackingNumber || 'N/A',
            customerEmail: o.customer.email,
          })),
          summary: `📦 Found ${orders.length} order(s)`,
        };
        break;
      }

      case 'products': {
        const products = await prisma.product.findMany({
          orderBy: { name: 'asc' },
          take: 20,
        });

        result = {
          type: 'products',
          data: products.map((p) => ({
            id: p.id,
            name: p.name,
            price: `$${parseFloat(String(p.price)).toFixed(2)}`,
            stock: p.stock,
            category: p.category || 'General',
          })),
          summary: `🛍️ Found ${products.length} product(s)`,
        };
        break;
      }

      case 'tickets': {
        if (!userEmail) {
          throw new Error('Email required for ticket lookup');
        }
        const tickets = await prisma.supportTicket.findMany({
          where: {
            customer: { email: userEmail },
          },
          include: { customer: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        result = {
          type: 'tickets',
          data: tickets.map((t) => ({
            id: t.id,
            issue: t.issue,
            status: t.status,
            priority: t.priority,
            createdAt: t.createdAt.toLocaleDateString(),
            relatedOrder: t.relatedOrderId || 'N/A',
          })),
          summary: `🎫 Found ${tickets.length} support ticket(s)`,
        };
        break;
      }

      case 'customers': {
        if (!userEmail) {
          throw new Error('Email required for customer lookup');
        }
        const customers = await prisma.customer.findMany({
          where: { email: userEmail },
        });

        result = {
          type: 'customers',
          data: customers.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone || 'N/A',
            totalOrders: 0, // Would need aggregation
          })),
          summary: `👤 Found ${customers.length} customer profile(s)`,
        };
        break;
      }

      default:
        throw new Error(`Unknown query type: ${queryType}`);
    }

    const executionTime = Date.now() - startTime;
    console.log(`[MCP_TOOL] ✅ Success: ${(result as { summary?: string }).summary} (${executionTime}ms)`);

    return {
      success: true,
      data: result,
      metadata: { executionTime, cached: false },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MCP_TOOL] ❌ Error: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Web search tool (MCP-style - simulated for now)
 */
async function executeWebSearchTool(query: string): Promise<ToolResult> {
  const startTime = Date.now();
  console.log(`[MCP_TOOL] 🔧 Executing web_search: "${query.substring(0, 50)}..."`);

  // Simulated web search results
  const results = {
    query,
    results: [
      {
        title: 'E-commerce FAQ',
        url: 'https://example.com/faq',
        snippet: 'Common questions about orders, shipping, and returns.',
      },
      {
        title: 'Return Policy',
        url: 'https://example.com/returns',
        snippet: '30-day return policy for all items in original condition.',
      },
    ],
    count: 2,
  };

  return {
    success: true,
    data: results,
    metadata: { executionTime: Date.now() - startTime },
  };
}

/**
 * Semantic search tool (MCP-style - simulated for now)
 */
async function executeSemanticSearchTool(query: string, userId: string): Promise<ToolResult> {
  const startTime = Date.now();
  console.log(`[MCP_TOOL] 🔧 Executing semantic_search: "${query.substring(0, 50)}..."`);

  const results = {
    query,
    user_id: userId,
    embeddings: [
      {
        id: 'PREF-001',
        category: 'Electronics',
        similarity: 0.92,
        recent_purchases: ['Laptop', 'Headphones'],
      },
      {
        id: 'PREF-002',
        category: 'Books',
        similarity: 0.85,
        recent_purchases: ['Novels', 'Self-help'],
      },
    ],
    count: 2,
  };

  return {
    success: true,
    data: results,
    metadata: { executionTime: Date.now() - startTime },
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(req: Request): Promise<Response> {
  console.log('\n' + '='.repeat(60));
  console.log('[CHAT_API] 🚀 NEW REQUEST (MCP + Prisma)');
  console.log('='.repeat(60));

  try {
    const body = await req.json();
    const { messages } = body as { messages: Array<{ content: string }> };

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request', { status: 400 });
    }

    const lastMsg = messages[messages.length - 1];
    const content = lastMsg?.content || '';
    console.log('[CHAT_API] 💬', content.substring(0, 80));

    // ========================================================================
    // TOOL DETECTION & EXECUTION (MCP Protocol)
    // ========================================================================

    const lowerContent = content.toLowerCase();
    const needsDbQuery = /order|product|ticket|customer|my (orders|products|tickets)|show me|check|find/i.test(lowerContent);
    const needsWebSearch = /policy|faq|return|shipping|help me find/i.test(lowerContent);
    const needsSemanticSearch = /recommend|suggest|similar|like|based on my/i.test(lowerContent);

    console.log('[CHAT_API] 🔍 Tool detection:', {
      dbQuery: needsDbQuery,
      webSearch: needsWebSearch,
      semanticSearch: needsSemanticSearch,
    });

    let toolContext = '';
    let userEmail: string | null = null;
    let userId = 'anonymous';

    // Extract email for database queries
    if (needsDbQuery) {
      const emailMatch = lowerContent.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
      userEmail = emailMatch ? emailMatch[1] : null;
      if (userEmail) {
        userId = userEmail; // Use email as user ID for MCP tools
      }
    }

    // Execute MCP tools in parallel where possible
    const toolResults: Array<{ name: string; result: ToolResult }> = [];

    if (needsDbQuery) {
      if (!userEmail) {
        toolContext += '\n\n⚠️ **Note**: Please provide your email to access your data.';
        console.log('[CHAT_API] ⚠️ No email - will prompt user');
      } else {
        // Determine query type
        let queryType: QueryType = 'products';
        if (/order/i.test(lowerContent)) queryType = 'orders';
        else if (/ticket|support|help/i.test(lowerContent)) queryType = 'tickets';
        else if (/customer|profile|account/i.test(lowerContent)) queryType = 'customers';

        console.log(`[CHAT_API] 📋 DB query type: ${queryType}`);
        const result = await executeDbQueryTool(queryType, userEmail);
        toolResults.push({ name: 'db_query', result });

        if (result.success && result.data) {
          const data = result.data as { summary: string; data: unknown[] };
          toolContext = `\n\n## 📊 Database Results (${queryType}):\n${data.summary}\n\n` +
            data.data.map((item) => JSON.stringify(item, null, 2)).join('\n');
        } else if (!result.success) {
          toolContext = `\n\n⚠️ Database error: ${result.error}`;
        }
      }
    }

    if (needsWebSearch) {
      // Extract search query from message
      const searchQuery = lowerContent
        .replace(/search|find|look up|what is|how do/i, '')
        .trim();
      const result = await executeWebSearchTool(searchQuery || content);
      toolResults.push({ name: 'web_search', result });

      if (result.success && result.data) {
        const data = result.data as { results: Array<{ title: string; url: string; snippet: string }> };
        toolContext += '\n\n## 🌐 Web Search Results:\n' +
          data.results.map((r) => `- [${r.title}](${r.url}): ${r.snippet}`).join('\n');
      }
    }

    if (needsSemanticSearch) {
      const result = await executeSemanticSearchTool(content, userId);
      toolResults.push({ name: 'semantic_search', result });

      if (result.success && result.data) {
        const data = result.data as { embeddings: Array<{ category: string; similarity: number; recent_purchases: string[] }> };
        toolContext += '\n\n## 🧠 Semantic Search (Preferences):\n' +
          data.embeddings.map((e) =>
            `- Category: ${e.category} (${(e.similarity * 100).toFixed(0)}% match)\n  Recent: ${e.recent_purchases.join(', ')}`
          ).join('\n');
      }
    }

    // Log all executed tools
    console.log('[CHAT_API] 🛠️ Tools executed:', toolResults.map((t) => t.name).join(', '));
    for (const { name, result } of toolResults) {
      console.log(`  - ${name}: ${result.success ? '✅' : '❌'} (${result.metadata?.executionTime ?? 0}ms)`);
    }

    // ========================================================================
    // BUILD SYSTEM PROMPT
    // ========================================================================

    const systemPrompt = `You are TechTrend Support AI.

## Current Date: ${new Date().toISOString().split('T')[0]}

## MCP Tools Available:
- **db_query**: Query database for orders, products, customers, or support tickets
- **web_search**: Search the web for policies, FAQs, and general information
- **semantic_search**: Search user preferences for personalized recommendations

## Guidelines:
- Be helpful and professional
- Use markdown formatting
- For data queries, use the database results provided${toolContext}

## Response Style:
- Use bullet points for lists
- Use tables for structured data
- Be concise but complete
- If you need more information, ask clarifying questions`;

    const chatMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((m) => ({ role: 'user' as const, content: m.content })),
    ];

    console.log('[CHAT_API] 📤 Sending to Ollama:', env.OLLAMA_MODEL);

    // ========================================================================
    // STREAMING RESPONSE
    // ========================================================================

    const stream = await ollamaClient.chat.completions.create({
      model: env.OLLAMA_MODEL,
      messages: chatMessages,
      stream: true,
      temperature: 0.7,
    });

    console.log('[CHAT_API] 📡 Streaming response...\n');

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let chunkCount = 0;

        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            const finishReason = chunk.choices[0]?.finish_reason;

            if (content) {
              chunkCount++;
              const sseData = `data: ${JSON.stringify({
                id: chunk.id,
                object: 'chat.completion.chunk',
                created: chunk.created,
                model: chunk.model,
                choices: [{ index: 0, delta: { content }, finish_reason: null }],
              })}\n\n`;
              controller.enqueue(encoder.encode(sseData));
            }

            if (finishReason) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              console.log(`[CHAT_API] ✅ Complete: ${chunkCount} chunks sent`);
              controller.close();
              return;
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error('[CHAT_API] ❌ Stream error:', message);
          controller.error(new Error(message));
        }
      },
    });

    return new Response(readableStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CHAT_API] 💥 Error:', message);

    return new Response(
      JSON.stringify({ error: true, message }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }
    );
  }
}
