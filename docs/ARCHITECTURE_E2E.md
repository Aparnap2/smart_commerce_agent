# E-Commerce Customer Support Intelligence System - E2E Architecture

## Executive Summary

Build a **complete multi-tenant customer support intelligence platform** leveraging:
- **Supabase** as backend (Auth + Database + RLS + Realtime + Edge Functions)
- **Existing LangGraph agents** (supervisor, refund, tool, ui agents)
- **Existing RAG service** with pgvector for semantic search
- **Next.js 15** frontend with App Router

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER SUPPORT INTELLIGENCE SYSTEM                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        FRONTEND (Next.js 15)                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │   Public    │  │   Portal    │  │   Admin     │  │   API       │ │   │
│  │  │   Site      │  │   (Chat)    │  │   Panel     │  │   Routes    │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     SUPABASE ECOSYSTEM                                │   │
│  │  ┌───────────────────────────────────────────────────────────────┐    │   │
│  │  │                     SUPABASE AUTH                            │    │   │
│  │  │  • Email/Password  • Magic Links  • OAuth (Google/GitHub)  │    │   │
│  │  │  • Organization-based access  • Role-based permissions      │    │   │
│  │  └───────────────────────────────────────────────────────────────┘    │   │
│  │                                    │                                   │   │
│  │  ┌───────────────────────────────────────────────────────────────┐    │   │
│  │  │                    POSTGRES DATABASE + RLS                     │    │   │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐│    │   │
│  │  │  │   Tables     │  │   Views      │  │   RLS Policies         ││    │   │
│  │  │  │   • Tickets  │  │   • Stats   │  │   • Tenant isolation   ││    │   │
│  │  │  │   • Messages │  │   • Reports │  │   • Role-based access  ││    │   │
│  │  │  │   • Customers│  │   │  │   │   │   • Audit trails      ││    │   │
│  │  │  │   • Products │  │   │   │   │  │   └─────────────────────────┘│    │   │
│  │  │  │   • Orders   │  │   │   │   │                              │    │   │
│  │  │  │   • Refunds  │  │   │   │   │                              │    │   │
│  │  │  └─────────────┘  └────┘   │   │                              │    │   │
│  │  └──────────────────────────────┼───────────────────────────────────┘    │   │
│  │                                 │                                       │   │
│  │  ┌──────────────────────────────┼───────────────────────────────────┐    │   │
│  │  │                    SUPABASE REALTIME                           │    │   │
│  │  │  • Live ticket updates  • Typing indicators  • Presence      │    │   │
│  │  └───────────────────────────────────────────────────────────────┘    │   │
│  │                                                                              │
│  └─────────────────────────────────────────────────────────────────────────────┘
│                                    │
│                                    ▼
│  ┌─────────────────────────────────────────────────────────────────────────────┐
│  │                     LANGGRAPH AGENT LAYER (Next.js API)                    │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  │                      SUPERVISOR AGENT                                 │   │
│  │  │   • Intent classification  • Routing decisions  • State management  │   │
│  │  └─────────────────────────────────────────────────────────────────────┘   │
│  │         │                    │                    │                    │    │
│  │         ▼                    ▼                    ▼                    ▼    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  │ REFUND      │  │   TOOL      │  │    UI       │  │   HUMAN     │   │
│  │  │   AGENT     │  │   AGENT     │  │   AGENT     │  │   ESCALATE  │   │
│  │  │ • Validate  │  │ • Product   │  │ • Generate  │  │ • Ticket    │   │
│  │  │ • Process   │  │ • Search    │  │ • Response  │  │   routing   │   │
│  │  │ • Webhook   │  │ • Orders    │  │ • Stream    │  │ • Approval  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│  └─────────────────────────────────────────────────────────────────────────────┘
│                                    │
│                                    ▼
│  ┌─────────────────────────────────────────────────────────────────────────────┐
│  │                        SERVICES LAYER                                       │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  │                      RAG SERVICE (pgvector)                          │   │
│  │  │  • Product embeddings  • Knowledge base  • Semantic search            │   │
│  │  └─────────────────────────────────────────────────────────────────────┘   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  │                    LLM PROVIDER (OpenAI/Ollama)                     │   │
│  │  │  • Chat completions  • Embeddings  • Structured outputs             │   │
│  │  └─────────────────────────────────────────────────────────────────────┘   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  │                   STRIPE SERVICE (Payments)                          │   │
│  │  │  • Refunds  • Webhooks  • Payment intents                           │   │
│  │  └─────────────────────────────────────────────────────────────────────┘   │
│  └─────────────────────────────────────────────────────────────────────────────┘
│                                    │
│                                    ▼
│  ┌─────────────────────────────────────────────────────────────────────────────┐
│  │                    SUPABASE EDGE FUNCTIONS                                  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  │  Webhooks    │  │  AI Triggers │  │  Notifications│  │  Analytics  │   │
│  │  │  • Stripe    │  │  • Auto-Tag  │  │  • Email     │  │  • Daily    │   │
│  │  │  • External  │  │  • Routing   │  │  • SMS       │  │  • Reports  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│  └─────────────────────────────────────────────────────────────────────────────┘
│
└─────────────────────────────────────────────────────────────────────────────┘
```

## 1. Supabase Database Schema

### Core Tables (with RLS)

```sql
-- ============================================
-- ORGANIZATIONS (Multi-tenancy)
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  logo TEXT,
  settings JSONB DEFAULT '{}',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'professional', 'enterprise')),
  stripe_customer_id TEXT,
  billing_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS (Supabase Auth integration)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'supervisor', 'agent', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOMERS (E-commerce customers)
