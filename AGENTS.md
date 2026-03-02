# Smart Commerce Agent — Architecture Context

## What We're Building
Production-grade agentic e-commerce CX platform. An AI agent handles
product discovery, cart management, checkout, order tracking, and support
via natural language + GenUI (React components rendered by the LLM response).

## Tech Stack (Active — No Dead Code)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 15, shadcn/ui, CopilotKit | Storefront + AI sidebar |
| Agent | LangGraph (supervisor graph) | Intent → tool routing |
| Tools | MCP tool registry + Stripe MCP | All commerce side effects |
| LLM | Azure AI Foundry (gpt-4o-mini) | Inference + embeddings |
| DB | PostgreSQL 16 + pgvector (Docker) | ACID + vector search |
| Cache | Redis 7 (Docker) | Checkpoints + semantic cache |
| Observability | Langfuse (Docker) | Per-span tracing + RAGAS |
| Payments | Stripe MCP Agent Toolkit | Payments, refunds, links |

## Key Design Decisions (Don't Revisit Without Good Reason)

1. **MCP over raw DB calls**: All agent-initiated side effects go through
   MCP tools. Tools are Zod-validated, user-scoped, and traced. Direct
   Prisma calls from agent nodes are forbidden.

2. **Stripe MCP over raw Stripe SDK**: All payment operations use
   @stripe/agent-toolkit. Reason: idempotency keys managed automatically,
   LLM-safe tool descriptions, no raw secret exposure.

3. **FTS + pgvector over external search**: Hybrid search lives in Postgres.
   No Qdrant, no OpenSearch. FTS for keyword recall, pgvector HNSW for
   semantic rerank. Eliminates network hop + keeps ACID joins.

4. **LangGraph only, no LangChain**: LangGraph compiles the full graph.
   LangChain imports only for utility types. No LangChain chains.

5. **Real infra for all tests**: Jest integration tests use real Docker
   Postgres + Redis. No mocks for DB or Redis. Azure AI Foundry used for
   LLM integration tests (costs ~$0.01 per run, acceptable).

## File Map (Critical Files)

```
lib/
├── llm/client.ts         ← Azure AI Foundry client (SINGLE source)
├── agents/
│   ├── supervisor.ts     ← LangGraph graph definition (ACTIVE)
│   ├── nodes/            ← One file per graph node
│   └── state.ts          ← AgentState type
├── mcp/
│   ├── tools.ts          ← Tool registry (all tools listed here)
│   ├── server.ts         ← Tool executor + auth wrapper + Langfuse
│   └── stripe-mcp.ts     ← Stripe agent toolkit init
├── search/
│   ├── hybrid.ts         ← FTS → pgvector rerank pipeline
│   └── embeddings.ts     ← Azure embedding calls
├── db/
│   └── client.ts         ← Prisma client (single instance)
└── redis/
    └── client.ts         ← Upstash/local Redis (single instance)

app/api/
├── copilotkit/route.ts   ← CopilotKit → LangGraph bridge
├── mcp/[tool]/route.ts   ← REST façade for MCP tools
└── webhooks/stripe/route.ts ← Stripe webhook handler
```

## Environment Variables (Always in .env.local)

```
# LLM — Azure AI Foundry
AZURE_OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY
AZURE_OPENAI_DEPLOYMENT        # e.g. gpt-4o-mini
AZURE_OPENAI_API_VERSION       # e.g. 2024-10-21
AZURE_EMBEDDING_DEPLOYMENT     # e.g. text-embedding-3-small

# Database (Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_commerce

# Redis (Docker)
REDIS_URL=redis://localhost:6379

# Payments
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

# Observability (Docker Langfuse)
LANGFUSE_PUBLIC_KEY
LANGFUSE_SECRET_KEY
LANGFUSE_BASE_URL=http://localhost:3001
```

## Current Phase
See TASKS.md for active phase and task.
