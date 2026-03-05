# Smart Commerce Agent - Product Requirements Document

## Overview
Production-grade agentic e-commerce CX platform. AI agents handle product discovery, cart management, checkout, order tracking, and support via natural language + GenUI components.

## Vision
**AI-First Commerce**: The interface is a single conversation surface where the agent is the navigation. GenUI components (Product Grids, Carts, Checkouts) are first-class content rendered inline at full width, eliminating the cognitive split of sidebars or tabbed navigation. The agent autonomously plans, executes, and brings the view to the user.

## Architecture
3-service monorepo:
- **apps/web**: Next.js 15 frontend with GenUI canvas
- **apps/commerce-api**: Hono + Bun, GraphQL Yoga, Prisma JS
- **apps/agent-core**: FastAPI + Python, LangGraph, Azure AI Foundry

## Personas
- **Shopper**: Product discovery, cart management, checkout, order tracking
- **Merchant**: Inventory monitoring, listing management, analytics
- **Support**: Ticket resolution, refunds, policy RAG

## Core Features

### Agent System
- LangGraph supervisor with typed state
- ShopperAgent for discovery/cart/checkout
- SupportAgent for refunds/tickets
- Redis checkpointing for state persistence
- Circuit breaker for resilience
- Human-in-the-loop for critical actions

### GenUI Components (Inline & Full-Width)
- **ProductGrid** - Horizontal scroll-snap grid for search results (full width).
- **ProductCard** - High-fidelity individual product display with blur placeholders.
- **CartCanvas** - Inline shopping cart management (replaces traditional overlays).
- **ActionConfirm** - High-consequence authorization card (e.g., checkout placement).
- **OrderTimeline** - Interactive vertical stepper for tracking.

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

## Key Design Decisions

1. **Agent-core NEVER queries DB directly** except for AgentNotification inserts
2. **No ORM in Python** — raw asyncpg for 1-2 direct writes only
3. **Prisma migrate owns ALL migrations** — never alembic
4. **GraphQL Yoga exposed as MCP HTTP endpoints** to agent-core
5. **Custom JWT auth** — not Supabase, not Entra B2C
6. **Azure AI Foundry ONLY** — no Ollama, no Google, no OpenAI direct
7. **Stripe MCP Agent Toolkit** — no raw stripe SDK for payments
8. **pgvector 1536-dim** — no Qdrant

## Success Metrics
- Agent turn latency P95 ≤ 4s
- Cart idempotency 100%
- Inventory oversell rate 0%

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

## Environment Requirements
- PostgreSQL 16 + pgvector
- Redis 7
- Azure AI Foundry (LLM + embeddings)
- Bun 1.0+
- Python 3.12+