-- ============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  full_name TEXT,
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

-- ============================================
-- TICKETS (Customer support tickets)
-- ============================================
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ticket_number TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed', 'archived')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  channel TEXT DEFAULT 'chat' CHECK (channel IN ('chat', 'email', 'phone', 'social', 'api')),
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  sla_due_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  sentiment_score DECIMAL(4,3),
  ai_suggested_category TEXT,
  ai_confidence_score DECIMAL(4,3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_tickets_org_status ON tickets(organization_id, status);
CREATE INDEX idx_tickets_org_assigned ON tickets(organization_id, assigned_agent_id);
CREATE INDEX idx_tickets_org_priority ON tickets(organization_id, priority);
CREATE INDEX idx_tickets_customer ON tickets(customer_id);

-- ============================================
-- MESSAGES (Ticket conversation)
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_type TEXT DEFAULT 'agent' CHECK (author_type IN ('customer', 'agent', 'system', 'ai')),
  author_name TEXT,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'html', 'markdown', 'system')),
  attachments JSONB DEFAULT '[]',
  is_internal BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_ticket ON messages(ticket_id);

-- ============================================
-- ORDERS (E-commerce orders)
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  total_amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  items JSONB DEFAULT '[]',
  shipping_address JSONB,
  billing_address JSONB,
  payment_status TEXT DEFAULT 'pending',
  stripe_payment_intent_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, order_number)
);

-- ============================================
-- REFUNDS
-- ============================================
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'rejected', 'failed')),
  reason TEXT,
  stripe_refund_id TEXT,
  stripe_charge_id TEXT,
  idempotency_key TEXT UNIQUE,
  notes TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS (Knowledge base for RAG)
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(12,2),
  compare_at_price DECIMAL(12,2),
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  images JSONB DEFAULT '[]',
  inventory_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE BASE (RAG documents)
-- ============================================
CREATE TABLE knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  category TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ANALYTICS & AUDIT
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(organization_id, created_at DESC);

-- ============================================
-- RLS ENABLING
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES (Tenant Isolation)
-- ============================================

-- Organizations: Users can only see their own organization
CREATE POLICY "org_users_can_view_own_org" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.organization_id = organizations.id
      AND users.id = auth.uid()
    )
  );

-- Users: Can only view users in their organization
CREATE POLICY "users_view_org_users" ON users
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Customers: Tenant isolation
CREATE POLICY "customers_view_own_tenant" ON customers
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Tickets: Role-based access
CREATE POLICY "tickets_select_own_tenant" ON tickets
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "tickets_insert_own_tenant" ON tickets
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "tickets_update_own_tenant" ON tickets
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
    AND (
      -- Agents can update their own tickets
      assigned_agent_id = auth.uid()
      -- Admins can update any ticket in org
      OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('owner', 'admin', 'supervisor')
      )
    )
  );
```

## 2. Supabase Auth Configuration

### Auth Helpers (`lib/supabase/auth.ts`)

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/supabase';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
        get(name      cookies: {
: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );
}

export async function getSession() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

export async function requireRole(allowedRoles: string[]) {
  const user = await getCurrentUser();
  if (!user || !allowedRoles.includes(user.role)) {
    redirect('/unauthorized');
  }
  return user;
}
```

## 3. Realtime Subscription Hooks

### Use Ticket Realtime (`hooks/useTicketRealtime.ts`)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

type Message = Database['public']['Tables']['messages']['Row'];

