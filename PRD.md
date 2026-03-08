# Smart Commerce Agent - Product Requirements Document

## Overview
Production-grade agentic e-commerce CX platform. AI agents handle product discovery, cart management, checkout, order tracking, and support via natural language + GenUI components.

---

## Vision

Build an AI-native commerce platform where the agent IS the interface — not a chatbot widget glued to a traditional dashboard.

**Core Principle**: Zero page navigation. Zero forms. All conversation.

| User Says | System Response |
|-----------|-----------------|
| "show me headphones under ₹12k" | ProductGrid renders inline |
| "add the first one" | CartCanvas updates inline |
| "checkout" | ActionConfirm → Order created |

---

## User Stories

### Customer User Stories

| As a | I want to | So that |
|------|-----------|---------|
| Shopper | search with natural language | I don't have to use filters |
| Shopper | refine filters in conversation | I can iterate without starting over |
| Shopper | add items via chat | I don't have to click "Add to Cart" buttons |
| Shopper | track orders conversationally | I get context-aware updates |
| Shopper | return items in 3 messages | I don't have to fill out forms |
| Shopper | get proactive cart recovery | I'm reminded about items I left |

### Merchant User Stories

| As a | I want to | So that |
|------|-----------|---------|
| Merchant | see daily briefing on open | I know what needs attention |
| Merchant | get anomaly alerts | I can investigate issues quickly |
| Merchant | restock via chat | I don't have to navigate admin panels |
| Merchant | bulk refund orders | I can handle issues at scale |

---

## Functional Requirements

### FR-1: Natural Language Search
- System shall extract price, brand, useCase from NL queries
- System shall support multi-turn refinement ("actually under ₹10k")
- System shall return max 6 products (cognitive load limit)

### FR-2: Agentic Cart Management
- System shall add items via chat command
- System shall show CartCanvas inline after add
- System shall enforce idempotency (no double-add)

### FR-3: Conversational Returns
- System shall initiate return in 3 messages max
- System shall present 3 options (replacement, refund, credit)
- System shall apply policy engine (7-day window, auto-approve <3 days)

### FR-4: Proactive Intelligence
- System shall send cart recovery after 2hr abandonment
- System shall rate limit (1 proactive per 4hr per user)
- System shall prioritize by revenue impact

### FR-5: Merchant Analytics
- System shall show revenue delta vs yesterday on open
- System shall flag anomalies (>20% revenue change, stock <3 days)
- System shall render single briefing card (not 5 separate messages)

---

## Non-Functional Requirements

### Performance
| Metric | Target |
|--------|--------|
| P95 latency per agent turn | < 500ms |
| P99 latency (LLM timeout fallback) | < 2000ms |
| Message handling (TanStack Virtual) | 1000+ messages without lag |

### Reliability
- Idempotency prevents double-execution (30s window)
- Optimistic locking prevents lost updates
- At-least-once delivery for events (`commerce_events` table)

### Security
- Content Safety on all user inputs
- Parameter validation before all tool calls
- Role-based tool access (CUSTOMER vs MERCHANT)

### Observability
- 100% of agent turns traced in Langfuse
- 100% of tool calls have correlation IDs
- All errors are structured events (not `console.log`)

---

## Success Metrics

### Agent Performance
| Metric | Target |
|--------|--------|
| Tool selection accuracy | >90% |
| Parameter extraction accuracy | >85% |
| Context retention accuracy | >80% |
| Hallucination rate | 0% |

### User Experience
| Metric | Target |
|--------|--------|
| Task completion rate | >95% |
| Average messages per task | <5 |
| Proactive message CTR | >30% |
| Return flow completion | >90% |

### Business Impact
| Metric | Target | Comparison |
|--------|--------|------------|
| Cart recovery rate | >15% | vs industry 10% |
| Return processing time | <3 messages | vs industry 7-step form |
| Merchant time saved | >2hr/day | manual analytics replaced |

