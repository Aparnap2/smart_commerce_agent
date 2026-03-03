# Smart Commerce Agent - Product Requirements Document

## Overview
Production-grade agentic e-commerce CX platform. AI agents handle product discovery, cart management, checkout, order tracking, and support via natural language + GenUI components.

## Vision
Hands-free commerce: agents hydrate context, plan multi-step tool chains, execute autonomously, and render their own UI. Users primarily confirm critical actions.

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

### GenUI Components
- ProductGrid - Display search results
- ProductCard - Individual product display
- CartDrawer - Shopping cart overlay
- ActionConfirm - Human-in-the-loop for critical actions
- OrderTimeline - Order status visualization

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
