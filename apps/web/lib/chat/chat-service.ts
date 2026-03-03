/**
 * Chat Service - Bridges existing chat UI with Supabase backend
 *
 * Leverages:
 * - lib/supabase/client.ts for realtime subscriptions
 * - lib/supabase/types.ts for Message type definitions
 * - app/dashboard/chat.tsx for existing chat UI
 */

import { getSupabaseClient, type Message } from '@/lib/supabase/client';

// ============================================================================
// Message Formatting (aligns with existing chat.tsx)
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status?: 'streaming' | 'complete' | 'error';
  author_type?: 'customer' | 'agent' | 'system' | 'ai';
}

/**
 * Convert Supabase Message to ChatMessage for UI
 */
export function toChatMessage(msg: Message): ChatMessage {
  const roleMap: Record<string, 'user' | 'assistant' | 'system'> = {
    customer: 'user',
    agent: 'assistant',
    system: 'system',
    ai: 'assistant',
  };

  return {
    id: msg.id,
    role: roleMap[msg.author_type] || 'user',
    content: msg.content,
    timestamp: new Date(msg.created_at),
    status: 'complete',
    author_type: msg.author_type,
  };
}

/**
 * Convert ChatMessage to Supabase Message insert format
 */
export function toSupabaseMessage(
  chatMsg: Omit<ChatMessage, 'id' | 'timestamp' | 'status'>,
  ticketId: string,
  authorId: string
): Partial<Message> {
  const roleToAuthor: Record<string, 'customer' | 'agent' | 'system' | 'ai'> = {
    user: 'customer',
    assistant: 'ai',
    system: 'system',
  };

  return {
    ticket_id: ticketId,
    author_id: authorId,
    author_type: roleToAuthor[chatMsg.role] || 'customer',
    content: chatMsg.content,
    content_type: 'text',
    attachments: [],
    is_internal: false,
  };
}

// ============================================================================
// Realtime Subscription
// ============================================================================

export type ChatSubscription = () => void;

/**
 * Subscribe to messages for a ticket with realtime updates
 * Integrates with existing subscribeToTicket from lib/supabase/client.ts
 */
export function subscribeToChat(
  ticketId: string,
  callbacks: {
    onNewMessage?: (message: ChatMessage) => void;
    onError?: (error: Error) => void;
  }
): ChatSubscription {
  const client = getSupabaseClient();

  const channel = client
    .channel(`chat:${ticketId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `ticket_id=eq.${ticketId}`,
      },
      (payload) => {
        const message = toChatMessage(payload.new as Message);
        callbacks.onNewMessage?.(message);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Chat] Subscribed to ticket: ${ticketId}`);
      } else if (status === 'CHANNEL_ERROR') {
        callbacks.onError?.(new Error('Failed to subscribe to chat'));
      }
    });

  return () => {
    client.removeChannel(channel);
    console.log(`[Chat] Unsubscribed from ticket: ${ticketId}`);
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Fetch messages for a ticket
 */
export async function getTicketMessages(ticketId: string): Promise<ChatMessage[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Chat] Failed to fetch messages:', error);
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  return data.map(toChatMessage);
}

/**
 * Send a message to a ticket
 */
export async function sendMessage(
  ticketId: string,
  authorId: string,
  content: string,
  authorType: 'customer' | 'agent' | 'system' | 'ai' = 'customer'
): Promise<ChatMessage> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('messages')
    .insert({
      ticket_id: ticketId,
      author_id: authorId || null,
      author_type: authorType,
      content,
      content_type: 'text',
      attachments: [],
      is_internal: false,
    } as Record<string, unknown>)
    .select()
    .single();

  if (error) {
    console.error('[Chat] Failed to send message:', error);
    throw new Error(`Failed to send message: ${error.message}`);
  }

  return toChatMessage(data);
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(
  ticketId: string,
  status: 'open' | 'pending' | 'resolved' | 'closed' | 'archived'
): Promise<void> {
  const client = getSupabaseClient();

  const { error } = await client
    .from('tickets')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId);

  if (error) {
    console.error('[Chat] Failed to update ticket status:', error);
    throw new Error(`Failed to update status: ${error.message}`);
  }
}

/**
 * Create a new ticket with initial message
 */
export async function createTicket(
  organizationId: string,
  customerId: string | null,
  subject: string,
  initialMessage: string,
  authorType: 'customer' | 'agent' | 'ai' = 'customer',
  authorId: string | null = null
): Promise<{ ticketId: string; messageId: string }> {
  const client = getSupabaseClient();

  // Generate ticket number
  const ticketNumber = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Create ticket
  const { data: ticket, error: ticketError } = await client
    .from('tickets')
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      ticket_number: ticketNumber,
      subject,
      description: initialMessage,
      status: 'open',
      priority: 'medium',
      channel: 'chat',
    } as Record<string, unknown>)
    .select()
    .single();

  if (ticketError) {
    throw new Error(`Failed to create ticket: ${ticketError.message}`);
  }

  // Create initial message
  const { data: message, error: messageError } = await client
    .from('messages')
    .insert({
      ticket_id: ticket.id,
      author_id: authorId,
      author_type: authorType,
      content: initialMessage,
      content_type: 'text',
      attachments: [],
      is_internal: false,
    } as Record<string, unknown>)
    .select()
    .single();

  if (messageError) {
    throw new Error(`Failed to create message: ${messageError.message}`);
  }

  return { ticketId: ticket.id, messageId: message.id };
}

// ============================================================================
// Presence (Online Agents)
// ============================================================================

export interface AgentPresence {
  userId: string;
  email: string;
  avatar?: string;
}

/**
 * Track agent presence in a ticket
 */
export function trackAgentPresence(
  ticketId: string,
  userId: string,
  userInfo: { email: string; avatar_url?: string }
): () => void {
  const client = getSupabaseClient();

  const channel = client.channel(`presence:${ticketId}:${userId}`, {
    config: {
      presence: { key: userId },
    },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      console.log(`[Presence] Agent ${userId} sync:`, state);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userId,
          email: userInfo.email,
          avatar: userInfo.avatar_url,
          online_at: new Date().toISOString(),
        });
      }
    });

  return () => {
    client.removeChannel(channel);
  };
}

// ============================================================================
// Export
// ============================================================================

export const chatService = {
  toChatMessage,
  toSupabaseMessage,
  subscribeToChat,
  getTicketMessages,
  sendMessage,
  updateTicketStatus,
  createTicket,
  trackAgentPresence,
};
