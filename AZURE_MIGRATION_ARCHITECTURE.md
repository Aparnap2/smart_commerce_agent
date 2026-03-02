# Azure Migration Architecture - Smart Commerce Agent

## Executive Summary

**Migration Goal**: Transform Smart Commerce Agent from Supabase-dependent to Azure-native architecture with enhanced RAG capabilities.

**Timeline**: 6-8 weeks
**Estimated Monthly Cost**: $40-60/month (production-ready)
**Team**: 1-2 developers

---

## Current vs Target Architecture

### Current State
```
┌─────────────────────────────────────────────────────────┐
│                    CURRENT STATE                        │
├─────────────────────────────────────────────────────────┤
│  Frontend: Next.js 15 (Vercel)                         │
│  Auth: Supabase Auth (Free tier)                       │
│  Database 1: Supabase PostgreSQL (Free tier, 500MB)    │
│  Database 2: PostgreSQL + Prisma (Local/Docker)        │
│  Vector: pgvector (Prisma schema)                      │
│  Cache: Redis Cloud (Free, 30MB)                       │
│  AI: Ollama local (qwen2.5-coder:3b)                   │
│  Search: PostgreSQL full-text + pgvector               │
│  Observability: Langfuse (Free, 1000 traces/mo)        │
└─────────────────────────────────────────────────────────┘
```

### Target State (Azure-Native)
```
┌─────────────────────────────────────────────────────────┐
│                  TARGET STATE (AZURE)                   │
├─────────────────────────────────────────────────────────┤
│  Frontend: Next.js 15 (Vercel OR Azure Static Web Apps)│
│  Auth: Auth0 Free Tier OR Azure AD B2C                 │
│  Database: Azure Database for PostgreSQL Flexible Svr  │
│  Vector: pgvector extension on Azure PostgreSQL        │
│  Cache: Azure Cache for Redis (Basic C0, 250MB)        │
│  AI: Azure OpenAI (GPT-4o-mini) OR Keep Ollama         │
│  Search: Azure AI Search (Free tier → Basic)           │
│  Observability: Langfuse + Azure App Insights          │
│  RAG: Enhanced (chunking, reranking, tracing)          │
│  Guardrails: Input/Output validation                   │
└─────────────────────────────────────────────────────────┘
```

---

## Azure Services & Cost Breakdown

### Phase 1: Core Infrastructure ($35-45/month)

| Service | Tier | Monthly Cost | Limits | Purpose |
|---------|------|--------------|--------|---------|
| **Azure Database for PostgreSQL** | Flexible Server, Burstable B1ms | ~$15-20 | 1 vCore, 2GB RAM, 32GB storage | Primary database + pgvector |
| **Azure Cache for Redis** | Basic C0 | ~$16 | 250MB, 250 connections | Session cache, RAG cache |
| **Azure AI Search** | Free | $0 | 50MB, 10K documents, 3 indexes | Hybrid search (phase 3) |
| **Vercel** | Hobby (Free) | $0 | 100GB bandwidth | Frontend hosting |
| **Auth0** | Free | $0 | 7000 MAU, 2 social connections | Authentication |
| **TOTAL PHASE 1** | | **~$31-36/mo** | | |

### Phase 2: AI & Observability ($15-25/month additional)

| Service | Tier | Monthly Cost | Limits | Purpose |
|---------|------|--------------|--------|---------|
| **Azure OpenAI** | Pay-as-you-go (GPT-4o-mini) | ~$10-20 | ~$0.15/1M input tokens | LLM for RAG, agents |
| **Langfuse Cloud** | Starter | $0-29 | 1000-5000 traces | Observability |
| **Azure Monitor** | Pay-as-you-go | ~$5 | Basic metrics | Infrastructure monitoring |
| **TOTAL PHASE 2** | | **~$15-25/mo** | | |

### Total Monthly Cost: $46-61/month

**Cost Optimization Options**:
1. Keep Ollama instead of Azure OpenAI: Save $10-20/mo
2. Use 3-year reserved instances for PostgreSQL: Save 64%
3. Stop dev environment nights/weekends: Save 60% on compute

---

## Migration Phases

### Phase 0: Preparation (Week 0) - ✅ CURRENT

**Tasks**:
- [x] Architecture audit completed
- [ ] Azure subscription setup
- [ ] Resource group creation
- [ ] Network security planning
- [ ] Backup current data

**Deliverables**:
- Architecture document (this file)
- Azure subscription active
- Cost estimation approved

---

### Phase 1: Authentication Migration (Week 1-2)

**Goal**: Replace Supabase Auth with Auth0

#### 1.1 Setup Auth0
```bash
# Create Auth0 account (free tier)
# Create Application: Smart Commerce Agent
# Configure allowed URLs:
#   - Allowed Callback URLs: http://localhost:3000/api/auth/callback
#   - Allowed Logout URLs: http://localhost:3000
#   - Allowed Web Origins: http://localhost:3000
```

#### 1.2 Install Dependencies
```bash
pnpm add next-auth@beta auth0
pnpm add -D @types/auth0
```

