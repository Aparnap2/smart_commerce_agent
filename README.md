# Smart Commerce Agent

Production-grade agentic e-commerce CX platform. A 3-service monorepo with Next.js frontend, Hono commerce API, and FastAPI agent core.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  apps/web/ → Next.js 15 Chat-First Canvas (no navigation tabs)  │
│  - Shell using 100dvh CSS Grid (Rail + Chat Column)             │
│  - Virtualized anchor scroll for high-performance streaming     │
├─────────────────────────────────────────────────────────────────┤
│                        SERVICE LAYER                             │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │ apps/commerce-api/  │  │ apps/agent-core/                │  │
│  │ Hono + Bun          │  │ FastAPI + Python                │  │
│  │ GraphQL Yoga        │  │ LangGraph agents                │  │
│  │ MCP HTTP endpoints  │  │ GraphQL tool → commerce-api     │  │
│  │ Prisma JS           │  │ asyncpg (notifications only)    │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                     SHARED LAYER                                 │
│  prisma/ → Single schema.prisma (Prisma JS only)                │
│  packages/types/ → Shared TS interfaces                         │
│  packages/errors/ → CommerceError (TS + Python mirror)          │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Agent-core NEVER queries DB directly** except for AgentNotification inserts
2. **No ORM in Python** — raw asyncpg for 1-2 direct writes
3. **Prisma migrate owns ALL migrations** — never alembic
4. **GraphQL Yoga exposed as MCP HTTP endpoints**
5. **Custom JWT auth** — not Supabase
6. **Azure AI Foundry ONLY** — no Ollama, no Google, no OpenAI direct
7. **Stripe MCP Agent Toolkit** — no raw stripe SDK
8. **pgvector 1536-dim** — no Qdrant

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, shadcn/ui, CopilotKit |
| Commerce API | Hono + Bun, GraphQL Yoga, Prisma JS |
| Agent Core | FastAPI + Python, LangGraph, Azure OpenAI |
| LLM | OpenAI SDK-compatible (Azure AI Foundry gpt-oss-120b) |
| Embeddings | text-embedding-3-small (1536-dim) |
| DB | PostgreSQL 16 + pgvector |
| Cache | Redis 7 |
| Observability | Langfuse |

## Prerequisites

- Node.js 20+ with pnpm
- Bun 1.0+
- Python 3.12+ with uv/pip
- Docker & Docker Compose

## Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure
docker compose up -d postgres redis

# 3. Run migrations
pnpm prisma migrate deploy

# 4. Seed database
pnpm prisma db seed

# 5. Run all services
make dev
```

## Services

### apps/web/ (Next.js 15)
- Port: 3000
- GenUI canvas with CopilotKit
- Proxies agent calls to agent-core
- Custom JWT auth (no Supabase)

### apps/commerce-api/ (Hono + Bun)
- Port: 3001
- GraphQL Yoga for data access
- MCP HTTP endpoints for agent-core
- Prisma JS for all DB operations

### apps/agent-core/ (FastAPI + Python)
- Port: 8000
- LangGraph agents (shopper, support)
- Azure AI Foundry LLM
- GraphQL tool → commerce-api for data

## Environment Variables

Create `.env.local` in each app:

```bash
# Root / apps/web
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_commerce
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
AGENT_CORE_URL=http://localhost:8000
COMMERCE_API_URL=http://localhost:3001

# LLM Provider (OpenAI SDK pattern — works with Azure AI Foundry, OpenAI, Together AI, Groq, etc.)
# Swap providers by changing these — zero code changes
OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/v1
OPENAI_API_KEY=your-azure-api-key
OPENAI_MODEL=gpt-oss-120b
OPENAI_API_VERSION=2024-10-21  # Required for Azure, omit for OpenAI

# Embeddings
EMBEDDING_MODEL=text-embedding-3-small

# Langfuse
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_BASE_URL=http://localhost:3001
```

## Commands

```bash
# Infrastructure
make infra-up          # Start postgres, redis, langfuse
make infra-down        # Stop infrastructure
make agent-briefing    # Check service health

# Development
make dev               # Start all services in dev mode
pnpm --filter @smart-commerce/web dev
bun run --filter @smart-commerce/commerce-api dev
cd apps/agent-core && uvicorn main:app --reload

# Testing
make test              # Run all tests
pnpm vitest run        # TypeScript tests
pytest apps/agent-core/tests/  # Python tests

# Database
make db-migrate        # Prisma migrate dev
make db-generate       # Prisma generate
make db-seed           # Seed database
```

## Testing Strategy

- **Unit tests**: Vitest (TS), pytest (Python)
- **Integration tests**: Real Docker containers (no mocks)
- **E2E tests**: Playwright

## License

MIT
