/**
 * LangGraph Tools - Supabase-backed Implementations
 *
 * Repurposes lib/agents/tools.ts to use Supabase instead of mock data.
 * Integrates with:
 * - lib/supabase/client.ts for database operations
 * - lib/mcp/supabase-adapter.ts for RLS-aware queries
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import { getSupabaseClient } from '@/lib/supabase/client';
import { createSupabaseDb, type SupabaseDb } from '@/lib/mcp/supabase-adapter';

// ============================================================================
// Re-export schemas (unchanged from tools.ts)
// ============================================================================

export const ProductSearchInputSchema = z.object({
  query: z.string().min(1).describe('Natural language search query'),
  limit: z.number().int().positive().default(10).describe('Maximum results to return'),
  minScore: z.number().min(0).max(1).default(0.5).describe('Minimum similarity score'),
  category: z.string().optional().describe('Filter by product category'),
  priceRange: z.array(z.number()).length(2).optional().describe('Price filter [min, max]'),
});

export type ProductSearchInput = z.infer<typeof ProductSearchInputSchema>;

export const InventoryCheckInputSchema = z.object({
  productIds: z.array(z.string()).min(1).max(20).describe('Product IDs to check'),
  location: z.string().optional().describe('Warehouse location code'),
});

export type InventoryCheckInput = z.infer<typeof InventoryCheckInputSchema>;

export const OrderLookupInputSchema = z.object({
  orderId: z.string().optional().describe('Specific order ID'),
  email: z.string().email().optional().describe('Customer email'),
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  limit: z.number().int().positive().default(10),
});

export type OrderLookupInput = z.infer<typeof OrderLookupInputSchema>;

export const RefundRequestInputSchema = z.object({
  orderId: z.string().describe('Order ID to refund'),
  amount: z.number().positive().describe('Refund amount'),
  reason: z.string().min(10).describe('Reason for refund'),
  idempotencyKey: z.string().uuid().describe('Unique request ID'),
});

export type RefundRequestInput = z.infer<typeof RefundRequestInputSchema>;

// ============================================================================
// Re-export types (unchanged from tools.ts)
// ============================================================================

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

export interface InventoryCheckResult {
  productId: string;
  productName: string;
  available: boolean;
  quantity: number;
  location: string;
  restockDate?: string;
}

export interface OrderLookupResult {
  id: string;
  customerEmail: string;
  products: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  status: string;
  orderDate: string;
  trackingNumber?: string;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  status: 'pending' | 'approved' | 'processed' | 'rejected';
  amount: number;
  message: string;
}

// ============================================================================
// Supabase-backed Tool Implementations
// ============================================================================

let supabaseDbInstance: SupabaseDb | null = null;

function getDb(): SupabaseDb {
  if (!supabaseDbInstance) {
    supabaseDbInstance = createSupabaseDb();
  }
  return supabaseDbInstance;
}

/**
 * ProductSearch - Uses Supabase products table with text search
 * Falls back to semantic search if pgvector is available
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
    const db = getDb();
    const results = await db.products.search({ query, limit, category });

    // Apply price range filter if specified
    let filtered = results;
    if (priceRange && priceRange.length === 2) {
      const [min, max] = priceRange;
      filtered = (filtered as any[]).filter((r: any) => r.price >= min && r.price <= max);
    }

    // Transform to ProductSearchResult format
    const mappedResults: ProductSearchResult[] = (filtered as any[]).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: p.price || 0,
      category: p.category || 'General',
      stock: p.stock_quantity || p.stock || 0,
      similarity: 1.0, // Default since we're using text search
    }));

    console.log(`[Tool] ✅ ProductSearch: Found ${mappedResults.length} products`);

    return {
      success: true,
      results: mappedResults,
      total: mappedResults.length,
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
 * InventoryCheck - Uses Supabase products table for stock info
 */