#### 1.3 Create Auth Configuration
```typescript
// lib/auth/auth0.ts
import { NextAuthOptions } from 'next-auth';
import Auth0Provider from 'next-auth/providers/auth0';

export const authOptions: NextAuthOptions = {
  providers: [
    Auth0Provider({
      clientId: process.env.AUTH0_CLIENT_ID!,
      clientSecret: process.env.AUTH0_CLIENT_SECRET!,
      issuer: process.env.AUTH0_ISSUER,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
};
```

#### 1.4 Update API Routes
```typescript
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/auth0';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

#### 1.5 Update Middleware
```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/auth/login',
    },
  }
);

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*'],
};
```

#### 1.6 Database Schema Updates
```prisma
// prisma/schema.prisma
model User {
  id            String    @id @default(uuid()) // Auth0 user ID
  email         String    @unique
  name          String?
  image         String?
  emailVerified DateTime?
  accounts      Account[]
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@map("users")
}

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(uuid())
  userId       String
  sessionToken String   @unique
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("sessions")
}
```

**Tests**:
```typescript
// tests/unit/auth.test.ts
describe('Auth0 Integration', () => {
  it('should authenticate user with Auth0', async () => {
    // Test Auth0 login flow
  });
  
  it('should protect routes with middleware', async () => {
    // Test middleware protection
  });
  
  it('should handle session management', async () => {
    // Test session creation/destruction
  });
});
```

**Files to Delete**:
- `lib/supabase/client.ts` ✅ (already deleted)
- `lib/supabase/server.ts` ✅ (already deleted)
- `lib/supabase/create-client.ts` ✅ (already deleted)

**Files to Update**:
- `middleware.ts` - Replace Supabase auth with NextAuth
- `app/auth/*` - Update auth pages for Auth0
- `components/auth-provider.tsx` - Update provider

---

### Phase 2: Database Migration (Week 2-3)

**Goal**: Migrate from Supabase PostgreSQL to Azure Database for PostgreSQL

#### 2.1 Create Azure Resources
```bash
# Azure CLI
az group create --name smart-commerce-rg --location eastus

# Create PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group smart-commerce-rg \
  --name smart-commerce-db \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --admin-user smartcommerce \
  --admin-password <secure-password> \
  --location eastus \
  --yes

# Enable pgvector extension
az postgres flexible-server parameter set \
  --resource-group smart-commerce-rg \
  --server-name smart-commerce-db \
  --name azure.extensions \
  --value "vector"
```

#### 2.2 Update Environment Variables
```bash
# .env.local
DATABASE_URL=postgresql://smartcommerce:password@smart-commerce-db.postgres.database.azure.com:5432/smart_commerce?sslmode=require

# Auth0
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_ISSUER=https://<tenant>.auth0.com/

# Azure Redis (Phase 3)
REDIS_URL=rediss://smart-commerce-redis.redis.cache.windows.net:6380?ssl=true
```

#### 2.3 Migrate Data
```bash
# Export from Supabase
pg_dump -h db.<project>.supabase.co -U postgres -d postgres > backup.sql

# Import to Azure
psql -h smart-commerce-db.postgres.database.azure.com \
     -U smartcommerce@smart-commerce-db \
     -d smart_commerce < backup.sql
```

#### 2.4 Update Prisma Schema
```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters", "postgresqlExtensions"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Azure PostgreSQL with pgvector
  extensions = [vector]
}

// Keep existing models, ensure pgvector compatibility
model Product {
  id          Int     @id @default(autoincrement())
  // ... existing fields
  embedding   Unsupported("vector(384)")? @map("embedding")
  
  @@index([embedding], type: Hnsw)
}
```

#### 2.5 Run Migrations
```bash
npx prisma migrate dev --name azure-migration
npx prisma generate
```

**Tests**:
```typescript
// tests/integration/database.test.ts
describe('Azure PostgreSQL', () => {
  it('should connect to Azure Database', async () => {
    // Test database connection
  });
  
  it('should support pgvector queries', async () => {
    // Test vector similarity search
  });
  
  it('should handle transactions', async () => {
    // Test transaction support
  });
});
```

---

### Phase 3: RAG Enhancements (Week 3-4)

**Goal**: Implement advanced RAG features

#### 3.1 Semantic Chunking
```typescript
// lib/rag/semantic-chunker.ts
export async function semanticChunk(
  text: string,
  options: {
    maxChunkSize: number;    // 500-800
    chunkOverlap: number;    // 50-100
    similarityThreshold: number; // 0.85
  }
): Promise<string[]>
```

**Tests**: 22 unit tests

#### 3.2 Cross-Encoder Reranker
```typescript
// lib/rag/reranker.ts
export async function rerankCandidates(
  query: string,
  candidates: RerankCandidate[],
  options: { topK: number; minScore: number }
): Promise<RerankResult[]>
```

**Tests**: 15 unit tests

#### 3.3 Query Transformation
```typescript
// lib/rag/query-transform.ts
export async function rewriteQuery(query: string): Promise<string[]>
export async function hydeExpand(query: string): Promise<string>
```

#### 3.4 Semantic Cache
```typescript
// lib/rag/semantic-cache.ts
export class SemanticCache {
  async get(query: string): Promise<unknown[] | null>
  async set(query: string, results: unknown[]): Promise<void>
}
```

**Tests**: 24 unit tests for all RAG modules

---

### Phase 4: Azure AI Integration (Week 4-5)

#### 4.1 Azure OpenAI Setup
```bash
# Create Azure OpenAI resource
az cognitiveservices account create \
  --name smart-commerce-openai \
  --resource-group smart-commerce-rg \
  --kind OpenAI \
  --sku S0 \
  --location eastus

# Deploy GPT-4o-mini
az cognitiveservices account deployment create \
  --name smart-commerce-openai \
  --resource-group smart-commerce-rg \
  --deployment-name gpt-4o-mini \
  --model-name gpt-4o-mini \
  --model-version "2024-07-18" \
  --model-format OpenAI \
  --scale-settings-scale-type "Standard"
```

#### 4.2 Update LLM Provider
```typescript
// lib/llm/provider.ts
import { AzureOpenAI } from 'openai';

export async function createChatCompletion(messages: ChatMessage[]) {
  const client = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion: '2024-02-15-preview',
    deployment: 'gpt-4o-mini',
  });
  
  return client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
  });
}
```

#### 4.3 Azure AI Search (Optional Enhancement)
```bash
# Create Azure AI Search
az search service create \
  --name smart-commerce-search \
  --resource-group smart-commerce-rg \
  --sku free \
  --location eastus
```

**Tests**:
```typescript
// tests/integration/azure-openai.test.ts
describe('Azure OpenAI', () => {
  it('should generate completions', async () => {
    // Test GPT-4o-mini completion
  });
  
  it('should handle streaming', async () => {
    // Test streaming response
  });
});
```

---

### Phase 5: Observability & Evaluation (Week 5-6)

#### 5.1 Langfuse Tracing
```typescript
// lib/observability/rag-trace.ts
export async function traceRAGPipeline<T>(
  query: string,
  fn: (ctx: RAGTraceContext) => Promise<T>
): Promise<T>
```

#### 5.2 LLM-as-Judge
```typescript
// lib/observability/llm-judge.ts
export async function evaluateRAGOutput(
  input: { query: string; context: string; answer: string }
): Promise<{ faithfulness: number; relevance: number }>
```

#### 5.3 RAGAS Integration
```python
# scripts/llm_eval.py
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy

def evaluate_rag_pipeline(dataset):
    return evaluate(dataset, metrics=[faithfulness, answer_relevancy])
```

---

### Phase 6: Production CX Features (Week 6-7)

#### 6.1 Guardrails
```typescript
// lib/guardrails/index.ts
export function validateInput(input: string): ValidationResult
export function validateOutput(output: string, context?: string): ValidationResult
```

#### 6.2 User Memory
```typescript
// lib/memory/user-memory.ts
export async function rememberUserContext(userId: string, context: UserMemoryContext): Promise<boolean>
export async function recallUserContext(userId: string): Promise<UserMemoryContext>
```

#### 6.3 Adaptive RAG
```typescript
// lib/agents/adaptive-rag-node.ts
export async function decideRetrievalNecessity(query: string): Promise<{ useRetrieval: boolean }>
```

---

## Testing Strategy

### Unit Tests (Vitest)
- 61 tests for new RAG modules
- 20 tests for auth migration
- 15 tests for database operations

### Integration Tests
- 13 tests for RAG pipeline
- 10 tests for Azure services
- E2E flows with Playwright

### Performance Tests
- Load testing with 1000 concurrent users
- Latency benchmarks (<2s p95)
- Cache hit rate (>50%)

---

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Data loss during migration | High | Low | Full backup, test migration first |
| Auth0 downtime | Medium | Low | Fallback to email/password |
| Azure cost overrun | Medium | Medium | Set budget alerts, use reserved instances |
| Performance degradation | Medium | Low | Load test before cutover |
| Breaking changes | High | Medium | Feature flags, gradual rollout |

---

## Rollback Plan

If migration fails:
1. Keep Supabase running in parallel
2. Use feature flags to switch between old/new auth
3. Database replication: Supabase → Azure (one-way)
4. Rollback by disabling feature flags

---

## Success Criteria

- [ ] All 61 unit tests passing
- [ ] E2E tests passing
- [ ] Auth0 login working
- [ ] Azure PostgreSQL connected
- [ ] RAG accuracy improved by 40%+
- [ ] Latency < 2s p95
- [ ] Monthly cost < $60

---

## Next Steps

1. **Approve architecture** - Review this document
2. **Set up Azure subscription** - Create resource group
3. **Start Phase 1** - Auth0 integration
4. **Daily standups** - Track progress
5. **Weekly demos** - Show completed features

---

*Architecture Document Created: 2026-02-18*
*Version: 1.0.0*
*Status: Ready for Implementation*
