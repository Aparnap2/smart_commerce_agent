# Local Development Guide

## Prerequisites

- Node.js 20+ (use nvm: nvm use 20)
- pnpm 9+ (corepack enable pnpm)
- Docker Desktop 4.x+ with Compose v2
- Git

## First-Time Setup

```bash
git clone <repo> && cd techtrend
pnpm install

# Start infra
docker compose up -d postgres redis

# Setup database
cd apps/web
pnpm prisma migrate deploy
pnpm db:seed

# Embed products (requires LLM_API_KEY)
pnpm embed
```

## Daily Dev Workflow

```bash
# Terminal 1
cd apps/agent && npx @langchain/langgraph-cli dev

# Terminal 2
cd apps/web && pnpm dev

# Terminal 3 (optional — Langfuse UI)
docker compose up langfuse   # if configured
```

## Running Tests

```bash
# Fast unit tests (no services needed)
cd apps/web && pnpm test

# Watch mode
cd apps/web && pnpm test --watch

# Single file
cd apps/web && pnpm test __tests__/lib/search/embed.test.ts

# E2E (requires full stack on ports 3000 + 2024)
cd apps/web && pnpm cy:open    # interactive
cd apps/web && pnpm cy:run     # headless
```

## Database Operations

```bash
# Open Prisma Studio (GUI)
cd apps/web && pnpm prisma studio

# Reset database (WARNING: deletes all data)
cd apps/web && pnpm prisma migrate reset

# Create new migration after schema change
cd apps/web && pnpm prisma migrate dev --name "your-change"

# Connect directly to postgres
docker compose exec postgres psql -U postgres smart_commerce
```

## Adding a New GenUI Component

1. Create component in apps/web/components/genui/
   - Add data-testid to all interactive elements
2. Export from apps/web/components/genui/index.ts
3. Import in apps/agent/src/ui/customer-ui.tsx
4. Add to ComponentMap with a kebab-case name
5. Add ui.push({ name: 'your-name', props }) in graph node
6. Add unit test in __tests__/components/
7. Add Cypress assertion in relevant spec

## Adding a New Agent Tool

1. Add handler in apps/web/lib/mcp/handlers.ts
2. Write handler test in __tests__/integration/handlers/
3. Import handler in apps/agent/src/db.ts
4. Add tool definition in graph (customer.ts or merchant.ts)
5. Add ui.push() call in generate function
6. Update tool description to help LLM know when to use it

## Troubleshooting

"LangGraph server not responding"
→ cd apps/agent && npx @langchain/langgraph-cli dev
→ Check port 2024 is free: lsof -i :2024

"Prisma client not found"
→ cd apps/web && pnpm prisma generate

"Redis connection refused"
→ docker compose up -d redis
→ Check port 6379: docker compose ps

"useStream returns empty messages"
→ Check NEXT_PUBLIC_LANGGRAPH_URL in .env.local
→ Must be http://localhost:2024 (no trailing slash)

"Gemini rate limit (429)"
→ Free tier: 15 RPM — wait 60s
→ Or: get new API key at aistudio.google.com/apikey
→ Or: switch to paid tier
