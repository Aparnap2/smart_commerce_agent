# TASKS.md — Smart Commerce Agent

> This file is the source of truth for what's done, what's active, and what's next.
> The coding agent MUST update this file after completing any task.
> Last updated: 2026-03-03 - Phase 7 COMPLETE! 🎉

---

## ✅ Completed Phases

### Phase 1-2: Monorepo Scaffold
- [x] Turborepo + pnpm workspaces
- [x] Shared packages: @smart-commerce/types, @smart-commerce/errors

### Phase 3: commerce-api
- [x] Hono + GraphQL Yoga + MCP server
- [x] Prisma integration
- [x] Commit: 161c325f

### Phase 4: agent-core
- [x] FastAPI + Python LangGraph
- [x] classify + shopper + support agents
- [x] Commit: 254d451b

### Phase 5: Web Proxy Layer
- [x] /api/agent route (SSE to agent-core)
- [x] /api/copilotkit route
- [x] Deleted lib/agents/ + lib/llm/ (moved to agent-core)

### Phase 6: GenUI Components
- [x] ProductGrid, CartDrawer, ActionConfirm, OrderTimeline
- [x] Registered in chat.tsx with useCopilotAction
- [x] 18 component tests passing

### Phase 7: Docker + Makefile + Env
- [x] docker-compose.yml (4 services: postgres, redis, commerce-api, agent-core)
- [x] docker-compose.langfuse.yml (separate — optional)
- [x] Updated Dockerfiles for monorepo build context
- [x] .env.example with all required vars
- [x] Makefile with memory-safe targets
- [x] 9 docker-compose structure tests passing

---

## ⏳ Remaining Phases

### Phase 8: E2E Verification
- [ ] Full stack smoke test
- [ ] Playwright E2E tests

### Phase 9: Taste Vector
- [ ] pgvector embeddings for recommendations

### Phase 10: Stripe MCP Payment Flow
- [ ] checkout-wizard GenUI component

### Phase 11: Proactive Agent
- [ ] cx-proactive.ts port + cron triggers

### Phase 12: Rate Limiting + Circuit Breaker
- [ ] Proxy route protections

### Phase 13: Production Hardening
- [ ] Secrets management
- [ ] TLS
- [ ] Health dashboards

---

## 🐛 Known Issues

1. 88 pre-existing integration test failures (require running infrastructure)
2. UCP module exists — should be deleted (replaced by Stripe MCP)
3. RAG metrics in README showing old 44%/38%

---

## 📝 Architecture Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| Feb 21 | Dropped UCP, using Stripe MCP | UCP is custom/unknown, Stripe MCP is real + official |
| Feb 21 | Dropped Qdrant, pgvector only | Redundant infra, pgvector sufficient at portfolio scale |
| Feb 21 | LangGraph active (not disabled) | Agent orchestration is the core of the project |
| Feb 21 | Azure AI Foundry over Ollama | Production-ready, industry-standard |
| Feb 21 | TDD enforced via CLAUDE.md | Stops hallucination, ensures quality |
| Feb 21 | Real infra for all tests | No mocks for DB/Redis/LLM in integration tests |
| Mar 03 | Monorepo with 3 apps | Clean separation: web, commerce-api, agent-core |
**Goal**: Real working chat → DB → Azure AI Foundry pipeline

### Core Infrastructure
- [x] Verify Docker stack runs (`docker ps -a` shows 3 containers healthy)
  - ✅ smart-commerce-postgres (pgvector:pg16) - healthy
  - ✅ smart-commerce-redis (redis:7-alpine) - healthy
  - ✅ smart-commerce-langfuse (langfuse/latest) - running
- [x] Verify Azure AI Foundry responds (test with curl)
  - ✅ Model: gpt-oss-120b responding successfully
- [x] Prisma schema v1 (Customer, Product, Order, Cart, CartItem, Ticket)
  - ✅ 15 tables created successfully
- [x] Run migrations + seed 20 products
  - ✅ Migration: 20260221060801_init
  - ✅ 20 realistic products seeded (MacBook, Sony, iPhone, etc.)
- [x] pgvector HNSW index + tsvector trigger (migration.sql)
  - ✅ pgvector extension created
  - ✅ HNSW index created (manual SQL)
  - ✅ GIN index for full-text search created
- [x] Verify pgvector works: `SELECT vector_dims('[1,2,3]'::vector);`
  - ✅ Returns: 3 (pgvector working)

