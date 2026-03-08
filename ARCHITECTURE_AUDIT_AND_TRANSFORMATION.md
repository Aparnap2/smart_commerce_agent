# Smart Commerce Agent - Architecture Audit & Transformation Plan

## Critical Finding: Architecture Mismatch

**Current State**: The codebase has **BOTH** Supabase AND PostgreSQL/Prisma running simultaneously, creating architectural confusion.

### Problem Identified

1. **Supabase Client** (`lib/supabase/client.ts` - 480 lines)
   - Full Supabase implementation with auth, realtime, RLS
   - Used in middleware.ts for authentication
   - Has tables: `organizations`, `users`, `customers`, `tickets`, `orders`, `refunds`

2. **Prisma + PostgreSQL** (`prisma/schema.prisma`)
   - Direct PostgreSQL with Prisma ORM
   - pgvector for vector search
   - Tables: `Customer`, `Product`, `Order`, `SupportTicket`, `Refund`, `Cart`, `CartItems`, `Coupons`

3. **MCP Tools** (`lib/mcp/tools.ts`)
   - Uses Prisma-style DB interface
   - Has cart management, orders, refunds, search

4. **LangGraph Agents** (`lib/agents/supervisor.ts`)
   - Agent orchestration with Redis checkpoints
   - Tool execution layer

---

## Architecture Decision: Azure Migration Path

Since we're migrating **TO Azure**, here's the correct transformation:

### Current → Target Architecture

| Layer | Current | Target (Azure) |
|-------|---------|----------------|
| **Frontend** | Next.js on Vercel | Azure Static Web Apps OR Vercel (keep) |
| **Auth** | Supabase Auth | Azure AD B2C OR Auth0 |
| **Database** | Supabase Postgres + Prisma Postgres | Azure Database for PostgreSQL Flexible Server |
| **Vector Search** | Prisma pgvector | Azure Database for PostgreSQL + pgvector extension |
| **Cache** | Redis Cloud | Azure Cache for Redis (Free tier) |
| **AI/LLM** | Ollama local | Azure OpenAI Service OR continue Ollama |
| **Search** | PostgreSQL full-text + pgvector | Azure AI Search (formerly Cognitive Search) |
| **Observability** | Langfuse | Azure Application Insights + Langfuse |
| **Agent Framework** | LangGraph | Keep LangGraph |
| **MCP Tools** | Custom | Keep + extend |

---

## Transformation Phases

### Phase 0: Cleanup & Consolidation (IMMEDIATE)

**Goal**: Remove Supabase dependency, consolidate on Prisma + PostgreSQL

#### 0.1 Remove Supabase Auth
```typescript
// DELETE: lib/supabase/client.ts (480 lines)
// DELETE: lib/supabase/server.ts
// DELETE: lib/supabase/create-client.ts

// REPLACE middleware.ts with simpler auth
// Use NextAuth.js or Auth0 instead
```

#### 0.2 Consolidate Database Access
```typescript
// Currently: Both Supabase client AND Prisma used
// Target: Prisma ONLY for all database operations

// lib/tools/database.js is good - raw SQL with pg
// lib/mcp/tools.ts uses Prisma-style interface - KEEP
```

#### 0.3 Fix Schema Conflicts
```prisma
// prisma/schema.prisma has BOTH:
// - Customer (Int id, email unique)
// - Supabase has customers table too

// CONSOLIDATE: Single schema with proper relations
```

---

### Phase 1: RAG Accuracy Enhancement (Week 1-2)

**Current RAG Implementation**:
```typescript
// lib/rag/service.ts
- vectorSearch() - pgvector similarity
- documentSearch() - full-text search
- ragQuery() - combines both
- NO reranking
- NO query transformation
- NO semantic caching
```

**Enhanced RAG**:

#### 1.1 Semantic Chunking (NEW)
```typescript
// lib/rag/semantic-chunker.ts
export async function semanticChunk(
  text: string,
  options: {
    maxChunkSize: number;    // 500-800 chars
    chunkOverlap: number;    // 50-100 chars
    similarityThreshold: number; // 0.85
  }
): Promise<string[]>
```

