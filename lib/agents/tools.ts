/**
 * LangGraph Tools for Smart Commerce Agent
 *
 * Defines MCP-style tools for the agent workflow:
 * - ProductSearch: Semantic product search via Qdrant
 * - InventoryCheck: Stock availability via Redis cache
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================
// Tool Input Schemas (Zod validated)
// ============================================

/**
 * Product search input schema
 */
export const ProductSearchInputSchema = z.object({
  query: z.string().min(1).describe('Natural language search query'),
  limit: z.number().int().positive().default(10).describe('Maximum results to return'),
  minScore: z.number().min(0).max(1).default(0.5).describe('Minimum similarity score'),
  category: z.string().optional().describe('Filter by product category'),
  priceRange: z.array(z.number()).length(2).optional().describe('Price filter [min, max]'),
});

export type ProductSearchInput = z.infer<typeof ProductSearchInputSchema>;

/**
 * Inventory check input schema
 */
export const InventoryCheckInputSchema = z.object({
  productIds: z.array(z.string()).min(1).max(20).describe('Product IDs to check'),
  location: z.string().optional().describe('Warehouse location code'),
});

export type InventoryCheckInput = z.infer<typeof InventoryCheckInputSchema>;

/**
 * Order lookup input schema
 */
export const OrderLookupInputSchema = z.object({
  orderId: z.string().optional().describe('Specific order ID'),
  email: z.string().email().optional().describe('Customer email'),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  limit: z.number().int().positive().default(10),
});

export type OrderLookupInput = z.infer<typeof OrderLookupInputSchema>;

/**
 * Refund request input schema
 */
export const RefundRequestInputSchema = z.object({
  orderId: z.string().describe('Order ID to refund'),
  amount: z.number().positive().describe('Refund amount'),
  reason: z.string().min(10).describe('Reason for refund'),
  idempotencyKey: z.string().uuid().describe('Unique request ID'),
});

export type RefundRequestInput = z.infer<typeof RefundRequestInputSchema>;

// ============================================
// Tool Output Types
// ============================================

/**
 * Product search result
 */
export interface ProductSearchResult {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  similarity: number;
  embeddingId?: string;
}

/**
 * Inventory status result
 */
export interface InventoryCheckResult {
  productId: string;
  productName: string;
  available: boolean;
  quantity: number;
  location: string;
  restockDate?: string;
}

/**
 * Order lookup result
 */
export interface OrderLookupResult {
  id: string;
  customerEmail: string;
  products: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: string;
  orderDate: string;
  trackingNumber?: string;
}

/**
 * Refund result
 */
export interface RefundResult {
  success: boolean;
  refundId: string;
  status: 'pending' | 'approved' | 'processed' | 'rejected';
  amount: number;
  message: string;
}

// ============================================
// Tool Implementations
// ============================================

/**
 * Tool A: ProductSearch - Semantic product search via Qdrant
 */
