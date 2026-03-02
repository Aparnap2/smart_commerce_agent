# Smart Commerce Agent

Production-grade agentic e-commerce CX platform with multi-agent system, GenUI components, and Azure AI Foundry integration.

## Features

- **Multi-Agent System**: ShopperAgent, SupportAgent with LangGraph supervisor
- **GenUI Components**: ProductGrid, ProductCard with CopilotKit integration
- **Resilience**: Circuit breaker pattern with Redis checkpointing
- **Azure AI Foundry**: LLM + embeddings via single client
- **MCP Tools**: Commerce operations (cart, orders, products, search)
- **PostgreSQL + pgvector**: Hybrid search (FTS + semantic rerank)
- **Redis**: State persistence + semantic caching

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, shadcn/ui, CopilotKit |
| Agent | LangGraph (supervisor graph) |
| Tools | MCP tool registry |
| LLM | Azure AI Foundry (gpt-4o-mini) |
| DB | PostgreSQL 16 + pgvector |
| Cache | Redis 7 |
| Observability | Langfuse |

## Getting Started

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose up -d postgres redis

# Run database migrations
pnpm prisma migrate deploy

# Seed database
pnpm prisma db seed

# Run tests
pnpm vitest run

# Start dev server
pnpm dev
```

## Environment Variables

Create `.env.local`:

```bash
# Azure AI Foundry
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_EMBEDDING_DEPLOYMENT=text-embedding-3-small

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smart_commerce

# Redis
REDIS_URL=redis://localhost:6379

# Auth
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

## Architecture

```
lib/
├── agents/
│   ├── supervisor.ts      # LangGraph state graph
│   ├── shopper-agent.ts   # Product discovery, cart
│   ├── support-agent.ts   # Refunds, tickets
│   └── state.ts           # Agent state types
├── mcp/
│   ├── tools.ts           # Commerce MCP tools
│   └── server.ts          # Tool executor
├── llm/
│   └── provider.ts        # Azure AI Foundry client
├── redis/
│   └── checkpointer.ts    # Redis + memory checkpointers
├── resilience/
│   └── circuit-breaker.ts # Opossum circuit breaker
└── genui/
    └── types.ts           # Zod schemas for components

app/
├── api/copilotkit/        # CopilotKit → LangGraph bridge
└── dashboard/components/genui/  # GenUI components
```

## Testing

```bash
# Unit tests
pnpm vitest run tests/unit/

# Integration tests (requires Docker)
pnpm vitest run tests/integration/

# E2E tests
pnpm playwright test
```
