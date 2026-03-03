/**
 * MCP Adapter for Existing Tools
 *
 * Wraps existing tool functions (db_query, serp_search, vector_search)
 * as MCP-compatible tools with standardized interfaces.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type { Tool, ToolResult } from './types.js';
import { createTool } from './server.js';

// ============================================================================
// Existing Tool Signatures (from lib/agents/tool.ts)
// ============================================================================

/**
 * Database query types
 */
type QueryType = 'orders' | 'products' | 'customers' | 'tickets';

/**
 * Database query parameters
 */
interface DbQueryParams {
  queryType: QueryType;
  params: Record<string, unknown>;
}

/**
 * Web search result
 */
interface SerpResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  count: number;
}

/**
 * Vector search result
 */
interface VectorResult {
  query: string;
  user_id?: string;
  embeddings: Array<{
    id: string;
    category: string;
    similarity: number;
    recent_purchases: string[];
  }>;
  count: number;
}

// ============================================================================
// Real Database Connection using Prisma
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mock database for testing (fallback)
const mockDb = {
  orders: {
    findUnique: async (args: { where: { id: string } }) => {
      return {
        id: args.where.id,
        orderNumber: `ORD-${args.where.id}`,
        status: 'delivered',
        total: 99.99,
        createdAt: new Date().toISOString(),
        items: [{ name: 'Product A', qty: 2, price: 49.99 }],
      };
    },
    findMany: async (args: { where: Record<string, unknown>; take: number }) => {
      return [{
        id: 'ORD-001',
        status: 'delivered',
        total: 99.99,
      }].slice(0, args.take);
    },
  },
  products: {
    findUnique: async (args: { where: { id: string } }) => {
      return {
        id: args.where.id,
        name: 'Sample Product',
        price: 29.99,
        category: 'Electronics',
        rating: 4.5,
        stock: 150,
      };
    },
    findMany: async (args: { where: Record<string, unknown>; take: number }) => {
      return [{
        id: 'PROD-001',
        name: 'Sample Product',
        price: 29.99,
        category: 'Electronics',
      }].slice(0, args.take);
    },
  },
  customers: {
    findUnique: async (args: { where: { id: string } }) => {
      return {
        id: args.where.id,
        email: 'customer@example.com',
        name: 'John Doe',
        totalOrders: 5,
        lifetimeValue: 499.95,
      };
    },
  },
  tickets: {
    findUnique: async (args: { where: { id: string } }) => {
      return {
        id: args.where.id,
        subject: 'Order Inquiry',
        status: 'open',
        priority: 'medium',
        createdAt: new Date().toISOString(),
      };
    },
    findMany: async (args: { where: Record<string, unknown> }) => {
      return [{
        id: 'TICKET-001',
        subject: 'Order Inquiry',
        status: 'open',
        priority: 'medium',
      }];
    },
  },
};

const realDb = {
  orders: {
    findUnique: async (args: { where: { id: string } }) => {
      try {
        const order = await prisma.order.findUnique({
          where: { id: parseInt(args.where.id) },
          include: { customer: true, product: true },
        });
        return order;
      } catch (error) {
        console.error('[DB] Error fetching order:', error);
        return null;
      }
    },
    findMany: async (args: { where: Record<string, unknown>; take: number }) => {
      try {
        return await prisma.order.findMany({
          where: args.where as any,
          take: args.take,
          include: { customer: true, product: true },
          orderBy: { orderDate: 'desc' },
        });
      } catch (error) {
        console.error('[DB] Error fetching orders:', error);
        return [];
      }
    },
  },
  products: {
    findUnique: async (args: { where: { id: string } }) => {
      try {
        return await prisma.product.findUnique({
          where: { id: parseInt(args.where.id) },
        });
      } catch (error) {
        console.error('[DB] Error fetching product:', error);
        return null;
      }
    },
    findMany: async (args: { where: Record<string, unknown>; take: number }) => {
      try {
        return await prisma.product.findMany({
          where: args.where as any,
          take: args.take,
        });
      } catch (error) {
        console.error('[DB] Error fetching products:', error);
        return [];
      }
    },
  },
  customers: {
    findUnique: async (args: { where: { id: string } }) => {
      try {
        return await prisma.customer.findUnique({
          where: { id: parseInt(args.where.id) },
        });
      } catch (error) {
        console.error('[DB] Error fetching customer:', error);
        return null;
      }
    },
  },
  tickets: {
    findUnique: async (args: { where: { id: string } }) => {
      try {
        return await prisma.supportTicket.findUnique({
          where: { id: parseInt(args.where.id) },
          include: { customer: true },
        });
      } catch (error) {
        console.error('[DB] Error fetching ticket:', error);
        return null;
      }
    },
    findMany: async (args: { where: Record<string, unknown> }) => {
      try {
        return await prisma.supportTicket.findMany({
          where: args.where as any,
          include: { customer: true },
          orderBy: { createdAt: 'desc' },
        });
      } catch (error) {
        console.error('[DB] Error fetching tickets:', error);
        return [];
      }
    },
  },
};