**Test**:
```typescript
// tests/unit/semantic-chunker.test.ts
- 22 tests covering sentence splitting, merging, overlap
```

#### 1.2 Cross-Encoder Reranker (NEW)
```typescript
// lib/rag/reranker.ts
export async function rerankCandidates(
  query: string,
  candidates: RerankCandidate[],
  options: { topK: number; minScore: number }
): Promise<RerankResult[]>
```

**Integration**:
```typescript
// lib/rag/service.ts:ragQuery()
const candidates = await vectorSearch(query, { limit: 20 });
const reranked = await rerankCandidates(query, candidates, { topK: 5 });
```

**Test**:
```typescript
// tests/unit/reranker.test.ts
- 15 tests for scoring, reranking, error handling
```

#### 1.3 Query Transformation (NEW)
```typescript
// lib/rag/query-transform.ts
export async function rewriteQuery(query: string): Promise<string[]>
export async function hydeExpand(query: string): Promise<string>
```

#### 1.4 Semantic Cache (NEW)
```typescript
// lib/rag/semantic-cache.ts
export class SemanticCache {
  async get(query: string): Promise<unknown[] | null>
  async set(query: string, results: unknown[]): Promise<void>
}
```

---

### Phase 2: Azure Migration (Week 3-4)

#### 2.1 Database Migration
```bash
# Export from current PostgreSQL
pg_dump -h localhost -U postgres smart_commerce > backup.sql

# Import to Azure Database for PostgreSQL
psql -h <azure-host>.postgres.database.azure.com \
     -U smartcommerce@azure-db \
     -d smart_commerce < backup.sql

# Enable pgvector extension
CREATE EXTENSION vector;
```

#### 2.2 Update Environment Variables
```bash
# .env.local
DATABASE_URL=postgresql://smartcommerce@azure-db:<password>@<azure-host>.postgres.database.azure.com:5432/smart_commerce?sslmode=require

# Azure OpenAI (optional replacement for Ollama)
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://<resource>.search.windows.net
AZURE_SEARCH_API_KEY=...

# Azure Cache for Redis
REDIS_URL=rediss://<redis-cache>.redis.cache.windows.net:6380?ssl=true&password=...
```

#### 2.3 Update Prisma Schema
```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Add Azure-specific extensions
  extensions = [vector]
}
```

---

### Phase 3: Traceability & Evaluation (Week 5-6)

#### 3.1 Langfuse Tracing (KEEP - Works with Azure)
```typescript
// lib/observability/rag-trace.ts
export async function traceRAGPipeline(
  query: string,
  fn: (ctx: RAGTraceContext) => Promise<T>
): Promise<T>
```

**Spans**:
1. Query Transform
2. Vector Search
3. Reranking
4. LLM Generation
5. Scoring

#### 3.2 LLM-as-Judge (NEW)
```typescript
// lib/observability/llm-judge.ts
export async function evaluateRAGOutput(
  input: {
    query: string
    context: string
    answer: string
  }
): Promise<{
  faithfulness: number
  relevance: number
  answerRelevance: number
}>
```

#### 3.3 RAGAS Integration (EXTEND)
```python
# scripts/llm_eval.py
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy

def evaluate_rag_pipeline(dataset):
    return evaluate(dataset, metrics=[faithfulness, answer_relevancy])
```

---

### Phase 4: Production CX Features (Week 7-8)

#### 4.1 Guardrails (NEW)
```typescript
// lib/guardrails/index.ts
export function validateInput(
  input: string,
  config: {
    enablePIIDetection: boolean
    enableToxicityDetection: boolean
    enableJailbreakDetection: boolean
  }
): ValidationResult

export function validateOutput(
  output: string,
  context?: string
): ValidationResult
```