export async function productSearch(input: ProductSearchInput): Promise<{
  success: boolean;
  results: ProductSearchResult[];
  total: number;
  query: string;
  error?: string;
}> {
  const { query, limit = 10, minScore = 0.5, category, priceRange } = input;

  console.log(`[Tool] 🔍 ProductSearch: "${query.substring(0, 50)}..." (limit=${limit})`);

  try {
    // 1. Generate embedding for query using Ollama
    const embedResponse = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: query,
      }),
    });

    if (!embedResponse.ok) {
      throw new Error('Failed to generate embedding');
    }

    const embedData = await embedResponse.json();
    const embedding = embedData.embedding;

    // 2. Search Qdrant for similar products
    const qdrantResponse = await fetch('http://localhost:6333/collections/products/points/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.QDRANT_API_KEY && { 'Authorization': `Bearer ${process.env.QDRANT_API_KEY}` }),
      },
      body: JSON.stringify({
        query: embedding,
        limit,
        score_threshold: minScore,
        with_payload: true,
      }),
    });

    if (!qdrantResponse.ok) {
      throw new Error('Qdrant search failed');
    }

    const qdrantData = await qdrantResponse.json();

    // 3. Process results
    let results: ProductSearchResult[] = qdrantData.result?.points?.map((point: any) => ({
      id: point.id,
      name: point.payload?.name || 'Unknown',
      description: point.payload?.description || '',
      price: point.payload?.price || 0,
      category: point.payload?.category || 'General',
      stock: point.payload?.stock || 0,
      similarity: point.score,
      embeddingId: point.id,
    })) || [];

    // 4. Apply category filter if specified
    if (category) {
      results = results.filter(r => r.category.toLowerCase() === category.toLowerCase());
    }

    // 5. Apply price range filter if specified
    if (priceRange && priceRange.length === 2) {
      const [min, max] = priceRange;
      results = results.filter(r => r.price >= min && r.price <= max);
    }

    console.log(`[Tool] ✅ ProductSearch: Found ${results.length} products`);

    return {
      success: true,
      results,
      total: results.length,
      query,
    };
  } catch (error) {
    console.error('[Tool] ❌ ProductSearch error:', error);
    return {
      success: false,
      results: [],
      total: 0,
      query,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Tool B: InventoryCheck - Stock availability via Redis cache
 */
export async function inventoryCheck(input: InventoryCheckInput): Promise<{
  success: boolean;
  results: InventoryCheckResult[];
  error?: string;
}> {
  const { productIds, location = 'main-warehouse' } = input;

  console.log(`[Tool] 📦 InventoryCheck: Checking ${productIds.length} products at ${location}`);

  try {
    const results: InventoryCheckResult[] = [];

    // Check each product in Redis cache
    for (const productId of productIds) {
      // Simulated inventory lookup with Redis
      // In production, this would query Redis for cached inventory
      const redisKey = `inventory:${productId}`;
      const redisValue = await redisGet(redisKey);

      if (redisValue) {
        const inventory = JSON.parse(redisValue);
        results.push({
          productId: inventory.productId,
          productName: inventory.productName,
          available: inventory.quantity > 0,
          quantity: inventory.quantity,
          location: inventory.location || location,
          restockDate: inventory.restockDate,
        });
      } else {
        // Fallback: mock data for demo
        const mockQuantity = Math.floor(Math.random() * 100);
        results.push({
          productId,
          productName: `Product ${productId}`,
          available: mockQuantity > 0,
          quantity: mockQuantity,
          location,
        });
      }
    }

    const availableCount = results.filter(r => r.available).length;
    console.log(`[Tool] ✅ InventoryCheck: ${availableCount}/${results.length} in stock`);

    return {
      success: true,
      results,
    };
  } catch (error) {
    console.error('[Tool] ❌ InventoryCheck error:', error);
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Redis get helper
 */
async function redisGet(key: string): Promise<string | null> {
  try {
    const response = await fetch('http://localhost:6379', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['GET', key]),
    });
    const data = await response.json();
    return data[0] || null;
  } catch {
    return null;
  }
}

/**
 * Order lookup tool
 */
export async function orderLookup(input: OrderLookupInput): Promise<{
  success: boolean;
  orders: OrderLookupResult[];
  error?: string;
}> {
  console.log(`[Tool] 📋 OrderLookup:`, input);

  // Simulated order lookup (would use Prisma in production)
  const mockOrders: OrderLookupResult[] = [
    {
      id: 'ORD-001',
      customerEmail: input.email || 'customer@example.com',
      products: [
        { name: 'Laptop Pro 15', quantity: 1, price: 1299.99 },
        { name: 'Wireless Mouse', quantity: 2, price: 49.99 },
      ],
      total: 1399.97,
      status: 'shipped',
      orderDate: '2026-01-25',
      trackingNumber: 'TRK-123456',
    },
    {
      id: 'ORD-002',
      customerEmail: input.email || 'customer@example.com',
      products: [
        { name: 'USB-C Hub', quantity: 1, price: 79.99 },
      ],
      total: 79.99,
      status: 'processing',
      orderDate: '2026-01-27',
    },
  ];

  return {
    success: true,
    orders: mockOrders,
  };
}

/**
 * Refund request tool
 */
export async function refundRequest(input: RefundRequestInput): Promise<{
  success: boolean;
  result: RefundResult;
}> {
  console.log(`[Tool] 💰 RefundRequest: Order ${input.orderId}, Amount $${input.amount}`);

  // Simulated refund processing
  const result: RefundResult = {
    success: true,
    refundId: `REF-${Date.now()}`,
    status: 'pending',
    amount: input.amount,
    message: 'Refund request submitted for review',
  };

  return {
    success: true,
    result,
  };
}

// ============================================
// Tool Definitions for LangGraph
// ============================================

/**
 * LangGraph tool definitions (OpenAI function calling format)
 */
export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'product_search',
      description: 'Search for products using semantic similarity. Best for natural language queries like "find laptops for programming" or "show me affordable headphones".',
      parameters: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string' as const,
            description: 'Natural language search query',
          },
          limit: {
            type: 'number' as const,
            description: 'Maximum results to return',
            default: 10,
          },
          minScore: {
            type: 'number' as const,
            description: 'Minimum similarity score (0-1)',
            default: 0.5,
          },
          category: {
            type: 'string' as const,
            description: 'Filter by product category',
          },
          priceRange: {
            type: 'array' as const,
            description: 'Price filter [min, max]',
            items: { type: 'number' as const },
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'inventory_check',
      description: 'Check stock availability for specific products. Use to verify items are in stock before confirming orders.',
      parameters: {
        type: 'object' as const,
        properties: {
          productIds: {
            type: 'array' as const,
            description: 'Product IDs to check',
            items: { type: 'string' as const },
          },
          location: {
            type: 'string' as const,
            description: 'Warehouse location code',
            default: 'main-warehouse',
          },
        },
        required: ['productIds'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'order_lookup',
      description: 'Look up customer orders by order ID, email, or status. Use for tracking and order-related queries.',
      parameters: {
        type: 'object' as const,
        properties: {
          orderId: { type: 'string' as const, description: 'Specific order ID' },
          email: { type: 'string' as const, description: 'Customer email' },
          status: {
            type: 'string' as const,
            enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
            description: 'Order status filter',
          },
          limit: { type: 'number' as const, description: 'Maximum results', default: 10 },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'refund_request',
      description: 'Process a refund request. Requires order ID, amount, and reason. Always confirm with user before processing.',
      parameters: {
        type: 'object' as const,
        properties: {
          orderId: { type: 'string' as const, description: 'Order ID to refund' },
          amount: { type: 'number' as const, description: 'Refund amount' },
          reason: { type: 'string' as const, description: 'Reason for refund (min 10 chars)' },
          idempotencyKey: { type: 'string' as const, description: 'UUID for idempotency' },
        },
        required: ['orderId', 'amount', 'reason', 'idempotencyKey'],
      },
    },
  },
];

/**
 * Tool execution dispatcher
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  console.log(`[Tool] ⚡ Executing: ${name}`);

  switch (name) {
    case 'product_search':
      return productSearch(args as ProductSearchInput);

    case 'inventory_check':
      return inventoryCheck(args as InventoryCheckInput);

    case 'order_lookup':
      return orderLookup(args as OrderLookupInput);

    case 'refund_request':
      return refundRequest(args as RefundRequestInput);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
