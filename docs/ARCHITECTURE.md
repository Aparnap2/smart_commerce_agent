# Smart Commerce Agent - Architecture Documentation

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [High-Level Design (HLD)](#high-level-design-hld)
3. [Low-Level Design (LLD)](#low-level-design-lld)
4. [Design Patterns](#design-patterns)
5. [Architectural Decisions](#architectural-decisions)
6. [Project Anatomy](#project-anatomy)
7. [Data Flow](#data-flow)
8. [Technology Stack](#technology-stack)

---

## Executive Summary

The **Smart Commerce Agent** is a production-ready, AI-powered e-commerce support chatbot featuring:

- **LangGraph-based multi-agent orchestration** with stateful workflows
- **MCP-style tool execution** for database queries and semantic search
- **Generative UI (GenUI)** for dynamic product cards and tool visualizations
- **RAG + Vector Search** using pgvector and Qdrant
- **Serverless deployment ready** with Neon Postgres for $0 infrastructure

### Key Capabilities
| Capability | Implementation |
|------------|----------------|
| Product Search | Semantic similarity via Qdrant/Vector |
| Order Lookup | Prisma ORM queries |
| Inventory Check | Redis caching |
| Refund Processing | Stripe integration + Human approval |
| Chat Interface | Next.js + SSE streaming |

---

## High-Level Design (HLD)

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SMART COMMERCE AGENT                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        CLIENT LAYER                                  │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │    │
│  │  │  Next.js     │  │  Dashboard   │  │   Mobile/Web         │   │    │
│  │  │  Frontend    │  │  Admin UI    │  │   Clients            │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                        │
│                                      ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        API GATEWAY                                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │    │
│  │  │  /api/chat   │  │ /api/agent   │  │   /api/refunds/      │   │    │
│  │  │  (OpenAI SDK)│  │ (LangGraph)  │  │   webhook            │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                        │
│            ┌─────────────────────────┼─────────────────────────┐          │
│            ▼                         ▼                         ▼          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │   LangGraph     │    │    RAG +        │    │   Stripe        │     │
│  │   Supervisor    │    │    Vector       │    │   Refunds       │     │
│  │   Agent        │    │    Search       │    │                 │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│            │                         │                         │          │
│            ▼                         ▼                         ▼          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │ PostgreSQL     │    │ Qdrant/         │    │ Stripe API      │     │
│  │ (Neon)         │    │ pgvector        │    │                 │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                        INFRASTRUCTURE LAYER                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Neon       │  │  Redis      │  │  Qdrant     │  │  Langfuse      │  │
│  │  Postgres   │  │  (Cache)    │  │  (Vector)   │  │  (Tracing)     │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Frontend Layer** (Next.js 15)
- React 19 with App Router
- Tailwind CSS for styling
- Server-Sent Events (SSE) for streaming
- Generative UI components

#### 2. **API Layer**
- **Chat API** (`/api/chat`): OpenAI SDK + MCP tools
- **Agent API** (`/api/agent`): LangGraph supervisor
- **Webhook API** (`/api/refunds/webhook`): Stripe callbacks

#### 3. **Agent Layer** (LangGraph)
- **Supervisor Agent**: Intent classification + routing
- **Tool Agent**: Database queries, vector search
- **Refund Agent**: Payment processing with human approval
- **UI Agent**: Response generation

#### 4. **Data Layer**
- **PostgreSQL** (Neon): Primary database with pgvector
- **Redis**: Caching and LangGraph checkpoints
- **Qdrant**: Vector database for semantic search

---

## Low-Level Design (LLD)

### State Schema (LangGraph)

```typescript
// lib/agents/state.ts
const StateAnnotation = Annotation.Root({
  // Message history with automatic append
  messages: Annotation<Message[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),

  // Current intent classification
  intent: Annotation<IntentClassification | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),

  // Current routing target
  currentAgent: Annotation<'supervisor' | 'refund' | 'tool' | 'ui'>({
    reducer: (prev, next) => next ?? prev,
    default: () => 'supervisor',
  }),

  // Tool execution results
  toolResults: Annotation<unknown[]>({
    reducer: (left, right) => [...(left || []), ...(right || [])],
    default: () => [],
  }),

  // Pending tool calls (for ToolNode)
  pendingToolCalls: Annotation<any[]>({
    reducer: (prev, next) => [...(prev || []), ...(next || [])],
    default: () => [],
  }),

  // Error handling
  error: Annotation<string | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),

  // Metadata for tracking
  threadId: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
  }),

  userId: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
  }),
});
```

### Graph Nodes

| Node | Function | Output State |
|------|----------|--------------|
| `classify_intent` | LLM-based intent classification | `intent`, `currentAgent` |
| `generate_tool_calls` | Build tool calls from intent | `pendingToolCalls` |
| `tools` | Execute MCP tools via ToolNode | `toolResults` |
| `generate_response` | LLM response with tool context | `messages` |
| `direct_response` | LLM response (no tools) | `messages` |
| `human_review` | Approval checkpoint | `messages` (paused) |

### Checkpointer Configuration

```typescript
// lib/redis/langgraph-checkpoint.ts

// Factory function for checkpointer selection
export async function createCheckpointer(config?: CheckpointConfig): Promise<AnyCheckpointer> {
  const type = config?.type || env.CHECKPOINT_TYPE || 'memory';

  switch (type) {
    case 'redis':
      return await initializeRedisCheckpointer(config);
    case 'postgres':
      return await initializePostgresCheckpointer(config);
    default:
      return new MemorySaver();
  }
}

// Neon-optimized pool configuration
function buildPostgresPoolOptions(config?: CheckpointConfig): PoolConfig {
  const connectionString = config?.postgresUrl || env.DATABASE_URL;

  const isNeon = connectionString.includes('neon.tech');
  const maxConnections = isNeon ? (env.NEON_POOL_MAX || 5) : 10;

  return {
    connectionString,
    max: maxConnections,
    idleTimeoutMillis: env.NEON_IDLE_TIMEOUT || 30000,
    connectionTimeoutMillis: 10000,
  };
}
```

---

## Design Patterns

### 1. **State Pattern** (LangGraph)
The agent uses LangGraph's StateGraph to manage different agent states (supervisor, tool, refund, ui).

**Why**: Enables clear state transitions and persistence.

```typescript
workflow.addNode('classify_intent', classifyIntentNode);
workflow.addNode('generate_tool_calls', generateToolCalls);
workflow.addNode('tools', createToolNode());
```

### 2. **Strategy Pattern** (Checkpointers)
Multiple checkpointer strategies (Redis, Postgres, Memory) with factory pattern.

**Why**: Flexibility for different deployment environments.

```typescript
export async function createCheckpointer(config?: CheckpointConfig): Promise<AnyCheckpointer> {
  const type = config?.type || env.CHECKPOINT_TYPE || 'memory';
  // Returns appropriate strategy based on configuration
}
```

### 3. **Factory Pattern** (Tool Creation)
Tools are defined using Zod schemas and wrapped with LangChain's `tool()` function.

**Why**: Consistent tool interface + runtime validation.

```typescript
export const productSearch = tool(
  async (input: ProductSearchInput) => { ... },
  {
    name: 'product_search',
    schema: z.object({
      query: z.string(),
      limit: z.number().default(10),
    }),
  }
);
```

### 4. **Observer Pattern** (Langfuse Tracing)
Observability via Langfuse traces and spans.

**Why**: Real-time monitoring and debugging.

```typescript
const trace = client.trace({
  name: agentName,
  input,
  metadata,
});

const span = trace.span({
  name: nodeName,
  input,
});
```

### 5. **Repository Pattern** (Prisma)
Database access via Prisma ORM with type-safe queries.

**Why**: Clean abstraction over SQL, compile-time type checking.

```typescript
const orders = await prisma.order.findMany({
  where: { customer: { email: userEmail } },
  include: { customer: true, product: true },
});
```

### 6. **Singleton Pattern** (Redis Client)
Single Redis client instance across the application.

**Why**: Connection pooling efficiency.

```typescript
let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}
```

---

## Architectural Decisions

### ADR-001: LangGraph for Agent Orchestration

**Decision**: Use LangGraph instead of LangChain Agents or custom state machines.

**Why**:
1. Explicit workflow control with node/edge definitions
2. Built-in checkpointers for state persistence
3. Human-in-the-loop support via `interruptBefore`
4. Type-safe with Annotation-based state

**Trade-off**: Additional dependency, learning curve

### ADR-002: Multi-Checkpointer Strategy

**Decision**: Support Memory, Redis, and Postgres checkpointers.

**Why**:
- Development: Memory (fastest)
- Production: Redis (scalable) or Postgres (data consistency)
- Cloud deployment: Neon Postgres (serverless)

### ADR-003: Qdrant + pgvector for Vector Search

**Decision**: Hybrid approach - Qdrant for product search, pgvector for RAG.

**Why**:
- Qdrant: Fast similarity search, easy clustering
- pgvector: Integrated with PostgreSQL, familiar query language

### ADR-004: Ollama for Local LLM

**Decision**: Use Ollama with Qwen2.5-Coder for local development.

**Why**:
- Privacy (no data leaves local)
- Cost control (free)
- Consistency (same model locally and production)

### ADR-005: Langfuse for Observability

**Decision**: Integrate Langfuse for tracing and scoring.

**Why**:
- LangGraph native support
- Rich dashboard for debugging
- Scoring for quality metrics

### ADR-006: Intent Classification Router

**Decision**: LLM-based intent classification as first node.

**Why**:
- Handles natural language variability
- Confidence scores for fallback routing
- Easy to extend with new intents

### ADR-007: Human-in-the-Loop for Refunds

**Decision**: Use LangGraph's `interruptBefore` for refund approval.

**Why**:
- Financial risk mitigation
- Simple implementation
- Clear audit trail

### ADR-008: Dual-Mode Scoring

**Decision**: LLM evaluation + rule-based fallback.

**Why**:
- Nuanced quality assessment (LLM)
- Always-available scoring (fallback)
- Cost-effective at scale

### ADR-009: Cloud-Native Free Tier

**Decision**: Neon Postgres, Qdrant Cloud, Langfuse Cloud for $0 deployment.

**Why**:
- Zero infrastructure costs
- Serverless auto-scaling
- Same APIs as local Docker

---

## Project Anatomy

### Directory Structure

```
vercel-ai-sdk/
├── app/                          # Next.js App Router
│   ├── api/
│   │   ├── chat/
│   │   │   ├── route.ts          # Chat API (OpenAI SDK)
│   │   │   └── langgraph/        # LangGraph routes
│   │   ├── agent/
│   │   │   └── route.ts          # Multi-agent supervisor
│   │   └── refunds/
│   │       └── webhook/
│   │           └── route.ts      # Stripe webhooks
│   └── dashboard/                # Admin dashboard
│       ├── page.tsx
│       └── components/
│           └── genui/            # Generative UI
├── lib/
│   ├── agents/                   # LangGraph agents
│   │   ├── supervisor.ts        # Main supervisor agent
│   │   ├── refund.ts            # Refund processing
│   │   ├── ui.ts                 # UI generation
│   │   ├── state.ts              # State definitions
│   │   └── tools.ts              # Tool implementations
│   ├── redis/                    # Redis + checkpointers
│   │   ├── client.ts            # Redis client
│   │   ├── langgraph-checkpoint.ts # LangGraph persistence
│   │   └── checkpointer.ts       # Checkpoint manager
│   ├── observability/            # Tracing + scoring
│   │   ├── langfuse.ts          # Langfuse integration
│   │   └── scoring.ts            # Response evaluation
│   ├── rag/                      # RAG + Vector search
│   │   └── service.ts            # RAG pipeline
│   ├── schemas/                  # Zod validation
│   │   ├── commerce.ts          # Schema.org schemas
│   │   ├── mapper.ts            # Schema mapping
│   │   └── validator.ts          # Validation
│   ├── stripe/                  # Payment processing
│   │   ├── client.ts
│   │   └── refund.ts
│   └── env.js                    # Environment validation
├── prisma/
│   └── schema.prisma             # Database schema
├── scripts/
│   ├── start-infrastructure.sh   # Docker startup
│   └── test-langgraph.sh        # Testing
├── docs/
│   ├── adr/                     # Architecture Decision Records
│   └── CLOUD_DEPLOYMENT.md      # Cloud setup guide
└── Makefile                     # One-command operations
```

### Database Schema

```prisma
// prisma/schema.prisma

model Customer {
  id             Int             @id @default(autoincrement())
  email          String          @unique
  name           String?
  phone          String?
  orders         Order[]
  supportTickets SupportTicket[]
}

model Product {
  id          Int                @id @default(autoincrement())
  name        String
  description String?
  price       Float
  stock       Int
  category    String?
  embeddings  ProductEmbedding[]  // For vector search
}

model Order {
  id              Int          @id @default(autoincrement())
  customerId      Int
  productId       Int
  total           Float
  status          String
  orderRefund     OrderRefund? // Refund tracking
}

model Refund {
  id              Int      @id @default(autoincrement())
  stripeRefundId  String   @unique
  paymentIntentId String
  orderId         Int?
  amount          Int
  status          String
}

model Document {
  id        String          @id @default(uuid())
  title     String
  content   String
  chunks    DocumentChunk[]  // For RAG
}

model DocumentChunk {
  id         String @id @default(uuid())
  documentId String
  content    String
  embedding  Unsupported("vector") // pgvector
}
```

---

## Data Flow

### Chat Request Flow

```
1. Client sends message to /api/chat
2. OpenAI SDK routes to MCP tools
3. Prisma executes database queries
4. Qdrant performs semantic search
5. LLM generates response with context
6. SSE streams response to client
7. Langfuse records trace
```

### Agent Execution Flow

```
User Message
    │
    ▼
┌─────────────────────┐
│ classify_intent     │ ← LLM classifies intent
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ shouldUseTools      │ ← Conditional routing
└─────────────────────┘
    │
    ├──→ 'use_tools' ──→ generate_tool_calls
    │                            │
    │                            ▼
    │                   ┌─────────────────────┐
    │                   │ tools (ToolNode)     │ ← Execute MCP tools
    │                   └─────────────────────┘
    │                            │
    │                            ▼
    │                   ┌─────────────────────┐
    │                   │ generate_response    │ ← LLM generates response
    │                   └─────────────────────┘
    │                            │
    └──→ 'direct_response' ──→ direct_response
                                     │
                                     ▼
                                  END
```

### Refund Flow (Human-in-the-Loop)

```
Refund Request
       │
       ▼
┌─────────────────────┐
│ classify_intent     │ → intent: 'refund_request'
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│ shouldUseTools      │ → 'human_review'
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│ interruptBefore      │ ← PAUSE - Wait for approval
│ [human_review]      │
└─────────────────────┘
       │
User approves via dashboard
       │
       ▼
┌─────────────────────┐
│ resume with config  │ → interruptValues: { approved: true }
└─────────────────────┘
       │
       ▼
┌─────────────────────┐
│ refund_request tool │ ← Process refund via Stripe
└─────────────────────┘
```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 15 | React framework, App Router |
| React 19 | UI components |
| Tailwind CSS | Styling |
| Server-Sent Events | Streaming responses |
| shadcn/ui | Component library |

### Backend
| Technology | Purpose |
|------------|---------|
| TypeScript | Type safety |
| OpenAI SDK | LLM interface |
| LangGraph | Agent orchestration |
| Prisma ORM | Database access |

### Database
| Technology | Purpose |
|------------|---------|
| PostgreSQL (Neon) | Primary database |
| pgvector | Vector embeddings |
| Redis | Caching, sessions |
| Qdrant | Vector search |

### AI/ML
| Technology | Purpose |
|------------|---------|
| Ollama | Local LLM inference |
| Qwen2.5-Coder | Code-optimized model |
| nomic-embed-text | Embedding model |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Vercel | Frontend deployment |
| Render | Worker deployment |
| Langfuse | Observability |

---

## Environment Configuration

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/db

# LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b

# Checkpointer
CHECKPOINT_TYPE=postgres

# Langfuse (Observability)
LANGFUSE_PUBLIC_KEY=pl_xxx
LANGFUSE_SECRET_KEY=sk_xxx
```

### Neon-Specific Configuration

```bash
NEON_POOL_MAX=5          # Limit connections for free tier
NEON_POOL_MIN=0
NEON_IDLE_TIMEOUT=30000
```

---

## Summary

The Smart Commerce Agent implements a modern, production-grade architecture:

| Aspect | Implementation |
|--------|----------------|
| **Orchestration** | LangGraph with explicit workflows |
| **State Management** | Annotation-based with persistent checkpointers |
| **Tool Execution** | MCP-style with Zod validation |
| **Search** | Hybrid: pgvector + Qdrant |
| **Observability** | Langfuse with scoring |
| **Deployment** | Serverless-ready ($0 with Neon) |

This architecture provides:
- **Reliability**: State persistence across sessions
- **Extensibility**: Easy to add new tools/intents
- **Observability**: Complete trace visibility
- **Cost Efficiency**: Free-tier cloud deployment
- **Type Safety**: End-to-end TypeScript + Zod
