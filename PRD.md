# Smart Commerce Agent - Product Requirements

## Overview
Agentic e-commerce platform where AI agents handle product discovery, cart management, checkout, order tracking, and support via natural language + GenUI components.

## Vision
Hands-free commerce: agents hydrate context, plan multi-step tool chains, execute autonomously, and render their own UI. Users primarily confirm critical actions.

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

### GenUI Components
- ProductGrid - Display search results
- ProductCard - Individual product display
- CartDrawer - Shopping cart overlay
- ActionConfirm - Human-in-the-loop for critical actions

### Search & RAG
- Hybrid search (FTS + pgvector)
- Semantic caching
- Query transformation with NER

### Tools (MCP)
- Cart operations (add, update, remove)
- Product search and details
- Order management
- Checkout flow

## Success Metrics
- Agent turn latency P95 ≤ 4s
- Cart idempotency 100%
- Inventory oversell rate 0%

## Environment Requirements
- PostgreSQL 16 + pgvector
- Redis 7
- Azure AI Foundry (LLM + embeddings)