export function useTicketRealtime(ticketId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const supabase = createClient();

  useEffect(() => {
    // Load initial messages
    async function loadMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (data) setMessages(data);
    }

    loadMessages();

    // Subscribe to changes
    const channel = supabase
      .channel(`ticket:${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, supabase]);

  return { messages };
}
```

## 4. Edge Functions

### A. AI Ticket Classification (`supabase/functions/classify-ticket/index.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { ticket_id, subject, description } = await req.json();

  // Use AI to classify ticket
  const classification = await classifyWithAI(subject, description);

  // Update ticket with classification
  await supabase
    .from('tickets')
    .update({
      category: classification.category,
      priority: classification.priority,
      sentiment_score: classification.sentiment,
      ai_suggested_category: classification.category,
      ai_confidence_score: classification.confidence,
    })
    .eq('id', ticket_id);

  return new Response(JSON.stringify(classification), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function classifyWithAI(subject: string, description: string) {
  // Call OpenAI/your LLM provider
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Classify this support ticket. Return JSON with:
            - category: refund, order, product, technical, billing, other
            - priority: low, medium, high, urgent
            - sentiment: -1.0 to 1.0
            - confidence: 0.0 to 1.0`
        },
        { role: 'user', content: `Subject: ${subject}\n\nDescription: ${description}` }
      ],
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
```

### B. Email Notifications (`supabase/functions/send-notification/index.ts`)

```typescript
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { type, ticket_id, recipient_email, data } = await req.json();

  // Send via Resend
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: recipient_email,
      subject: getEmailSubject(type, data),
      html: getEmailTemplate(type, data),
    }),
  });

  const result = await resendResponse.json();

  // Log notification
  await supabase.from('notification_logs').insert({
    ticket_id,
    type,
    recipient_email,
    status: resendResponse.ok ? 'sent' : 'failed',
    provider_response: result,
  });

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

## 5. LangGraph Agent Integration

### Enhanced State with Supabase (`lib/agents/state.ts`)

```typescript
import { createClient } from '@/lib/supabase/server';

// Extend existing state with Supabase context
export interface SupportState {
  // ... existing fields from lib/agents/state.ts

  // Supabase-specific
  organizationId: string;
  customerId?: string;
  ticketId?: string;
}

export async function getSupabaseContext(userId: string) {
  const supabase = await createClient();

  const { data: user } = await supabase
    .from('users')
    .select('*, organization_id')
    .eq('id', userId)
    .single();

  return {
    organizationId: user?.organization_id,
    role: user?.role,
    organization: user?.organization,
  };
}
```

## 6. Frontend Architecture

### Route Structure

```
app/
├── (public)/                    # Public pages
│   ├── page.tsx                 # Landing page
│   ├── login/page.tsx          # Auth pages
│   └── support/                # Customer support portal
│       ├── page.tsx            # Chat widget
│       ├── tickets/page.tsx    # My tickets
│       └── [id]/page.tsx       # Ticket detail
│
├── (dashboard)/                 # Protected dashboard
│   ├── layout.tsx              # Dashboard layout
│   ├── page.tsx                # Overview
│   ├── tickets/                # Ticket management
│   │   ├── page.tsx            # List view
│   │   ├── [id]/page.tsx      # Detail view
│   │   └── new/page.tsx        # Create ticket
│   ├── customers/              # Customer management
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── products/               # Product management
│   ├── knowledge/             # Knowledge base
│   ├── analytics/             # Reports
│   └── settings/               # Organization settings
│
└── api/                        # API routes
    ├── chat/route.ts           # Chat API
    ├── tickets/route.ts        # Tickets CRUD
    └── webhooks/               # External webhooks
```

### Chat Widget Component (`components/chat/ChatWidget.tsx`)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useChat } from '@/hooks/useChat';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Realtime subscription
    const channel = supabase
      .channel('chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        if (payload.new.ticket_id === ticketId) {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, supabase]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    // Create or get existing ticket
    if (!ticketId) {
      const { data: ticket } = await supabase
        .from('tickets')
        .insert({
          subject: input.substring(0, 100),
          channel: 'chat',
          status: 'open',
        })
        .select()
        .single();

      setTicketId(ticket.id);
    }

    // Send message
    await supabase.from('messages').insert({
      ticket_id: ticketId,
      content: input,
      author_type: 'customer',
    });

    setInput('');
  };

  return (
    <div className="chat-widget">
      {!isOpen ? (
        <button onClick={() => setIsOpen(true)}>Open Chat</button>
      ) : (
        <div className="chat-window">
          <div className="messages">
            {messages.map((msg) => (
              <div key={msg.id} className={msg.author_type}>
                {msg.content}
              </div>
            ))}
          </div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onSubmit={sendMessage}
          />
        </div>
      )}
    </div>
  );
}
```

## 7. Third-Party Integrations

### Integration Matrix

| Service | Purpose | Supabase Integration |
|---------|---------|---------------------|
| **Stripe** | Payments & Refunds | Edge Functions webhooks |
| **Resend** | Transactional emails | Edge Functions |
| **Twilio** | SMS notifications | Edge Functions |
| **OpenAI** | AI/ML processing | Edge Functions or API routes |
| **PostHog** | Analytics | Client SDK + Edge Functions |
| **Sentry** | Error tracking | Node SDK in API routes |

### Integration Config (`lib/integrations/config.ts`)

```typescript
export const integrations = {
  stripe: {
    client: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  posthog: {
    apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN,
  },
};
```

## 8. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication
AUTH_SECRET=your-auth-secret-key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Email (Resend)
RESEND_API_KEY=re_xxx

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890

# AI
OPENAI_API_KEY=sk-xxx

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx

# Error Tracking
SENTRY_DSN=https://xxx@sentry.io/xxx
```

## 9. Leveraged Existing Code

### Files to Reuse/Extend

| File | Purpose | How to Leverage |
|------|---------|-----------------|
| `lib/agents/state.ts` | State schemas | Use existing `IntentTypeSchema`, `MessageSchema`, `AgentState` |
| `lib/agents/supervisor.ts` | Supervisor agent | Extend with Supabase context |
| `lib/agents/refund.ts` | Refund agent | Connect to Stripe + Supabase refunds table |
| `lib/agents/tools.ts` | Tool implementations | Connect to Supabase queries |
| `lib/rag/service.ts` | RAG service | Use with knowledge_articles table |
| `lib/stripe/client.ts` | Stripe client | Extend with webhook handlers |
| `lib/stripe/refund.ts` | Refund logic | Integrate with refunds table |
| `lib/schemas/commerce.ts` | Commerce schemas | Use for orders/products validation |
| `lib/observability/langfuse.ts` | Observability | Track agent performance |

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Supabase project with new schema
- [ ] Configure Supabase Auth (email + Google OAuth)
- [ ] Implement RLS policies for tenant isolation
- [ ] Create basic CRUD API routes for tickets/messages
- [ ] Build chat widget frontend

### Phase 2: Agent Integration (Week 3-4)
- [ ] Connect LangGraph agents to Supabase
- [ ] Implement ticket classification AI
- [ ] Build refund workflow with Stripe
- [ ] Add RAG knowledge base integration
- [ ] Implement realtime chat updates

### Phase 3: Admin Panel (Week 5-6)
- [ ] Build full admin dashboard
- [ ] Create ticket management views
- [ ] Implement customer 360 view
- [ ] Add analytics and reporting
- [ ] Build team management

### Phase 4: Integrations (Week 7-8)
- [ ] Configure Resend email templates
- [ ] Add Twilio SMS notifications
- [ ] Implement PostHog analytics
- [ ] Set up Sentry error tracking
- [ ] Add outbound webhooks

## 11. Migration Strategy

### From Current State to Supabase

1. **Export current data**
```bash
pg_dump $DATABASE_URL > backup.sql
```

2. **Create Supabase migration**
```bash
supabase migration new initial_schema
# Add schema from section 1
```

3. **Migrate data with organization_id**
```sql
-- Add temp organization_id
ALTER TABLE customers ADD COLUMN temp_org_id UUID;
UPDATE customers SET temp_org_id = 'your-first-org-id';

-- Insert into Supabase
INSERT INTO organizations (id, name, slug)
VALUES ('your-first-org-id', 'Your Company', 'your-company');

INSERT INTO customers
SELECT gen_random_uuid(), temp_org_id, email, phone, ...
FROM customers;
```

4. **Switch clients to Supabase**
- Update `lib/db` to use Supabase client
- Update auth to use Supabase Auth
- Update queries to use Supabase client

## Summary

This architecture provides:

| Capability | Solution |
|------------|----------|
| **Authentication** | Supabase Auth (email + OAuth) |
| **Multi-tenancy** | PostgreSQL RLS + organization_id |
| **Database** | PostgreSQL with Supabase |
| **Realtime** | Supabase Realtime subscriptions |
| **Edge Computing** | Supabase Edge Functions (Deno) |
| **AI Agents** | Existing LangGraph + OpenAI |
| **Vector Search** | Existing RAG + pgvector |
| **Payments** | Stripe + Edge Functions |
| **Email** | Resend + Edge Functions |
| **Frontend** | Next.js 15 App Router |

This gives you a **complete production-ready customer support intelligence system** in ~8 weeks.
