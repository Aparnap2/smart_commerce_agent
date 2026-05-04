# ProcureAI - B2B Internal Procurement Platform

[![Tests](https://img.shields.io/badge/tests-307%20total-green)]()
[![Pass Rate](https://img.shields.io/badge/pass%20rate-100%25-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/types-strict-blue)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()

> **Production-grade B2B internal procurement platform** — AI agents handle purchase requests, manager approvals, budget tracking, and procurement support via natural language + Generative UI components.

---

## Core Design Principles

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **AGENT-FIRST** | Every user action is a conversation turn, not page navigation | LangGraph supervisor routes 14 intent types to specialized agents |
| **FAIL-SAFE** | Every PR requires manager approval, every tool is idempotent | Idempotency keys in Redis, audit trail for all state changes |
| **STATELESS COMPUTE** | Container Apps scale to zero, state in PostgreSQL + Redis only | Azure Container Apps, Prisma migrations, Redis checkpoints |
| **OBSERVABLE BY DEFAULT** | Every agent turn traced in Langfuse | Per-span tracing, LLM-as-Judge scoring, RAGAS metrics |

---

## System Architecture

### Tier 1: High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  apps/web/ → Next.js 15 Chat-First Canvas (no navigation tabs)      │    │
│  │  - Shell using 100dvh CSS Grid (Rail + Chat Column)                 │    │
│  │  - Virtualized anchor scroll for high-performance streaming         │    │
│  │  - Generative UI components (CatalogGrid, PRDraft, PRHistory)        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  /api/chat       │  │  /api/agent      │  │  /api/copilotkit         │  │
│  │  (OpenAI SDK)    │  │  (LangGraph)     │  │  (GenUI actions)         │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌─────────────────────────────┐     ┌─────────────────────────────────────────┐
│   apps/commerce-api/        │     │   apps/agent-core/                      │
│   Hono + Bun                │     │   FastAPI + Python                      │
│   GraphQL Yoga              │     │   LangGraph agents                      │
│   MCP HTTP endpoints        │◄────│   GraphQL tool → commerce-api           │
│   Prisma JS                 │     │   asyncpg (notifications only)          │
└─────────────────────────────┘     └─────────────────────────────────────────┘

#### agent-core Performance Optimizations

| Optimization | Implementation |
|--------------|----------------|
| **Singletons** | DB pool, LLM, Redis initialized once at startup via `lifespan` |
| **Payload Trimming** | LLM sees minimal fields (4), UI gets full data (14 fields) |
| **Static Prompt Caching** | 1024+ token static prefix cached, dynamic user context at end |
| **History Summarization** | Compresses 5+ message history into 3-sentence summary |
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHARED LAYER                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  prisma/ → Single schema.prisma (Prisma JS only)                    │    │
│  │  packages/types/ → Shared TS interfaces                             │    │
│  │  packages/errors/ → CommerceError (TS + Python mirror)              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │
│  │ PostgreSQL  │  │ Redis 7     │  │ Langfuse    │  │ Azure AI        │    │
│  │ 16 + pgvector│ │ (Cache)     │  │ (Tracing)   │  │ Foundry         │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tier 2: Fault Tolerance

```
┌──────────────────────────────────────────────────────────────┐
│                    RESILIENCE PATTERNS                        │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────┐    ┌────────────────┐    ┌────────────┐ │
│  │ Circuit Breaker│    │ Retry (3x)     │    │ Fallback   │ │
│  │ (Redis state)  │    │ Exponential    │    │ (Keyword   │ │
│  │                │    │ Backoff        │    │ classify)  │ │
│  └────────────────┘    └────────────────┘    └────────────┘ │
│                                                              │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────┐ │
│  │ Idempotency    │    │ Timeout        │    │ Dead Letter│ │
│  │ (Redis keys)   │    │ (30s LLM)      │    │ Queue      │ │
│  └────────────────┘    └────────────────┘    └────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### Tier 3: Concurrency Model

```
┌──────────────────────────────────────────────────────────────┐
│                 ASYNC PROCESSING FLOW                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User Request → API Route → LangGraph Graph                  │
│       │              │              │                        │
│       │              │              ├─→ classify_intent      │
│       │              │              ├─→ generate_tool_calls  │
│       │              │              ├─→ tools (parallel)     │
│       │              │              └─→ generate_response    │
│       │              │                                      │
│       │              └─→ SSE Stream ←───────────────────────│
│       │                                                      │
│       └─→ GenUI Component Render                             │
│                                                              │
│  Background Jobs (Celery):                                   │
│  - Email notifications                                       │
│  - Inventory sync                                            │
│  - Vector embedding generation                               │
└──────────────────────────────────────────────────────────────┘
```

### Tier 4: Data Model

```
┌──────────────────────────────────────────────────────────────┐
│                   POSTGRESQL SCHEMA                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌────────────┐│
│  │ Employee     │◄─────│ PurchaseOrder│─────►│ POItem     ││
│  │ - id         │      │ - id         │      │ - id       ││
│  │ - email      │      │ - employeeId │      │ - poId     ││
│  │ - name       │      │ - total      │      │ - itemId   ││
│  │ - department │      │ - status     │      │ - quantity ││
│  │ - managerId  │      │ - approval   │      └────────────┘│
│  └──────────────┘      │ - embeddings │                     │
│         │              └──────────────┘                     │
│         │                       │                           │
│         ▼                       ▼                           │
│  ┌──────────────┐      ┌──────────────┐      ┌────────────┐│
│  │ SupportTicket│      │ CatalogItem  │      │ PRDraft    ││
│  │ - id         │      │ - id         │      │ - id       ││
│  │ - employeeId │      │ - name       │      │ - employeeId││
│  │ - status     │      │ - price      │      │ - items    ││
│  │ - sentiment  │      │ - embeddings │      │ - total    ││
│  └──────────────┘      │ - category   │      │ - budgetId ││
│                        └──────────────┘      └────────────┘│
│                                                              │
│  Vector Tables (pgvector 1536-dim):                          │
│  - catalog_embeddings (HNSW index)                          │
│  - document_chunks (GIN + vector)                           │
└──────────────────────────────────────────────────────────────┘
```
┌──────────────────────────────────────────────────────────────┐
│                   POSTGRESQL SCHEMA                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌────────────┐│
│  │ Customer     │◄─────│ Order        │─────►│ OrderItem  ││
│  │ - id         │      │ - id         │      │ - id       ││
│  │ - email      │      │ - customerId │      │ - orderId  ││
│  │ - name       │      │ - total      │      │ - productId││
│  └──────────────┘      │ - status     │      │ - quantity ││
│         │              │ - embeddings │      └────────────┘│
│         │              └──────────────┘                     │
│         │                       │                           │
│         ▼                       ▼                           │
│  ┌──────────────┐      ┌──────────────┐      ┌────────────┐│
│  │ SupportTicket│      │ Product      │      │ Cart       ││
│  │ - id         │      │ - id         │      │ - id       ││
│  │ - customerId │      │ - name       │      │ - customerId││
│  │ - status     │      │ - price      │      │ - items    ││
│  │ - sentiment  │      │ - embeddings │      │ - total    ││
│  └──────────────┘      │ - stock      │      └────────────┘│
│                        └──────────────┘                     │
│                                                              │
│  Vector Tables (pgvector 1536-dim):                          │
│  - product_embeddings (HNSW index)                           │
│  - document_chunks (GIN + vector)                            │
└──────────────────────────────────────────────────────────────┘
```

### Tier 5: Request Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CONVERSATION TURN FLOW                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User Message                                                         │
│     │                                                                    │
│     ▼                                                                    │
│  2. classify_intent (LLM) ──→ Intent: pr_create                           │
│     │                               Entities: ["laptop", "3 units"]       │
│     │                               Sentiment: neutral                   │
│     ▼                                                                    │
│  3. shouldUseTools? ──→ YES                                              │
│     │                                                                    │
│     ▼                                                                    │
│  4. generate_tool_calls ──→ [catalog.search(query="laptop"),             │
│                              budget.check(department="engineering")]      │
│     │                                                                    │
│     ▼                                                                    │
│  5. tools (ToolNode) ──→ Prisma query → 8 items                          │
│     │                               Redis cache set (5min)               │
│     ▼                                                                    │
│  6. generate_response (LLM) ──→ "Found 8 laptops in catalog..."          │
│     │                                + GenUI: <CatalogGrid items={8}/>  │
│     ▼                                                                    │
│  7. Stream via SSE ──→ Client renders message + component                │
│     │                                                                    │
│     ▼                                                                    │
│  8. Langfuse Trace ──→ Span: classify (234ms)                            │
│                        Span: tools (89ms)                                │
│                        Span: generate (1.2s)                            │
│                        Score: faithfulness=0.92                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CONVERSATION TURN FLOW                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User Message                                                         │
│     │                                                                    │
│     ▼                                                                    │
│  2. classify_intent (LLM) ──→ Intent: product_search                     │
│     │                               Entities: ["wireless headphones"]    │
│     │                               Sentiment: neutral                   │
│     ▼                                                                    │
│  3. shouldUseTools? ──→ YES                                              │
│     │                                                                    │
│     ▼                                                                    │
│  4. generate_tool_calls ──→ [catalog.search(query="wireless headphones")]│
│     │                                                                    │
│     ▼                                                                    │
│  5. tools (ToolNode) ──→ Prisma query → 12 products                      │
│     │                               Redis cache set (5min)               │
│     ▼                                                                    │
│  6. generate_response (LLM) ──→ "Found 12 wireless headphones..."        │
│     │                                + GenUI: <ProductGrid items={12}/>  │
│     ▼                                                                    │
│  7. Stream via SSE ──→ Client renders message + component                │
│     │                                                                    │
│     ▼                                                                    │
│  8. Langfuse Trace ──→ Span: classify (234ms)                            │
│                        Span: tools (89ms)                                │
│                        Span: generate (1.2s)                             │
│                        Score: faithfulness=0.92                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tier 6: Scalability Strategy

```
┌──────────────────────────────────────────────────────────────┐
│              HORIZONTAL SCALING APPROACH                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Tier          Component          Scale Strategy            │
│  ─────────────────────────────────────────────────────────  │
│  Frontend      Next.js            Vercel (auto-scale)       │
│  API Gateway   Hono               Azure Container Apps      │
│  Agent Core    FastAPI            Azure Container Apps      │
│  Database      PostgreSQL         Azure DB (read replicas)  │
│  Cache         Redis              Azure Cache (cluster)     │
│  Vector        pgvector           Horizontal partitioning   │
│  LLM           Azure AI           Rate limit + queue        │
│                                                              │
│  Bottleneck Mitigation:                                      │
│  - LLM calls: Semantic cache (Redis, 5min TTL)              │
│  - DB queries: Connection pool (PgBouncer)                  │
│  - Vector search: HNSW index + candidate limit              │
│  - Agent state: Redis checkpoints (shared)                  │
└──────────────────────────────────────────────────────────────┘
```

### Tier 7: Security Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  SECURITY LAYERS                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Layer 1: Authentication                                │ │
│  │  - Custom JWT (HS256, 1h expiry)                        │ │
│  │  - Refresh tokens (7d, Redis blacklist)                 │ │
│  │  - OAuth 2.0 (Google, GitHub)                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Layer 2: Authorization                                 │ │
│  │  - Role-based (employee, manager, procurement, admin)    │ │
│  │  - Resource-level (userId + department checks)          │ │
│  │  - Idempotency keys (prevent replay)                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Layer 3: Input Validation                              │ │
│  │  - Zod schemas (frontend)                               │ │
│  │  - Pydantic models (backend)                            │ │
│  │  - SQL injection prevention (Prisma params)             │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Layer 4: Content Safety                                │ │
│  │  - PII detection (email, phone, CC, SSN)                │ │
│  │  - Toxicity filtering                                   │ │
│  │  - Jailbreak prevention                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Layer 5: Infrastructure                                │ │
│  │  - CORS (whitelisted origins)                           │ │
│  │  - Rate limiting (Redis, sliding window)                │ │
│  │  - CSP headers                                          │ │
│  │  - TLS 1.3 (enforced)                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## B2B Procurement Workflow

### Purchase Request (PR) Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PURCHASE REQUEST LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐    ┌─────────┐    ┌──────────┐    ┌─────────┐           │
│  │ PRDraft │───►│ Submitted│───►│ Pending  │───►│ Approved│           │
│  │         │    │          │    │ Approval │    │         │           │
│  └─────────┘    └─────────┘    └──────────┘    └─────────┘           │
│       │               │               │               │                │
│       ▼               ▼               ▼               ▼                │
│  - Employee       - Manager       - Budget        - PO Created         │
│    adds items      notified       check                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Approval Routing

| Role | Permissions |
|------|-------------|
| **Employee** | Create PR, view own PRs, cancel draft |
| **Manager** | Approve/reject PRs for direct reports |
| **Procurement** | Approve high-value PRs, manage vendors |
| **Admin** | All permissions, manage departments |

- Single approver per department (employee's manager)
- Auto-escalation after 48h to department head
- Approval via chat or dashboard

### Budget Management

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUDGET TRACKING                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Department Budget:                                           │
│  - monthlyLimit: $50,000                                      │
│  - spentThisMonth: $12,500                                    │
│  - pendingApproval: $8,000                                    │
│  - available: $29,500                                         │
│                                                                 │
│  PR Approval Logic:                                            │
│  - <$1,000: Auto-approved                                      │
│  - $1,000-$10,000: Manager approval                           │
│  - >$10,000: Manager + Procurement sign-off                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Notification System (Redis Pub/Sub)

| Event | Channel | Subscribers |
|-------|---------|-------------|
| PR Submitted | `pr:{department}:new` | Manager |
| PR Approved | `pr:{employee}:approved` | Employee |
| PR Rejected | `pr:{employee}:rejected` | Employee |
| Budget Alert | `budget:{department}:alert` | Procurement |
| PO Created | `po:{vendor}:created` | Procurement |

- Redis pub/sub for real-time notifications
- WebSocket fallback for offline employees
- Email digest for summary (configurable)

---

## Local Development

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | TypeScript runtime |
| pnpm | 8+ | Package manager |
| Bun | 1.0+ | Hono runtime |
| Python | 3.12+ | LangGraph agents |
| uv | 0.1+ | Python package manager |
| Docker | 24+ | Infrastructure containers |

### Step 1: Clone & Install

```bash
# Clone repository
git clone https://github.com/your-org/vercel-ai-sdk.git
cd vercel-ai-sdk

# Install dependencies
pnpm install

# Install Python dependencies (agent-core)
cd apps/agent-core && uv sync && cd ../..
```

### Step 2: Environment Configuration

Create `.env.local` at project root:

```bash
# ── Database ─────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_commerce

# ── Redis ────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Authentication ───────────────────────────────────────────
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# ── Service URLs ─────────────────────────────────────────────
AGENT_CORE_URL=http://localhost:8000
COMMERCE_API_URL=http://localhost:3001

# ── LLM Provider (Azure AI Foundry) ─────────────────────────
# Swap providers by changing these — zero code changes
OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/v1
OPENAI_API_KEY=your-azure-api-key
OPENAI_MODEL=gpt-oss-120b
OPENAI_API_VERSION=2024-10-21

# ── Embeddings ───────────────────────────────────────────────
EMBEDDING_MODEL=text-embedding-3-small

# ── Langfuse (Observability) ────────────────────────────────
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_BASE_URL=http://localhost:3003

# ── Langfuse Docker (optional) ──────────────────────────────
LANGFUSE_NEXTAUTH_SECRET=dev-secret
```

### Step 3: Start Infrastructure (Sequential, One at a Time)

> **Why Sequential?** To prevent PC heating and reduce RAM usage, containers are started **one at a time**, tested, then kept running. Only one container runs during setup.

```bash
# Start PostgreSQL first (required for all services)
make start-postgres

# Test PostgreSQL (starts → tests → stops)
make test-postgres
# Expected: PostgreSQL 16.x

# Start Redis (with PostgreSQL still running)
make start-redis

# Test Redis (starts → tests → stops)
make test-redis
# Expected: PONG

# Start Langfuse (optional — high memory usage, creates DB first)
make start-langfuse

# Test Langfuse (starts → tests → stops)
make test-langfuse
# Expected: Langfuse health check passed
```

### Step 4: Database Setup

```bash
# Run migrations (requires PostgreSQL running)
make db-migrate

# Seed database (20 products)
make db-seed

# Open Prisma Studio (optional)
make db-studio
```

### Step 5: Start Services

**Local development** (recommended for coding)

```bash
# Terminal 1: Commerce API
make dev-api

# Terminal 2: Agent Core
make dev-agent

# Terminal 3: Web Frontend
make dev-web
```

### Step 6: Verify Setup

```bash
# Check service health (all must be running)
make health

# Expected output:
# ✅ commerce-api :3001
# ✅ agent-core   :8000

# Run agent briefing (full system status)
make agent-briefing
```

---

## Sequential Container Startup (One at a Time)

To prevent PC heating, containers are started **one at a time**, tested, then stopped before starting the next.

### Step 1: Start PostgreSQL (Required First)

```bash
make start-postgres
# Or: ./scripts/start-postgres.sh

# Test PostgreSQL
make test-postgres
# Runs: SELECT version(); then stops container

# Keep PostgreSQL running for development:
# (Don't run stop-postgres yet)
```

### Step 2: Start Redis (With PostgreSQL Running)

```bash
make start-redis
# Or: ./scripts/start-redis.sh

# Test Redis
make test-redis
# Runs: redis-cli ping; then stops container

# Keep Redis running for development
```

### Step 3: Start Langfuse (Optional, Requires PostgreSQL)

```bash
make start-langfuse
# This will:
# 1. Start PostgreSQL temporarily
# 2. Create langfuse database
# 3. Stop PostgreSQL
# 4. Start Langfuse

# Test Langfuse
make test-langfuse
```

### Daily Development Workflow

```bash
# Morning: Start all needed containers (sequentially)
make start-postgres
make start-redis
# (Optional) make start-langfuse

# Start Next.js app
pnpm dev

# Check individual container health
make health-postgres
make health-redis
make health-langfuse

# Evening: Stop containers one by one (or all at once)
make stop-postgres
make stop-redis
make stop-langfuse
# Or: make clean-all (stops all)
```

### Sequential Testing (All Containers, One at a Time)

```bash
# This will:
# 1. Start PostgreSQL → Test → Stop
# 2. Start Redis → Test → Stop
# 3. Start Langfuse → Test → Stop
make test-all-sequential
```

### Individual Container Commands

| Command | Description |
|---------|-------------|
| `make start-postgres` | Start PostgreSQL + pgvector |
| `make stop-postgres` | Stop and remove PostgreSQL |
| `make test-postgres` | Start → Test version() → Stop |
| `make start-redis` | Start Redis |
| `make stop-redis` | Stop and remove Redis |
| `make test-redis` | Start → Test ping → Stop |
| `make start-langfuse` | Start Langfuse (creates DB first) |
| `make stop-langfuse` | Stop and remove Langfuse |
| `make test-langfuse` | Start → Test health → Stop |
| `make clean-all` | Stop all containers |
| `make health` | Check health of all (shows which are running) |

### Resource Usage

**Only ONE container runs at a time:**

| Container | RAM Usage |
|-----------|-----------|
| PostgreSQL | ~500MB |
| Redis | ~50MB |
| Langfuse | ~800MB |

**Typical development setup:**
- PostgreSQL + Redis running: ~550MB RAM
- Add Langfuse (optional): ~1.35GB RAM total

**To minimize heating:**
1. Only run containers you need
2. Stop containers when not coding: `make clean-all`
3. Use `make test-all-sequential` for testing (runs one at a time)

---

### Makefile Commands

```bash
# Infrastructure (Sequential)
make start-postgres    # Start PostgreSQL + pgvector
make stop-postgres     # Stop PostgreSQL
make start-redis       # Start Redis
make stop-redis        # Stop Redis
make start-langfuse    # Start Langfuse (creates DB)
make stop-langfuse     # Stop Langfuse
make clean-all         # Stop all containers

# Testing (Sequential, One at a Time)
make test-postgres     # Start → Test → Stop
make test-redis        # Start → Test → Stop
make test-langfuse     # Start → Test → Stop
make test-all-sequential # Run all tests sequentially

# Development
make dev-web           # Start Next.js frontend (:3000)
make dev-api           # Start Hono commerce-api (:3001)
make dev-agent         # Start FastAPI agent-core (:8000)

# Full Test Suite
make test-all          # Run all unit tests
make e2e-test          # Run E2E tests (requires all services)
make test-web          # Web tests only
make test-api          # API tests only
make test-agent        # Agent tests only

# Database
make db-migrate        # Prisma migrate dev
make db-seed           # Seed database
make db-reset          # Reset + seed
make db-studio         # Prisma Studio GUI

# Health Checks
make health            # Check all services
make health-postgres   # Check PostgreSQL
make health-redis      # Check Redis
make health-langfuse   # Check Langfuse

# Cleanup
make clean             # Remove __pycache__, .next
make prune             # Docker system prune
```

---

## Testing Strategy

### Test Pyramid

```
                         ┌─────────────┐
                         │    E2E      │  ← Playwright (Full flows)
                         │   Tests     │  Target: 10+ scenarios
                         └──────┬──────┘
                                │
                    ┌───────────┴───────────┐
                    │   Integration Tests   │  ← Real Docker containers
                    │   (API + Tool)        │  Target: 50+ tests
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │              Unit Tests                        │  ← Pure functions
        │        (Vitest + pytest + Mocks)              │  Target: 200+ tests
        └───────────────────────────────────────────────┘
```

### Layer 1: Unit Tests

**Purpose**: Test pure functions, tools, and utilities in isolation.

| Framework | Location | Command | Coverage |
|-----------|----------|---------|----------|
| Vitest | `apps/web/tests/unit/` | `pnpm vitest run` | TypeScript |
| pytest | `apps/agent-core/tests/` | `pytest` | Python |

**Test Categories**:
- **Agent State** (`state.test.ts`): Reducer logic, state transitions
- **Intent Classification** (`classify.test.ts`): 14 intent types, entity extraction
- **MCP Tools** (`server.test.ts`): Auth, rate limiting, validation
- **RAG Core** (`semantic-chunker.test.ts`, `reranker.test.ts`): Chunking, scoring
- **Guardrails** (`guardrails.test.ts`): PII, toxicity, jailbreak detection

**Target Metrics**:
- ✅ >90% code coverage on new code
- ✅ Zero `any` types in TypeScript tests
- ✅ All tests pass with `mypy --strict` and `tsc --noEmit`

### Layer 2: Integration Tests

**Purpose**: Test API endpoints, database operations, and tool execution with real infrastructure.

| Framework | Location | Command | Infrastructure |
|-----------|----------|---------|----------------|
| Vitest | `apps/web/tests/integration/` | `pnpm vitest run tests/integration/` | Docker postgres, redis |
| pytest | `apps/agent-core/tests/integration/` | `pytest tests/integration/` | Docker postgres, redis |

**Test Scenarios**:
- Database CRUD operations (Prisma)
- Redis caching and checkpoints
- GraphQL queries and mutations
- MCP tool execution with auth
- Vector search with pgvector

**Target Metrics**:
- ✅ All tests pass with real Docker containers
- ✅ No mocked database calls
- ✅ Idempotency verified (duplicate requests handled)

### Layer 3: E2E Tests

**Purpose**: Test full user flows from frontend to database.

| Framework | Location | Command | Output |
|-----------|----------|---------|--------|
| Playwright | `apps/web/tests/e2e/` | `pnpm test:e2e` | Screenshots, videos |

**Test Scenarios**:
1. **Catalog Search**: Search → View results → Add to PR draft
2. **PR Draft Management**: Add items → Update quantity → Remove → Submit
3. **Approval Flow**: Submit PR → Manager approval → Budget check → PO created
4. **PR History**: View PRs → Track approval status
5. **Support Ticket**: Create ticket → Agent response → Resolution

**Target Metrics**:
- ✅ All critical paths covered
- ✅ Video recording on failure
- ✅ Visual regression testing

### LLM Evaluations

**Purpose**: Evaluate agent response quality, tool selection accuracy, and context retention.

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Tool Selection Accuracy** | >90% | Correct tool chosen for intent |
| **Parameter Extraction** | >95% | Entities extracted correctly |
| **Context Retention** | >90% | Previous turns remembered |
| **Hallucination Rate** | 0% | No fabricated information |
| **Response Relevance** | >70% | RAGAS relevancy score |
| **Faithfulness** | >75% | RAGAS faithfulness score |

**Evaluation Pipeline**:
```
User Query → Agent Response → LLM-as-Judge → Score (0-1)
                                      ↓
                              Langfuse Dashboard
```

**Tools**:
- **Langfuse**: Per-span tracing, scoring dashboards
- **RAGAS**: Industry-standard RAG metrics
- **LLM-as-Judge**: Custom evaluation prompts

### Running Tests

```bash
# Full test suite
make test-all

# With coverage
pnpm vitest run --coverage
pytest --cov=apps/agent-core

# Specific test file
pnpm vitest run tests/unit/rag/semantic-chunker.test.ts
pytest apps/agent-core/tests/test_classify.py -v

# E2E tests (requires all services running)
make e2e-test

# LLM evaluation script
python scripts/llm_eval.py
```

### Test Evidence Requirements

Per our **Gatekeeper Protocol**, all test claims must include evidence:

```bash
# Example: Running unit tests
$ pnpm vitest run tests/unit/

 RUN  v1.6.0 /home/aparna/Desktop/vercel-ai-sdk

 ✓ tests/unit/agents/state.test.ts (7)
 ✓ tests/unit/agents/classify.test.ts (11)
 ✓ tests/unit/agents/supervisor.test.ts (10)
 ✓ tests/unit/mcp/server.test.ts (17)
 ✓ tests/unit/rag/semantic-chunker.test.ts (22)
 ✓ tests/unit/rag/reranker.test.ts (15)
 ✓ tests/unit/guardrails.test.ts (24)

 Test Files  7 passed (7)
      Tests  106 passed (106)
   Start at  10:30:45
   Duration  2.34s (transform: 890ms, setup: 120ms, collect: 1.8s, tests: 234ms)

✅ 106/106 tests passing (100%)
```

---

## Production Readiness

### Ship Criteria Checklist

Before deploying to production, verify all items below:

#### 1. Infrastructure ✅

- [ ] PostgreSQL 16 + pgvector deployed (Azure DB or Neon)
- [ ] Redis 7 cluster configured (Azure Cache or Upstash)
- [ ] Container Apps configured (Azure or Fly.io)
- [ ] Connection pooling enabled (PgBouncer)
- [ ] Health checks passing (all services)
- [ ] Auto-scaling rules defined (CPU >70%, Memory >80%)

#### 2. Security ✅

- [ ] JWT secrets rotated (min 32 chars, cryptographically random)
- [ ] TLS 1.3 enforced (no HTTP fallback)
- [ ] CORS whitelist configured (production domains only)
- [ ] Rate limiting active (100 req/min per user)
- [ ] PII detection enabled (guardrails active)
- [ ] SQL injection prevention verified (Prisma params only)
- [ ] CSP headers configured
- [ ] Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)

#### 3. Observability ✅

- [ ] Langfuse connected (traces visible)
- [ ] Per-span tracing enabled (classify, tools, generate)
- [ ] LLM-as-Judge scoring active
- [ ] RAGAS metrics tracked (relevancy, faithfulness)
- [ ] Error alerts configured (Slack/PagerDuty)
- [ ] Latency dashboards (P50, P95, P99)
- [ ] Cost tracking enabled (LLM token usage)

#### 4. Performance ✅

- [ ] Agent turn latency P95 ≤ 4s
- [ ] Semantic cache hit rate >50%
- [ ] Database query time <100ms (P95)
- [ ] Vector search <200ms (HNSW index)
- [ ] Frontend LCP <2.5s
- [ ] Frontend INP <200ms
- [ ] Frontend CLS <0.1

#### 5. Reliability ✅

- [ ] Circuit breaker configured (LLM calls)
- [ ] Retry logic active (3x, exponential backoff)
- [ ] Fallback classification (keyword-based)
- [ ] Idempotency keys enforced (all writes)
- [ ] Dead letter queue configured (failed jobs)
- [ ] Backup strategy (daily DB snapshots)
- [ ] Disaster recovery plan documented

#### 6. Testing ✅

- [ ] Unit tests: >90% coverage
- [ ] Integration tests: All passing with real infra
- [ ] E2E tests: Critical paths covered
- [ ] Load tests: 100 concurrent users
- [ ] Chaos tests: Service recovery verified
- [ ] LLM evals: Tool selection >90%, Hallucination 0%

#### 7. Documentation ✅

- [ ] API documentation (OpenAPI 3.1)
- [ ] Runbook (incident response)
- [ ] On-call rotation defined
- [ ] Architecture diagrams updated
- [ ] Environment variables documented
- [ ] Deployment guide (step-by-step)
- [ ] Rollback procedure documented

### Production Deployment Commands

```bash
# 1. Build production images (individual, not compose)
docker build -t commerce-api-prod -f apps/commerce-api/Dockerfile .
docker build -t agent-core-prod -f apps/agent-core/Dockerfile .

# 2. Run migrations
pnpm prisma migrate deploy

# 3. Deploy to Azure Container Apps
az containerapp up --name commerce-api --source ./apps/commerce-api
az containerapp up --name agent-core --source ./apps/agent-core

# 4. Verify deployment
curl https://commerce-api.azurewebsites.net/health
curl https://agent-core.azurewebsites.net/health

# 5. Monitor Langfuse dashboard
open https://cloud.langfuse.com
```

---

## Demo Script

### 6-Minute Walkthrough

**Minute 0-1: System Overview**
```
1. Show README.md architecture diagrams
2. Explain 4 core design principles
3. Highlight tech stack (Next.js, Hono, LangGraph, Azure AI)
```

**Minute 1-2: Local Development**
```bash
# Show container health (sequential startup)
make health

# Show agent briefing
make agent-briefing

# Show database seeded
make db-studio  # Open Prisma Studio
```

**Minute 2-4: Live Agent Demo**
```
1. Open http://localhost:3000
2. User query: "Find laptops under $2000 for engineering dept"
3. Show agent response:
   - Intent classification (pr_create)
   - Entity extraction (item: laptop, budget: 2000, dept: engineering)
   - Tool execution (catalog.search + budget.check)
   - GenUI render (<CatalogGrid />)
4. Add item to PR draft via chat
5. Show PR draft update in real-time
```

**Minute 4-5: Observability**
```
1. Open Langfuse dashboard (http://localhost:3003)
2. Show trace for last conversation turn
3. Highlight:
   - classify_intent span (234ms)
   - tools span (89ms)
   - generate_response span (1.2s)
   - LLM-as-Judge score (faithfulness: 0.92)
```

**Minute 5-6: Testing Evidence**
```bash
# Run unit tests
make test-all

# Show test output
# ✅ 106/106 tests passing (100%)

# Run E2E test
make e2e-test

# Show Playwright report
```

---

## Key Design Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| **LangGraph for orchestration** | Explicit workflow control, built-in checkpointers, human-in-the-loop | Additional dependency, learning curve |
| **Azure AI Foundry only** | Production-ready, industry-standard, compliance | No local Ollama fallback |
| **pgvector over Qdrant** | Single database, simpler ops, familiar SQL | Slightly slower than dedicated vector DB |
| **Prisma owns all migrations** | Type-safe, single source of truth | No Alembic for Python |
| **Agent-core never queries DB** | Clean separation, commerce-api owns data | Extra network hop |
| **Stripe MCP Toolkit** | Official, maintained, secure | Less customization |
| **Custom JWT auth** | Full control, no vendor lock-in | More code to maintain |
| **Idempotency keys on all writes** | Prevents duplicate charges, safe retries | Redis dependency |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15, React 19, shadcn/ui, CopilotKit | Chat-first canvas, GenUI components |
| **Procurement API** | Hono + Bun, GraphQL Yoga, Prisma JS | Data access layer, MCP endpoints |
| **Agent Core** | FastAPI + Python, LangGraph, Azure OpenAI | Multi-agent orchestration |
| **LLM** | Azure AI Foundry (gpt-oss-120b) | Intent classification, response generation |
| **Embeddings** | text-embedding-3-small (1536-dim) | Semantic search, RAG |
| **Database** | PostgreSQL 16 + pgvector | Primary data store, vector search |
| **Cache** | Redis 7 | Session storage, checkpoints, pub/sub notifications |
| **Observability** | Langfuse | Tracing, scoring, dashboards |

---

## Project Structure

```
vercel-ai-sdk/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── app/                # App Router pages
│   │   ├── lib/                # Shared utilities
│   │   │   ├── agents/         # LangGraph client
│   │   │   ├── mcp/            # MCP tools
│   │   │   ├── rag/            # RAG pipeline
│   │   │   └── observability/  # Langfuse integration
│   │   └── tests/              # Vitest + Playwright
│   ├── commerce-api/           # Hono + Bun backend
│   │   ├── src/
│   │   │   ├── graphql/        # GraphQL schema
│   │   │   ├── mcp/            # MCP endpoints
│   │   │   └── prisma/         # Database client
│   │   └── tests/              # Bun test
│   └── agent-core/             # FastAPI + Python
│       ├── main.py             # FastAPI app
│       ├── agents/             # LangGraph graphs
│       ├── tools/              # MCP tools
│       └── tests/              # pytest
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # SQL migrations
│   └── seed.ts                 # Seed data
├── packages/
│   ├── types/                  # Shared TypeScript types
│   └── errors/                 # Error classes (TS + Python)
├── docs/
│   ├── ARCHITECTURE.md         # Detailed architecture
│   ├── PRD.md                  # Product requirements
│   └── adr/                    # Architecture Decision Records
├── scripts/
│   ├── start-postgres.sh       # Start PostgreSQL container
│   ├── stop-postgres.sh        # Stop PostgreSQL container
│   ├── start-redis.sh          # Start Redis container
│   ├── stop-redis.sh           # Stop Redis container
│   └── start-langfuse.sh       # Start Langfuse container
├── docker-compose.yml          # Infrastructure reference (not used directly)
├── docker-compose.langfuse.yml # Optional Langfuse reference
├── Makefile                    # Development commands (sequential containers)
└── README.md                   # This file
```

---

## Links & Resources

- **[PRD.md](./PRD.md)** - Product Requirements Document
- **[TASKS.md](./TASKS.md)** - Living task board (what's done, what's next)
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Detailed architecture documentation
- **[TESTING_STRATEGY.md](./TESTING_STRATEGY.md)** - Comprehensive testing guide
- **[CLAUDE.md](./CLAUDE.md)** - AI agent coding instructions
- **[AGENTS.md](./AGENTS.md)** - Multi-agent system documentation

---

## License

MIT © 2026 ProcureAI B2B Platform

---

## Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes using Conventional Commits (`git commit -m 'feat: add amazing feature'`)
4. **Test** thoroughly (unit + integration + E2E)
5. **Push** to the branch (`git push origin feature/amazing-feature`)
6. **Open** a Pull Request

**Remember**: Show the logs or it didn't happen. All PRs must include test evidence.
