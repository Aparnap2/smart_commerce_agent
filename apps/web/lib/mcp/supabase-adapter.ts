/**
 * Supabase MCP Adapter
 *
 * Repurposes existing MCP tools to use Supabase instead of Prisma.
 * Leverages Supabase for:
 * - Database operations (via PostgREST API)
 * - Realtime subscriptions
 * - Auth integration (RLS policies apply automatically)
 *
 * Compatible with:
 * - lib/mcp/tools.ts - Secure tools factory
 * - lib/agents/tools.ts - LangGraph tools
 * - lib/agents/supervisor.ts - LangGraph supervisor agent
 */

import { getSupabaseClient, type SupabaseClient } from '@/lib/supabase/client';

// ============================================================================
// Supabase-backed Database Operations
// ============================================================================

export interface SupabaseDb {
  client: SupabaseClient;

  // Orders
  orders: {
    findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
    findMany: (args: { where?: Record<string, unknown>; take?: number; skip?: number; orderBy?: Record<string, 'asc' | 'desc'> }) => Promise<unknown[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };

  // Products
  products: {
    findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
    findMany: (args: { where?: Record<string, unknown>; take?: number; category?: string }) => Promise<unknown[]>;
    search: (args: { query: string; limit?: number; category?: string }) => Promise<unknown[]>;
  };

  // Customers
  customers: {
    findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
    findMany: (args: { where?: { organization_id?: string }; take?: number }) => Promise<unknown[]>;
    findByEmail: (args: { email: string }) => Promise<unknown | null>;
  };

  // Tickets
  tickets: {
    findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
    findMany: (args: { where?: { customer_id?: string; organization_id?: string }; take?: number }) => Promise<unknown[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };

  // Messages
  messages: {
    findMany: (args: { where: { ticket_id: string }; orderBy?: Record<string, 'asc' | 'desc'> }) => Promise<unknown[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };

  // Refunds
  refunds: {
    findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
    findMany: (args: { where?: { customer_email?: string }; take?: number }) => Promise<unknown[]>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };

  // Organizations (multi-tenancy)
  organizations: {
    findUnique: (args: { where: { id: string } }) => Promise<unknown | null>;
    findBySlug: (args: { slug: string }) => Promise<unknown | null>;
  };
}

/**
 * Create a Supabase-backed database interface
 * RLS policies are automatically applied based on the authenticated user
 */
export function createSupabaseDb(client?: SupabaseClient): SupabaseDb {
  const supabase = client || getSupabaseClient();

  return {
    client: supabase,

    // ========== ORDERS ==========
    orders: {
      async findUnique({ where }) {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', where.id)
          .single();

        if (error) {
          console.error('[SupabaseDB] orders.findUnique error:', error);
          return null;
        }
        return data;
      },

      async findMany({ where, take = 10, skip = 0, orderBy }) {
        let query = supabase.from('orders').select('*');

        if (where) {
          for (const [key, value] of Object.entries(where)) {
            query = query.eq(key, value);
          }
        }

        query = query
          .range(skip, skip + take - 1)
          .order('created_at', { ascending: false });

        const { data, error } = await query;

        if (error) {
          console.error('[SupabaseDB] orders.findMany error:', error);
          return [];
        }
        return data || [];
      },

      async create({ data }) {
        const { data: result, error } = await supabase
          .from('orders')
          .insert(data as Record<string, unknown>)
          .select()
          .single();

        if (error) {
          console.error('[SupabaseDB] orders.create error:', error);
          throw new Error(`Failed to create order: ${error.message}`);
        }
        return result;
      },

      async update({ where, data }) {
        const { data: result, error } = await supabase
          .from('orders')
          .update({ ...data, updated_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('id', where.id)
          .select()
          .single();

        if (error) {
          console.error('[SupabaseDB] orders.update error:', error);
          throw new Error(`Failed to update order: ${error.message}`);
        }
        return result;
      },
    },

    // ========== PRODUCTS ==========
    products: {
      async findUnique({ where }) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', where.id)
          .single();

        if (error) return null;
        return data;
      },

      async findMany({ where, take = 10, category }) {
        let query = supabase.from('products').select('*');

        if (category) {
          query = query.eq('category', category);
        }

        query = query.limit(take);

        const { data, error } = await query;
        if (error) return [];
        return data || [];
      },

      async search({ query: searchQuery, limit = 10, category }) {
        // For now, use text search on name/description
        // In production, use pgvector similarity search
        let supabaseQuery = supabase
          .from('products')
          .select('*')
          .ilike('name', `%${searchQuery}%`)
          .limit(limit);

        if (category) {
          supabaseQuery = supabaseQuery.eq('category', category);
        }

        const { data, error } = await supabaseQuery;
        if (error) {
          console.error('[SupabaseDB] products.search error:', error);
          return [];
        }
        return data || [];
      },
    },

    // ========== CUSTOMERS ==========
    customers: {
      async findUnique({ where }) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('id', where.id)
          .single();

        if (error) return null;
        return data;
      },

      async findMany({ where, take = 10 }) {
        let query = supabase.from('customers').select('*');

        if (where?.organization_id) {
          query = query.eq('organization_id', where.organization_id);
        }

        query = query.limit(take);

        const { data, error } = await query;
        if (error) return [];
        return data || [];
      },

      async findByEmail({ email }) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('email', email)
          .single();

        if (error) return null;
        return data;
      },
    },

    // ========== TICKETS ==========
    tickets: {
      async findUnique({ where }) {
        const { data, error } = await supabase
          .from('tickets')
          .select('*, customer:customers(*), assigned_agent:users(*)')
          .eq('id', where.id)
          .single();

        if (error) return null;
        return data;
      },

      async findMany({ where, take = 10 }) {
        let query = supabase.from('tickets').select('*');

        if (where?.customer_id) {
          query = query.eq('customer_id', where.customer_id);
        }
        if (where?.organization_id) {
          query = query.eq('organization_id', where.organization_id);
        }

        query = query.limit(take).order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) return [];
        return data || [];
      },

      async create({ data }) {
        const { data: result, error } = await supabase
          .from('tickets')
          .insert(data as Record<string, unknown>)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create ticket: ${error.message}`);
        }
        return result;
      },

      async update({ where, data }) {
        const { data: result, error } = await supabase
          .from('tickets')
          .update({ ...data, updated_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('id', where.id)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to update ticket: ${error.message}`);
        }
        return result;
      },
    },