#### 4.2 User Memory (NEW - Optional Mem0)
```typescript
// lib/memory/user-memory.ts
export async function rememberUserContext(
  userId: string,
  context: UserMemoryContext
): Promise<boolean>

export async function recallUserContext(
  userId: string
): Promise<UserMemoryContext>
```

#### 4.3 Adaptive RAG (NEW)
```typescript
// lib/agents/adaptive-rag-node.ts
export async function decideRetrievalNecessity(
  query: string,
  conversationHistory: ChatMessage[]
): Promise<{
  useRetrieval: boolean
  confidence: number
  reason: string
}>
```

---

## File Cleanup Plan

### Files to DELETE
```
lib/supabase/
├── client.ts           # 480 lines - replacing with Azure
├── server.ts           # Supabase server client
└── create-client.ts    # Client factory
```

### Files to UPDATE
```
middleware.ts           # Remove Supabase auth, use NextAuth
lib/rag/service.ts      # Add reranking, query transform
lib/mcp/rag-tools.ts    # Add cache, transform options
```

### Files to CREATE
```
lib/rag/
├── semantic-chunker.ts       # 374 lines
├── reranker.ts               # 274 lines
├── query-transform.ts        # 359 lines
└── semantic-cache.ts         # 280 lines

lib/observability/
├── rag-trace.ts              # 330 lines
└── llm-judge.ts              # 350 lines

lib/guardrails/
└── index.ts                  # 448 lines

lib/memory/
└── user-memory.ts            # 430 lines

lib/agents/
├── adaptive-rag-node.ts      # 280 lines
└── cx-proactive.ts           # 450 lines

tests/unit/
├── semantic-chunker.test.ts  # 22 tests
├── reranker.test.ts          # 15 tests
└── guardrails.test.ts        # 24 tests
```

---

## Testing Strategy

### Unit Tests (Vitest)
```bash
pnpm vitest run tests/unit/semantic-chunker.test.ts
pnpm vitest run tests/unit/reranker.test.ts
pnpm vitest run tests/unit/guardrails.test.ts

# Total: 61 tests
```

### Integration Tests
```bash
pnpm vitest run tests/integration/rag-enhancements.test.ts
# 13 integration tests
```

### E2E Tests (Playwright)
```bash
pnpm test:e2e
# Existing E2E suite
```

---

## Azure Cost Analysis

| Service | Tier | Monthly Cost | Limits |
|---------|------|--------------|--------|
| Azure Database for PostgreSQL | Flexible Server (Burstable) | ~$15/mo | 1 vCore, 32GB storage |
| Azure Cache for Redis | Basic (C0) | ~$16/mo | 250MB |
| Azure AI Search | Free | $0 | 50MB, 10K documents |
| Azure OpenAI | Pay-as-you-go | ~$10/mo | GPT-4o-mini usage |
| Azure Static Web Apps | Free | $0 | 100GB bandwidth |
| **TOTAL** | | **~$41/mo** | Production-ready |

**Cost Optimization**: Keep Vercel for frontend (free), use Azure only for backend services.

---

## Implementation Priority

### CRITICAL (Do First)
1. ✅ Remove Supabase client files
2. ✅ Consolidate database access through Prisma
3. ✅ Fix middleware authentication
4. ✅ Add semantic chunking
5. ✅ Add reranking

### HIGH (Week 1-2)
6. Query transformation
7. Semantic caching
8. Update MCP tools with new options

### MEDIUM (Week 3-4)
9. Azure Database migration
10. Langfuse tracing enhancement
11. LLM-as-judge scoring

### LOW (Week 5-6)
12. Guardrails
13. User memory
14. Adaptive RAG
15. Proactive CX

---

## Next Steps

1. **IMMEDIATE**: Delete Supabase files
2. **TODAY**: Implement semantic chunking + reranker
3. **THIS WEEK**: Complete RAG accuracy enhancements
4. **NEXT WEEK**: Azure migration
5. **WEEK 3**: Traceability + evaluation
6. **WEEK 4**: Production CX features

---

*Audit Date: 2026-02-18*
*Status: Ready for Transformation*