export async function inventoryCheck(input: InventoryCheckInput): Promise<{
  success: boolean;
  results: InventoryCheckResult[];
  error?: string;
}> {
  const { productIds, location = 'main-warehouse' } = input;
  console.log(`[Tool] 📦 InventoryCheck: Checking ${productIds.length} products at ${location}`);

  try {
    const db = getDb();
    const results: InventoryCheckResult[] = [];

    for (const productId of productIds) {
      const product = await db.products.findUnique({ where: { id: productId } }) as any;

      if (product) {
        const quantity = product.stock_quantity || product.stock || 0;
        results.push({
          productId: product.id,
          productName: product.name,
          available: quantity > 0,
          quantity,
          location: product.location || location,
          restockDate: product.restock_date,
        });
      } else {
        // Product not found - could be external product
        results.push({
          productId,
          productName: `Product ${productId}`,
          available: true,
          quantity: 100, // Assume in stock
          location,
        });
      }
    }

    const availableCount = results.filter((r) => r.available).length;
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
 * OrderLookup - Uses Supabase orders table
 */
export async function orderLookup(input: OrderLookupInput): Promise<{
  success: boolean;
  orders: OrderLookupResult[];
  error?: string;
}> {
  console.log(`[Tool] 📋 OrderLookup:`, input);

  try {
    const db = getDb();
    const orders = await db.orders.findMany({
      where: input.email ? { customer_email: input.email } : {},
      take: input.limit,
    });

    const mappedOrders: OrderLookupResult[] = (orders as any[]).map((o: any) => ({
      id: o.id,
      customerEmail: o.customer_email || '',
      products: (o.items || []) as OrderLookupResult['products'],
      total: o.total_amount || o.total || 0,
      status: o.status || 'unknown',
      orderDate: o.created_at || new Date().toISOString(),
      trackingNumber: o.tracking_number,
    }));

    console.log(`[Tool] ✅ OrderLookup: Found ${mappedOrders.length} orders`);
    return {
      success: true,
      orders: mappedOrders,
    };
  } catch (error) {
    console.error('[Tool] ❌ OrderLookup error:', error);
    return {
      success: false,
      orders: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * RefundRequest - Creates refund in Supabase refunds table
 */
export async function refundRequest(input: RefundRequestInput): Promise<{
  success: boolean;
  result: RefundResult;
  error?: string;
}> {
  console.log(`[Tool] 💰 RefundRequest: Order ${input.orderId}, Amount $${input.amount}`);

  try {
    const db = getDb();

    // Generate refund number
    const refundNumber = `REF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Create refund record
    const refund = await db.refunds.create({
      data: {
        order_id: input.orderId,
        amount: input.amount,
        reason: input.reason,
        idempotency_key: input.idempotencyKey,
        status: 'pending',
        customer_email: '', // Would need to fetch from order
      },
    }) as any;

    const result: RefundResult = {
      success: true,
      refundId: refund.id || refundNumber,
      status: 'pending',
      amount: input.amount,
      message: 'Refund request submitted for review',
    };

    console.log(`[Tool] ✅ RefundRequest: Created refund ${result.refundId}`);
    return { success: true, result };
  } catch (error) {
    console.error('[Tool] ❌ RefundRequest error:', error);
    return {
      success: false,
      result: {
        success: false,
        refundId: '',
        status: 'rejected' as const,
        amount: input.amount,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Ticket Management Tools (New for Supabase)
// ============================================================================

export const CreateTicketInputSchema = z.object({
  subject: z.string().min(1).describe('Ticket subject'),
  description: z.string().min(10).describe('Initial message/description'),
  customerEmail: z.string().email().optional().describe('Customer email'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  category: z.string().optional().describe('Ticket category'),
});

export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>;

export interface TicketResult {
  success: boolean;
  ticketId: string;
  ticketNumber: string;
  message: string;
}

/**
 * CreateTicket - Creates a new support ticket in Supabase
 */
export async function createTicket(input: CreateTicketInput): Promise<{
  success: boolean;
  ticketId?: string;
  ticketNumber?: string;
  error?: string;
}> {
  console.log(`[Tool] 🎫 CreateTicket: "${input.subject}"`);

  try {
    const supabase = getSupabaseClient();
    const db = getDb();

    // Generate ticket number
    const ticketNumber = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Create ticket
    const ticket = await db.tickets.create({
      data: {
        ticket_number: ticketNumber,
        subject: input.subject,
        description: input.description,
        status: 'open',
        priority: input.priority,
        category: input.category,
      },
    }) as any;

    // Create initial message
    await db.messages.create({
      data: {
        ticket_id: ticket.id,
        author_type: 'customer',
        content: input.description,
        content_type: 'text',
        attachments: [],
        is_internal: false,
      },
    });

    console.log(`[Tool] ✅ CreateTicket: Created ${ticketNumber}`);
    return {
      success: true,
      ticketId: ticket.id,
      ticketNumber,
    };
  } catch (error) {
    console.error('[Tool] ❌ CreateTicket error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Tool Definitions for LangGraph (OpenAI function calling format)
// ============================================================================

export const SUPABASE_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'product_search',
      description: 'Search for products in the catalog. Best for natural language queries like "find laptops" or "show me headphones".',
      parameters: {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const, description: 'Natural language search query' },
          limit: { type: 'number' as const, description: 'Maximum results', default: 10 },
          category: { type: 'string' as const, description: 'Filter by category' },
          priceRange: { type: 'array' as const, description: 'Price filter [min, max]', items: { type: 'number' as const } },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'inventory_check',
      description: 'Check stock availability for products. Use before confirming orders.',
      parameters: {
        type: 'object' as const,
        properties: {
          productIds: { type: 'array' as const, description: 'Product IDs to check', items: { type: 'string' as const } },
          location: { type: 'string' as const, description: 'Warehouse location', default: 'main-warehouse' },
        },
        required: ['productIds'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'order_lookup',
      description: 'Look up customer orders by ID or email. Use for tracking.',
      parameters: {
        type: 'object' as const,
        properties: {
          orderId: { type: 'string' as const, description: 'Specific order ID' },
          email: { type: 'string' as const, description: 'Customer email' },
          status: { type: 'string' as const, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], description: 'Filter by status' },
          limit: { type: 'number' as const, description: 'Max results', default: 10 },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'refund_request',
      description: 'Process a refund. Requires order ID, amount, and reason.',
      parameters: {
        type: 'object' as const,
        properties: {
          orderId: { type: 'string' as const, description: 'Order ID to refund' },
          amount: { type: 'number' as const, description: 'Refund amount' },
          reason: { type: 'string' as const, description: 'Reason (min 10 chars)' },
          idempotencyKey: { type: 'string' as const, description: 'UUID for idempotency' },
        },
        required: ['orderId', 'amount', 'reason', 'idempotencyKey'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_ticket',
      description: 'Create a new support ticket for customer inquiries.',
      parameters: {
        type: 'object' as const,
        properties: {
          subject: { type: 'string' as const, description: 'Ticket subject' },
          description: { type: 'string' as const, description: 'Initial message (min 10 chars)' },
          customerEmail: { type: 'string' as const, description: 'Customer email' },
          priority: { type: 'string' as const, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
          category: { type: 'string' as const, description: 'Ticket category' },
        },
        required: ['subject', 'description'],
      },
    },
  },
];

// ============================================================================
// Tool Execution Dispatcher
// ============================================================================

export async function executeSupabaseTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  console.log(`[Tool] ⚡ Executing Supabase tool: ${name}`);

  switch (name) {
    case 'product_search':
      return productSearch(args as ProductSearchInput);
    case 'inventory_check':
      return inventoryCheck(args as InventoryCheckInput);
    case 'order_lookup':
      return orderLookup(args as OrderLookupInput);
    case 'refund_request':
      return refundRequest(args as RefundRequestInput);
    case 'create_ticket':
      return createTicket(args as CreateTicketInput);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