## ✅ Phase 2: LangGraph Agent - COMPLETE! 🎉

### LangGraph Agent (activate — don't disable)
- [x] `lib/agents/state.ts` — AgentState type with 14 intent types
  - ✅ Message, toolResults, uiComponents reducers
  - ✅ Entities, Sentiment, ToolResult, UIHint types
  - ✅ Tests: 7/7 passing
- [x] `lib/agents/nodes/classify.ts` — intent + entity extraction with Azure AI
  - ✅ 14 intent types supported
  - ✅ Entity extraction (products, prices, orderIds, emails)
  - ✅ Sentiment detection (positive, neutral, negative, frustrated)
  - ✅ Fallback to keyword classification on error
  - ✅ Tests: 11/11 passing
- [x] `lib/agents/supervisor.ts` — graph with routing logic
  - ✅ StateGraph assembly with 8 nodes
  - ✅ Intent-based routing (product_search → search_node, etc.)
  - ✅ State accumulation through workflow
  - ✅ Error handling with fallback
  - ✅ Tests: 10/10 passing
- [x] Test: classifyIntent("find wireless headphones") → intent="product_search"
  - ✅ Verified with mock Azure AI
- [x] Test: graph persists state across workflow
  - ✅ Messages accumulated
  - ✅ userId preserved

## ✅ Phase 3: MCP Tool Layer - COMPLETE! 🎉

### MCP Tool Layer
- [x] `lib/mcp/server.ts` — auth wrapper + Langfuse tracing
  - ✅ Tool registration system
  - ✅ User authentication (userId requirement)
  - ✅ Rate limiting interface
  - ✅ Zod argument validation
  - ✅ Langfuse tracing integration
  - ✅ Error handling
  - ✅ Execution metadata (timing, userId, traced)
  - ✅ Tests: 17/17 passing
- [x] `lib/mcp/tools.ts` — existing tools integrated with server
- [ ] Test: catalog.search with userId enforced (no userId → UNAUTHORIZED)
- [ ] Test: cart.add_item with real Docker Postgres

---

## 🟡 Phase 2: Search Pipeline (Week 1-2)
**Goal**: Hybrid FTS + pgvector search with Azure embeddings

### RAG Enhancements (IMPLEMENTED - needs integration)
- [x] `lib/rag/semantic-chunker.ts` — semantic chunking with similarity merging
- [x] `lib/rag/reranker.ts` — cross-encoder reranking
- [x] `lib/rag/query-transform.ts` — query rewriting + HyDE
- [x] `lib/rag/semantic-cache.ts` — Redis-backed semantic cache
- [ ] Integrate semantic chunking into `indexDocument`
- [ ] Wire reranker into `ragQuery`
- [ ] Hook query transforms into MCP tools

### Search Implementation
- [ ] `lib/search/embeddings.ts` — Azure text-embedding-3-small
- [ ] `lib/search/hybrid.ts` — FTS candidates → pgvector rerank
- [ ] Test: hybridSearch("wireless headphones") returns ranked results
- [ ] Test: FTS fallback when query returns 0 semantic matches
- [ ] Test: filter by maxPrice works at SQL level (not post-filter)
- [ ] Semantic cache in Redis (5min TTL)
- [ ] Test: second identical search hits Redis cache

---

## 🟡 Phase 3: Cart + Checkout (Week 2)
**Goal**: Full cart cycle + Stripe MCP checkout

### Cart MCP Tools
- [ ] cart.get, cart.add_item, cart.update_quantity, cart.remove_item, cart.clear
- [ ] Idempotency: adding same product twice updates quantity (not duplicate row)
- [ ] Test: cart total recalculated correctly after update
- [ ] Test: remove last item → empty cart (not null cart)

### Stripe MCP Integration
- [ ] `lib/payments/stripe-mcp.ts` — toolkit init
- [ ] `lib/payments/idempotency.ts` — key generation + Redis storage
- [ ] checkout.start MCP tool → Stripe payment intent via toolkit
- [ ] Test: idempotency key prevents duplicate payment intents
- [ ] Test: Stripe webhook → order.create_from_cart → order in DB
- [ ] Add stripe-mcp container to docker-compose.dev.yml

---

## 🟡 Phase 4: GenUI + CopilotKit (Week 2-3)
**Goal**: Agent renders React components, not markdown