    // ========== MESSAGES ==========
    messages: {
      async findMany({ where, orderBy }) {
        let query = supabase
          .from('messages')
          .select('*')
          .eq('ticket_id', where.ticket_id);

        query = query.order('created_at', { ascending: true });

        const { data, error } = await query;
        if (error) return [];
        return data || [];
      },

      async create({ data }) {
        const { data: result, error } = await supabase
          .from('messages')
          .insert(data as Record<string, unknown>)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create message: ${error.message}`);
        }
        return result;
      },
    },

    // ========== REFUNDS ==========
    refunds: {
      async findUnique({ where }) {
        const { data, error } = await supabase
          .from('refunds')
          .select('*')
          .eq('id', where.id)
          .single();

        if (error) return null;
        return data;
      },

      async findMany({ where, take = 10 }) {
        let query = supabase.from('refunds').select('*');

        if (where?.customer_email) {
          query = query.eq('customer_email', where.customer_email);
        }

        query = query.limit(take).order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) return [];
        return data || [];
      },

      async create({ data }) {
        const { data: result, error } = await supabase
          .from('refunds')
          .insert(data as Record<string, unknown>)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to create refund: ${error.message}`);
        }
        return result;
      },

      async update({ where, data }) {
        const { data: result, error } = await supabase
          .from('refunds')
          .update({ ...data, updated_at: new Date().toISOString() } as Record<string, unknown>)
          .eq('id', where.id)
          .select()
          .single();

        if (error) {
          throw new Error(`Failed to update refund: ${error.message}`);
        }
        return result;
      },
    },

    // ========== ORGANIZATIONS ==========
    organizations: {
      async findUnique({ where }) {
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', where.id)
          .single();

        if (error) return null;
        return data;
      },

      async findBySlug({ slug }) {
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error) return null;
        return data;
      },
    },
  };
}

// ============================================================================
// Adapter for lib/mcp/tools.ts SecureToolsOptions
// ============================================================================

export function createSecureToolsOptions(supabaseDb: SupabaseDb) {
  return {
    db: {
      orders: {
        findUnique: supabaseDb.orders.findUnique,
        findMany: supabaseDb.orders.findMany,
      },
      products: {
        findUnique: supabaseDb.products.findUnique,
        findMany: supabaseDb.products.findMany,
      },
      refunds: {
        findUnique: supabaseDb.refunds.findUnique,
        findMany: supabaseDb.refunds.findMany,
        create: supabaseDb.refunds.create,
      },
      tickets: {
        findUnique: supabaseDb.tickets.findUnique,
        findMany: supabaseDb.tickets.findMany,
        create: supabaseDb.tickets.create,
        update: supabaseDb.tickets.update,
      },
      cart: {
        findUnique: async () => null, // Not implemented for Supabase
        create: async () => null,
        update: async () => null,
      },
    },
  };
}

// ============================================================================
// Singleton instance
// ============================================================================

let supabaseDbInstance: SupabaseDb | null = null;

export function getSupabaseDb(): SupabaseDb {
  if (!supabaseDbInstance) {
    supabaseDbInstance = createSupabaseDb();
  }
  return supabaseDbInstance;
}

export { createSupabaseDb as default };