// Use real database by default
const USE_MOCK_DB = process.env.USE_MOCK_DB === 'true';
const db = USE_MOCK_DB ? mockDb : realDb;
console.log(`[MCP] Database: ${USE_MOCK_DB ? 'MOCK' : 'REAL (Prisma)'}`);

// ============================================================================
// Tool Adapter Functions (wrappers around existing tools)
// ============================================================================

/**
 * Adapter for database query tool
 */
async function executeDbQueryAdapter(
  params: DbQueryParams,
  _userId: string | null
): Promise<ToolResult> {
  const { queryType, params: queryParams } = params;
  const startTime = Date.now();

  try {
    let results: unknown;

    switch (queryType) {
      case 'orders':
        if (queryParams.order_id) {
          results = await db.orders.findUnique({
            where: { id: String(queryParams.order_id) },
          });
        } else {
          results = await db.orders.findMany({
            where: { status: queryParams.status },
            take: Number(queryParams.limit) || 20,
          });
        }
        break;

      case 'products':
        if (queryParams.product_id) {
          results = await db.products.findUnique({
            where: { id: String(queryParams.product_id) },
          });
        } else {
          results = await db.products.findMany({
            where: {
              category: queryParams.category,
              price: queryParams.maxPrice
                ? { lte: Number(queryParams.maxPrice) }
                : undefined,
            },
            take: Number(queryParams.limit) || 10,
          });
        }
        break;

      case 'customers':
        results = await db.customers.findUnique({
          where: { id: String(queryParams.customer_id) },
        });
        break;

      case 'tickets':
        if (queryParams.ticket_id) {
          results = await db.tickets.findUnique({
            where: { id: String(queryParams.ticket_id) },
          });
        } else {
          results = await db.tickets.findMany({
            where: { status: queryParams.status },
          });
        }
        break;
    }

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: results,
      metadata: {
        executionTime,
        cached: false,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Adapter for web search tool
 */
async function executeSerpSearchAdapter(
  query: string,
  _userId: string | null
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    // Simulated web search results
    const results: SerpResult = {
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

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: results,
      metadata: { executionTime },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Adapter for vector search tool
 */
async function executeVectorSearchAdapter(
  query: string,
  userId: string | null
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const results: VectorResult = {
      query,
      user_id: userId ?? undefined,
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

    const executionTime = Date.now() - startTime;

    return {
      success: true,
      data: results,
      metadata: { executionTime },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// MCP Tool Definitions
// ============================================================================

/**
 * Input schema for db_query tool
 */
const DbQueryInputSchema = z.object({
  queryType: z.enum(['orders', 'products', 'customers', 'tickets']).describe('Type of database query'),
  orderId: z.string().optional(),
  productId: z.string().optional(),
  customerId: z.string().optional(),
  ticketId: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  maxPrice: z.number().optional(),
  limit: z.number().int().positive().max(100).default(20),
});

/**
 * Input schema for serp_search tool
 */
const SerpSearchInputSchema = z.object({
  query: z.string().min(1).describe('Search query for web search'),
});

/**
 * Input schema for vector_search tool
 */
const VectorSearchInputSchema = z.object({
  query: z.string().min(1).describe('Query for semantic search'),
});

// ============================================================================
// Create MCP-Compatible Tools
// ============================================================================

/**
 * Database query tool adapted for MCP
 */
export const dbQueryTool: Tool = createTool('db_query', {
  title: 'Database Query',
  description: 'Query database for orders, products, customers, or support tickets. Use for looking up specific records.',
  parameters: DbQueryInputSchema,
  requireUserId: true,
  execute: async (args, userId) => {
    const params: DbQueryParams = {
      queryType: args.queryType,
      params: {
        order_id: args.orderId,
        product_id: args.productId,
        customer_id: args.customerId,
        ticket_id: args.ticketId,
        status: args.status,
        category: args.category,
        maxPrice: args.maxPrice,
        limit: args.limit,
      },
    };
    return executeDbQueryAdapter(params, userId);
  },
});

/**
 * Web search tool adapted for MCP
 */
export const serpSearchTool: Tool = createTool('serp_search', {
  title: 'Web Search',
  description: 'Search the web for external information like policies, FAQs, or general knowledge.',
  parameters: SerpSearchInputSchema,
  requireUserId: false,
  execute: async (args, userId) => {
    return executeSerpSearchAdapter(args.query, userId);
  },
});

/**
 * Vector search tool adapted for MCP
 */
export const vectorSearchTool: Tool = createTool('vector_search', {
  title: 'Semantic Search',
  description: 'Perform semantic search on user preferences and purchase history for personalized recommendations.',
  parameters: VectorSearchInputSchema,
  requireUserId: true,
  execute: async (args, userId) => {
    return executeVectorSearchAdapter(args.query, userId);
  },
});

/**
 * All existing tools adapted for MCP
 */
export const legacyTools: Tool[] = [
  dbQueryTool,
  serpSearchTool,
  vectorSearchTool,
];

// ============================================================================
// Tool Registration Helper
// ============================================================================

/**
 * Register all legacy tools with an MCP server
 */
export function registerLegacyTools(server: {
  registerTool: (name: string, tool: Tool) => void;
}): void {
  for (const tool of legacyTools) {
    server.registerTool(tool.name, tool);
  }
}

// ============================================================================
// Combined Search Tool (hybrid)
// ============================================================================

/**
 * Combined search tool that runs all three searches
 */
export const hybridSearchTool: Tool = createTool('hybrid_search', {
  title: 'Hybrid Search',
  description: 'Run database query, web search, and semantic search simultaneously for comprehensive results.',
  parameters: z.object({
    dbQueryType: z.enum(['orders', 'products', 'customers', 'tickets']).optional(),
    dbQueryParams: z.record(z.string(), z.unknown()).optional(),
    webQuery: z.string().optional(),
    semanticQuery: z.string().optional(),
  }),
  requireUserId: true,
  execute: async (args, userId) => {
    const startTime = Date.now();
    const results: Record<string, unknown> = {};
    const errors: string[] = [];

    // Run searches in parallel
    const searches: Promise<{ key: string; result: ToolResult }>[] = [];

    if (args.dbQueryType && args.dbQueryParams) {
      searches.push(
        executeDbQueryAdapter(
          { queryType: args.dbQueryType, params: args.dbQueryParams as Record<string, unknown> },
          userId
        ).then((result) => ({ key: 'database', result }))
      );
    }

    if (args.webQuery) {
      searches.push(
        executeSerpSearchAdapter(args.webQuery, userId).then((result) => ({
          key: 'web',
          result,
        }))
      );
    }

    if (args.semanticQuery) {
      searches.push(
        executeVectorSearchAdapter(args.semanticQuery, userId).then((result) => ({
          key: 'semantic',
          result,
        }))
      );
    }

    const searchResults = await Promise.all(searches);

    for (const { key, result } of searchResults) {
      if (result.success) {
        results[key] = result.data;
      } else {
        errors.push(`${key}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      data: {
        results,
        errors: errors.length > 0 ? errors : undefined,
        executionTime: Date.now() - startTime,
      },
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  },
});

// ============================================================================
// Exports
// ============================================================================

export type { DbQueryParams, SerpResult, VectorResult };

/**
 * MCP Tool Result type - exposed for external consumers
 */
export type McPToolResult = ToolResult;

/**
 * Creates an MCP client for tool execution.
 * Provides a simple interface for calling tools without direct MCP protocol knowledge.
 */
export function createMcPClient() {
  const tools: Record<string, Tool> = {};

  // Register all legacy tools
  for (const tool of legacyTools) {
    tools[tool.name] = tool;
  }
  // Register hybrid search
  tools[hybridSearchTool.name] = hybridSearchTool;

  return {
    /**
     * Call a tool by name with arguments and optional user ID.
     */
    callTool: async (name: string, args: Record<string, unknown>, userId?: string): Promise<ToolResult> => {
      const tool = tools[name];
      if (!tool) {
        return {
          success: false,
          error: `Tool '${name}' not found`,
        };
      }
      return tool.execute(args, userId);
    },

    /**
     * Get list of available tools
     */
    listTools: (): string[] => Object.keys(tools),

    /**
     * Get tool definition by name
     */
    getTool: (name: string): Tool | undefined => tools[name],
  };
}

/**
 * Type for MCP client instances
 */
export type McPClient = ReturnType<typeof createMcPClient>;