### shadcn Components
- [x] ProductCard — existing in app/dashboard/components/genui/
- [x] OrderCard — existing
- [x] TicketStatus — existing
- [ ] ProductGrid — grid of ProductCards with add-to-cart
- [ ] CartDrawer — slide-in cart with quantity controls
- [ ] CheckoutWizard — Stripe Elements embedded
- [ ] OrderConfirmation — post-purchase summary
- [ ] OrderTracking — status timeline

### CopilotKit Actions
- [ ] useCopilotAction("catalog.search") → renders <ProductGrid />
- [ ] useCopilotAction("cart.add_item") → renders <CartUpdated />
- [ ] useCopilotAction("checkout.start") → renders <CheckoutWizard />
- [ ] useCopilotReadable: expose cart + visible products to agent

---

## 🟡 Phase 5: Orders + Support (Week 3)
- [ ] orders.list, orders.get, orders.track MCP tools
- [ ] support.create_ticket, support.get_ticket MCP tools
- [ ] LangGraph refund_node → Stripe MCP refunds.create
- [ ] Azure Language NER on support tickets (sentiment tagging)

---

## 🟡 Phase 6: Observability + Evals (Week 3-4)
**Goal**: RAGAS scores ≥ 70% relevancy, ≥ 75% faithfulness

### Observability
- [x] `lib/observability/rag-trace.ts` — per-span RAG tracing
- [x] `lib/observability/llm-judge.ts` — LLM-as-judge scoring
- [ ] Per-span Langfuse tracing: classify → search → rerank → generate
- [ ] `scripts/llm_eval.py` — RAGAS metrics (replace current 44%/38% scores)
- [ ] Azure Content Safety on LLM outputs
- [ ] Target metrics: relevancy >70%, faithfulness >75%

---

## 🟡 Phase 7: Azure AI Services (Week 4)
- [ ] Azure Language NER on search queries (enrich before FTS)
- [ ] Azure SignalR for real-time cart updates
- [ ] Azure Event Grid for order.placed → async workers
- [ ] Azure Functions: price alerts, abandoned cart, inventory

---

## ✅ Completed

### Infrastructure
- [x] Removed Supabase client files
- [x] Azure AI Foundry .env configured
- [x] docker-compose.dev.yml created (PostgreSQL + Redis + Langfuse)
- [x] Prisma adapter for local Postgres
- [x] HLD + LLD documented

### RAG Enhancements (IMPLEMENTED)
- [x] Semantic chunking with similarity merging (22 tests passing)
- [x] Cross-encoder reranker (15 tests passing)
- [x] Query transformation (rewriting + HyDE)
- [x] Semantic cache with Redis

### Guardrails (IMPLEMENTED)
- [x] Pydantic schemas for validation
- [x] LangChain guard chains
- [x] DSPy signatures for optimization
- [x] PII, toxicity, jailbreak detection (24 tests passing)

### MCP Tools (IMPLEMENTED)
- [x] Cart tools (update_quantity, remove_item, clear, apply_coupon)
- [x] Checkout tool (checkout.create)
- [x] Order tools (create_from_cart, cancel)

### Testing
- [x] 61 unit tests passing
- [x] 22 integration tests passing
- [x] Test files created for all new modules

### Documentation
- [x] CLAUDE.md — agent instructions
- [x] AGENTS.md — architecture context
- [x] TASKS.md — living task board
- [x] TRANSFORMATION_REPORT.md — gaps analysis
- [x] IMPLEMENTATION_COMPLETE_SUMMARY.md

---

## 🐛 Known Issues / Blockers

1. **App won't start** — Supabase middleware blocking (needs removal or mock)
2. **LangGraph disabled** — routes temporarily disabled, need activation
3. **RAG metrics in README** — showing old 44%/38% (needs update after integration)
4. **UCP module exists** — should be deleted (replaced by Stripe MCP)

---

## 📝 Architecture Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| Feb 21 | Dropped UCP, using Stripe MCP | UCP is custom/unknown, Stripe MCP is real + official |
| Feb 21 | Dropped Qdrant, pgvector only | Redundant infra, pgvector sufficient at portfolio scale |
| Feb 21 | LangGraph active (not disabled) | Agent orchestration is the core of the project |
| Feb 21 | Azure AI Foundry over Ollama | Production-ready, industry-standard |
| Feb 21 | TDD enforced via CLAUDE.md | Stops hallucination, ensures quality |
| Feb 21 | Real infra for all tests | No mocks for DB/Redis/LLM in integration tests |
