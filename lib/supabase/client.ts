/**
 * Supabase Client - Database and Auth for Customer Support System
 *
 * Provides typed database client and authentication utilities
 * for multi-tenant customer support intelligence.
 */

import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';
import { env } from '@/lib/env';

// ============================================================================
// Client Initialization
// ============================================================================

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client singleton
 */
export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  supabaseClient = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }
  );

  return supabaseClient;
}

// ============================================================================
// Types (matching Supabase schema)
// ============================================================================

export type OrganizationRole = 'owner' | 'admin' | 'supervisor' | 'agent' | 'viewer';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed' | 'archived';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type MessageAuthorType = 'customer' | 'agent' | 'system' | 'ai';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo: string | null;
  settings: Record<string, unknown> | null;
  plan: string;
  stripe_customer_id: string | null;
  billing_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: OrganizationRole;
  is_active: boolean;
  settings: Record<string, unknown> | null;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

export interface Customer {
  id: string;
  organization_id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  metadata: Record<string, unknown> | null;
  tags: string[];
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  organization_id: string;
  customer_id: string | null;
  assigned_agent_id: string | null;
  ticket_number: string;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  channel: string;
  category: string | null;
  tags: string[];
  custom_fields: Record<string, unknown> | null;
  sla_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
  sentiment_score: number | null;
  ai_suggested_category: string | null;
  ai_confidence_score: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  customer?: Customer;
  assigned_agent?: UserProfile;
}