---

## Out of Scope (Explicitly)

The following are **explicitly excluded** from MVP:

| Feature | Rationale |
|---------|-----------|
| Product reviews & ratings | Agent can surface but not build review system |
| Multi-currency | INR only for MVP |
| Social sharing | Zero agentic value |
| Email marketing | Separate system |
| Advanced CMS | Agent IS the product page |

---

## Architecture

3-service monorepo:

| Service | Stack | Purpose |
|---------|-------|---------|
| **apps/web** | Next.js 15, GenUI canvas | Frontend |
| **apps/commerce-api** | Hono + Bun, GraphQL Yoga, Prisma JS | Commerce API |
| **apps/agent-core** | FastAPI + Python, LangGraph, Azure AI Foundry | Agent Core |

---

## Personas

| Persona | Goals |
|---------|-------|
| **Shopper** | Product discovery, cart management, checkout, order tracking |
| **Merchant** | Inventory monitoring, listing management, analytics |
| **Support** | Ticket resolution, refunds, policy RAG |

---

## Core Features

### Agent System
- LangGraph supervisor with typed state
- ShopperAgent for discovery/cart/checkout
- SupportAgent for refunds/tickets
- Redis checkpointing for state persistence
- Circuit breaker for resilience
- Human-in-the-loop for critical actions

### GenUI Components (Inline & Full-Width)

| Component | Purpose |
|-----------|---------|
| **ProductGrid** | Horizontal scroll-snap grid for search results (full width) |
| **ProductCard** | High-fidelity individual product display with blur placeholders |
| **CartCanvas** | Inline shopping cart management (replaces traditional overlays) |
| **ActionConfirm** | High-consequence authorization card (e.g., checkout placement) |
| **OrderTimeline** | Interactive vertical stepper for tracking |

### UX Design Rules

1. **No Navigation Chrome**: Left rail for thread history and live context only; no top tabs.
2. **Full-Width GenUI**: Cards inherit 100% of the chat column width for maximum impact.
3. **Input-Primary CTA**: Every action starts as a message; the agent decides the response mode.
4. **Fluid Layout**: 100dvh CSS Grid with virtualized anchor scrolling for long threads.

### Search & RAG
- Hybrid search (FTS + pgvector 1536-dim)
- Semantic caching
- Query transformation with NER

### Commerce API (MCP)
- Cart operations (add, update, remove, apply coupon)
- Product search and details
- Order management
- Checkout flow
- Refund processing via Stripe MCP

---

## Key Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Agent-core NEVER queries DB directly | Except for AgentNotification inserts |
| 2 | No ORM in Python | Raw asyncpg for 1-2 direct writes only |
| 3 | Prisma migrate owns ALL migrations | Never alembic |
| 4 | GraphQL Yoga exposed as MCP HTTP endpoints | To agent-core |
| 5 | Custom JWT auth | Not Supabase, not Entra B2C |
| 6 | Azure AI Foundry ONLY | No Ollama, no Google, no OpenAI direct |
| 7 | Stripe MCP Agent Toolkit | No raw stripe SDK for payments |
| 8 | pgvector 1536-dim | No Qdrant |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, shadcn/ui, CopilotKit |
| Commerce API | Hono + Bun, GraphQL Yoga, Prisma JS |
| Agent Core | FastAPI + Python, LangGraph, Azure OpenAI |
| LLM | Azure AI Foundry (gpt-4o-mini, text-embedding-3-small) |
| DB | PostgreSQL 16 + pgvector |
| Cache | Redis 7 |
| Observability | Langfuse |

---

## Environment Requirements

| Dependency | Version |
|------------|---------|
| PostgreSQL 16 + pgvector | Required |
| Redis 7 | Required |
| Azure AI Foundry (LLM + embeddings) | Required |
| Bun | 1.0+ |
| Python | 3.12+ |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-08 | Initial PRD with complete requirements |