export interface Message {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_type: MessageAuthorType;
  author_name: string | null;
  content: string;
  content_type: string;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  is_internal: boolean;
  read_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Order {
  id: string;
  organization_id: string;
  customer_id: string | null;
  order_number: string;
  status: string;
  total_amount: number;
  currency: string;
  items: Array<{
    id: string;
    product_id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  shipping_address: Record<string, unknown> | null;
  billing_address: Record<string, unknown> | null;
  payment_status: string;
  stripe_payment_intent_id: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Refund {
  id: string;
  organization_id: string;
  order_id: string | null;
  ticket_id: string | null;
  customer_email: string;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  stripe_refund_id: string | null;
  stripe_charge_id: string | null;
  idempotency_key: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  processed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeArticle {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  excerpt: string | null;
  category: string | null;
  status: string;
  author_id: string | null;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  metadata: Record<string, unknown> | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Generic query helper with automatic tenant filtering
 */
export async function query<T>(
  table: string,
  options?: {
    select?: string;
    where?: Record<string, unknown>;
    order?: Record<string, 'asc' | 'desc'>;
    limit?: number;
    offset?: number;
  }
): Promise<T[]> {
  const client = getSupabaseClient();
  let query = client.from(table).select(options?.select || '*');

  if (options?.where) {
    for (const [key, value] of Object.entries(options.where)) {
      query = query.eq(key, value);
    }
  }

  if (options?.order) {
    for (const [key, direction] of Object.entries(options.order)) {
      query = query.order(key, { ascending: direction === 'asc' });
    }
  }

  if (options?.limit || options?.offset !== undefined) {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;
    (query as { range(from: number, to: number): void }).range(offset, offset + limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`[Supabase] Query error on ${table}:`, error);
    throw new Error(`Failed to query ${table}: ${error.message}`);
  }

  return data as T[];
}

/**
 * Insert a record
 */
export async function insert<T>(
  table: string,
  record: Partial<T>,
  options?: { returning?: boolean }
): Promise<T | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(table)
    .insert(record as Record<string, unknown>)
    .select(options?.returning ? '*' : 'id')
    .single();

  if (error) {
    console.error(`[Supabase] Insert error on ${table}:`, error);
    throw new Error(`Failed to insert into ${table}: ${error.message}`);
  }

  return data as T | null;
}

/**
 * Update a record
 */
export async function update<T>(
  table: string,
  id: string,
  updates: Partial<T>
): Promise<T | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(table)
    .update({ ...updates, updated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', id)
    .single();

  if (error) {
    console.error(`[Supabase] Update error on ${table}:`, error);
    throw new Error(`Failed to update ${table}: ${error.message}`);
  }

  return data as T | null;
}

/**
 * Delete a record
 */
export async function remove(table: string, id: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { error } = await client.from(table).delete().eq('id', id);

  if (error) {
    console.error(`[Supabase] Delete error on ${table}:`, error);
    throw new Error(`Failed to delete from ${table}: ${error.message}`);
  }

  return true;
}

// ============================================================================
// Auth Operations
// ============================================================================

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, metadata?: Record<string, unknown>) {
  const client = getSupabaseClient();
  return client.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const client = getSupabaseClient();
  return client.auth.signInWithPassword({
    email,
    password,
  });
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithOAuth(provider: 'google' | 'github') {
  const client = getSupabaseClient();
  return client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/auth/callback`,
    },
  });
}

/**
 * Sign out
 */
export async function signOut() {
  const client = getSupabaseClient();
  return client.auth.signOut();
}

/**
 * Get current session
 */
export async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const { data: { session } } = await client.auth.getSession();
  return session;
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}

/**
 * Get user profile with organization
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('users')
    .select('*, organization:organizations(*)')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[Supabase] Get user profile error:', error);
    return null;
  }

  return data as UserProfile;
}

/**
 * Refresh session
 */
export async function refreshSession() {
  const client = getSupabaseClient();
  return client.auth.refreshSession();
}

/**
 * Reset password (send reset email)
 */
export async function resetPassword(email: string) {
  const client = getSupabaseClient();
  return client.auth.resetPasswordForEmail(email, {
    redirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/auth/reset-password`,
  });
}

// ============================================================================
// Realtime Subscriptions
// ============================================================================

/**
 * Subscribe to ticket messages
 */
export function subscribeToTicket(
  ticketId: string,
  callbacks: {
    onInsert?: (message: Message) => void;
    onUpdate?: (message: Message) => void;
    onDelete?: (id: string) => void;
  }
) {
  const client = getSupabaseClient();

  const channel = client
    .channel(`ticket:${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload) => {
        if (payload.eventType === 'INSERT' && callbacks.onInsert) {
          callbacks.onInsert(payload.new as Message);
        } else if (payload.eventType === 'UPDATE' && callbacks.onUpdate) {
          callbacks.onUpdate(payload.new as Message);
        } else if (payload.eventType === 'DELETE' && callbacks.onDelete) {
          callbacks.onDelete(payload.old.id);
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Subscribe to ticket status changes
 */
export function subscribeToTicketStatus(
  organizationId: string,
  callbacks: {
    onUpdate?: (ticket: Ticket) => void;
  }
) {
  const client = getSupabaseClient();

  const channel = client
    .channel(`org:${organizationId}:tickets`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tickets',
        filter: `organization_id=eq.${organizationId}`,
      },
      (payload) => {
        if (callbacks.onUpdate) {
          callbacks.onUpdate(payload.new as Ticket);
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Subscribe to user presence
 */
export function subscribeToPresence(
  channelId: string,
  userId: string,
  userInfo: { email: string; avatar_url?: string }
) {
  const client = getSupabaseClient();

  const channel = client.channel(channelId, {
    config: {
      presence: {
        key: userId,
      },
    },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      console.log('[Presence] Sync:', state);
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      console.log('[Presence] Joined:', newPresences);
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      console.log('[Presence] Left:', leftPresences);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track(userInfo);
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}

// ============================================================================
// Export
// ============================================================================

export const supabase = {
  client: getSupabaseClient,
  query,
  insert,
  update,
  remove,
  auth: {
    signUp,
    signIn,
    signInWithOAuth,
    signOut,
    getSession,
    getCurrentUser,
    getUserProfile,
    refreshSession,
    resetPassword,
  },
  realtime: {
    subscribeToTicket,
    subscribeToTicketStatus,
    subscribeToPresence,
  },
};
