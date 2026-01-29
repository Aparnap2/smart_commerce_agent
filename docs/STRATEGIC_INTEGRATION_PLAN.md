# Smart Commerce Agent - Strategic Integration Plan

## Executive Summary

This plan outlines the strategic integration of **LangGraph State Machines**, **Qdrant Vector Search**, **Redis Checkpointing**, **Langfuse Observability**, and **Netdata Monitoring** into the existing Smart Commerce Agent codebase.

**Current State:**
- LangGraph: DISABLED (API mismatch)
- Vector Search: pgvector only (no Qdrant)
- Redis Checkpointing: Infrastructure exists, not connected
- Observability: LLM evaluation exists, no tracing
- Monitoring: None

**Target Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      Smart Commerce Agent                        │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Agent Orchestration (LangGraph)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Supervisor  │  │  Refund     │  │    UI       │              │
│  │   Agent     │  │   Agent     │  │   Agent     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           StateGraph with Redis Checkpointing            │    │
│  │           (Persistent, Fault-Tolerant State)             │    │
│  └────────────────────────┬────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Tools & RAG (MCP-Style)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   db_query  │  │   RAG       │  │  Semantic   │              │
│  │  (Prisma)   │  │  (Qdrant)   │  │   Search    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
        │                   │                    │
        ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              Infrastructure Layer (Docker Compose)               │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Redis         │    Qdrant       │      PostgreSQL             │
│  (Checkpoint)   │  (Vector Store) │   (pgvector backup)         │
└─────────────────┴─────────────────┴─────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Observability & Monitoring                     │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Langfuse      │     Netdata     │      LLM Eval               │
│  (AI Tracing)   │  (Infra Mon)    │    (Ollama-based)           │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

---

## 1. LangGraph State Machine Integration

### Current State
- `lib/agents/supervisor.ts`: Returns `null` due to API version mismatch
- `lib/agents/state.ts`: Complete Zod-typed state definitions exist
- All agent graphs return `null`

### Target Implementation
Fix API version issues and enable LangGraph StateGraph with proper checkpointing.

### Implementation Steps

#### Step 1.1: Update LangGraph Dependencies
```bash
# Check current versions
pnpm list @langchain/langgraph

# Update to latest compatible version
pnpm add @langchain/langgraph@^0.2.74
pnpm add @langchain/langgraph-checkpoint-redis@^1.0.0
```

#### Step 1.2: Fix Supervisor Agent (`lib/agents/supervisor.ts`)

```typescript
// CURRENT (broken):
export function createSupervisorGraph() {
  return null; // "LangGraph supervisor disabled"
}

// TARGET:
import { StateGraph, END, START } from '@langchain/langgraph';
import { RedisSaver } from '@langchain/langgraph-checkpoint-redis';
import { AgentState, createInitialState } from './state';

export async function createSupervisorGraph(checkpointer: RedisSaver) {
  const workflow = new StateGraph<AgentState>({
    graph: {
      entryPoint: 'classify_intent',
      states: {
        agent: {
          on_done: 'execute_tools',
        },
      },
    },
  });

  // Node 1: Intent Classification
  workflow.addNode('classify_intent', async (state) => {
    const lastMessage = state.messages[state.messages.length - 1]?.content || '';
    // Classify: order_query | product_search | refund | support | general
    const intent = await classifyIntent(lastMessage);
    return { intent, currentAgent: intent };
  });

  // Node 2: Execute Tools (conditional routing)
  workflow.addNode('execute_tools', async (state) => {
    const tools = getToolsForIntent(state.currentAgent);
    return { toolResults: await executeTools(tools, state.messages) };
  });

  // Node 3: Generate Response
  workflow.addNode('generate_response', async (state) => {
    const response = await generateWithLLM(state.toolResults, state.messages);
    return { messages: [...state.messages, { role: 'assistant', content: response }] };
  });

  // Edges
  workflow.addEdge(START, 'classify_intent');
  workflow.addConditionalEdges(
    'classify_intent',
    (state) => state.currentAgent,
    {
      order_query: 'execute_tools',
      product_search: 'execute_tools',
      refund: 'execute_tools',
      support: 'execute_tools',
      general: 'generate_response',
    }
  );
  workflow.addEdge('execute_tools', 'generate_response');
  workflow.addEdge('generate_response', END);

  return workflow.compile({
    checkpointer,
    interruptBefore: ['execute_tools'], // Human-in-the-loop for refunds
  });
}
```

#### Step 1.3: Fix Tool Agent (`lib/agents/tool.ts`)

```typescript
// Enable tool execution with proper LangGraph integration
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { MCP工具Adapter } from '@/lib/mcp/adapter';

export async function createToolGraph(checkpointer: RedisSaver) {
  const mcpAdapter = new MCP工具Adapter();
  const tools = mcpAdapter.getToolDefinitions();
  const toolNode = new ToolNode(tools);

  const workflow = new StateGraph<AgentState>({
    graph: {
      entryPoint: 'check_tools',
    },
  });

  workflow.addNode('check_tools', toolNode);
  workflow.addEdge(START, 'check_tools');

  return workflow.compile({ checkpointer });
}
```

### Why This Approach Works
1. **Leverages existing code**: State definitions in `state.ts` are complete
2. **Fixes API mismatch**: Use `@langchain/langgraph-checkpoint-redis` for TypeScript
3. **Enables persistence**: Redis checkpointer connects existing infrastructure
4. **Human-in-the-loop**: InterruptBefore for refund approval workflows

---

## 2. Qdrant Vector Store Integration

### Current State
- `lib/rag/service.ts`: pgvector only, 768-dim embeddings with `nomic-embed-text`
- `prisma/schema.prisma`: Has `ProductEmbedding` with `Unsupported("vector(384)")`

### Decision Matrix: pgvector vs Qdrant

| Criterion | pgvector (Current) | Qdrant (Proposed) | Winner |
|-----------|-------------------|-------------------|--------|
| **Setup Complexity** | Single binary (PostgreSQL) | Separate service | pgvector |
| **Search Performance** | ~471 QPS @ 99% recall | ~1000+ QPS @ 99% recall | **Qdrant** |
| **Scalability** | Limited to single node | Distributed, shardable | **Qdrant** |
| **Hybrid Search** | Requires extensions | Native (vector + keyword) | **Qdrant** |
| **Memory Efficiency** | Shared with PostgreSQL | Optimized for vectors | **Qdrant** |
| **Integration** | Already in codebase | New container | pgvector |

### Recommendation: **Add Qdrant as Primary, Keep pgvector as Backup**

### Implementation Steps

#### Step 2.1: Add Qdrant Docker Service
```yaml
# docker-compose.yml - Add Qdrant
services:
  qdrant:
    image: qdrant/qdrant:latest
    container_name: smart-commerce-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      - QDRANT__SERVICE__API_KEY=${QDRANT_API_KEY:-}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/dashboard"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  qdrant_data:
```

#### Step 2.2: Create Qdrant Service (`lib/vector/qdrant.ts`)

```typescript
import { QdrantClient } from '@qdrant/node-client';
import { env } from '@/lib/env';

export class QdrantService {
  private client: QdrantClient;
  private collectionName = 'products';

  constructor() {
    this.client = new QdrantClient({
      url: env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });
  }

  async initialize() {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(c => c.name === this.collectionName);

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: 768, // nomic-embed-text dimension
          distance: 'Cosine',
        },
        optimizers: {
          default_segment_number: 2,
        },
      });
      console.log('[Qdrant] Collection "products" created');
    }
  }

  async upsertProducts(products: Array<{ id: string; name: string; description: string; price: number }>) {
    const points = await Promise.all(
      products.map(async (product) => {
        const embedding = await this.generateEmbedding(product.description);
        return {
          id: product.id,
          vector: embedding,
          payload: {
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
          },
        };
      })
    );

    await this.client.upsert(this.collectionName, { points });
    console.log(`[Qdrant] Upserted ${points.length} product embeddings`);
  }

  async search(query: string, limit = 10) {
    const queryVector = await this.generateEmbedding(query);
    const results = await this.client.search(this.collectionName, {
      query: queryVector,
      limit,
      with_payload: true,
      score_threshold: 0.7,
    });
    return results;
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use existing Ollama embedding endpoint
    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.EMBEDDING_MODEL || 'nomic-embed-text',
        prompt: text,
      }),
    });
    const data = await response.json();
    return data.embedding;
  }
}

export const qdrantService = new QdrantService();
```

#### Step 2.3: Hybrid Search Service (`lib/search/hybrid.ts`)

```typescript
import { qdrantService } from '@/lib/vector/qdrant';
import { prisma } from '@/lib/prisma';

export async function hybridSearch(query: string, options?: { priceRange?: [number, number]; category?: string }) {
  // 1. Vector search via Qdrant
  const vectorResults = await qdrantService.search(query, 20);

  // 2. Keyword filtering via PostgreSQL
  const dbResults = await prisma.product.findMany({
    where: {
      ...(options?.category && { category: options.category }),
      ...(options?.priceRange && {
        price: { gte: options.priceRange[0], lte: options.priceRange[1] }
      }),
    },
    take: 20,
  });

  // 3. Re-rank and merge
  const merged = mergeResults(vectorResults, dbResults);
  return merged.slice(0, 10);
}
```

### Migration Strategy
1. **Phase 1**: Run Qdrant alongside pgvector (dual-write)
2. **Phase 2**: Migrate production traffic to Qdrant
3. **Phase 3**: Keep pgvector as backup/fallback

---

## 3. Redis Checkpointing Integration

### Current State
- `lib/redis/checkpointer.ts`: `RedisCheckpointSaver` class exists, returns `null`
- `lib/redis/config.ts`: Full Redis connection config exists
- LangGraph API incompatible

### Target: Connect existing Redis infrastructure to LangGraph

### Implementation Steps

#### Step 3.1: Use Official Redis Checkpointer Package
```bash
pnpm add @langchain/langgraph-checkpoint-redis
```

#### Step 3.2: Update Checkpointer Service (`lib/redis/checkpointer.ts`)

```typescript
import { RedisSaver } from '@langchain/langgraph-checkpoint-redis';
import { createClient } from 'redis';
import { env } from '@/lib/env';

let checkpointer: RedisSaver | null = null;

export async function getCheckpointSaver(): Promise<RedisSaver> {
  if (checkpointer) return checkpointer;

  const client = createClient({
    url: env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 3) return new Error('Redis connection failed');
        return Math.min(retries * 100, 3000);
      },
    },
  });

  client.on('error', (err) => console.error('[Redis] Error:', err));
  await client.connect();

  checkpointer = new RedisSaver({ client });

  // Initialize indices
  await checkpointer.setup();

  console.log('[Redis] Checkpointer initialized');
  return checkpointer;
}

export async function closeCheckpointSaver() {
  if (checkpointer) {
    await checkpointer.client.quit();
    checkpointer = null;
  }
}
```

#### Step 3.3: Integrate with Chat API (`app/api/chat/route.ts`)

```typescript
import { getCheckpointSaver } from '@/lib/redis/checkpointer';

// In POST handler:
const checkpointer = await getCheckpointSaver();

// Compile graph with checkpointer
const graph = await createSupervisorGraph(checkpointer);

// Invoke with thread_id for persistence
const config = {
  configurable: {
    thread_id: userEmail || 'anonymous',
    checkpoint_ns: 'chat_session',
  },
};

const result = await graph.invoke({ messages }, config);
```

### Benefits
1. **Conversation Continuity**: Users can resume chats after disconnect
2. **Fault Tolerance**: Recover from mid-processing failures
3. **Audit Trail**: Full history of agent decisions

---

## 4. Langfuse Observability Integration

### Current State
- `scripts/llm_eval.py`: Ollama-based LLM evaluation exists
- No real-time tracing

### Target: Full Langfuse integration for AI observability

### Implementation Steps

#### Step 4.1: Install Dependencies
```bash
pnpm add langfuse @langfuse/peeweep
```

#### Step 4.2: Create Langfuse Service (`lib/observability/langfuse.ts`)

```typescript
import { Langfuse } from 'langfuse';
import { env } from '@/lib/env';

export const langfuse = new Langfuse({
  publicKey: env.LANGFUSE_PUBLIC_KEY || 'pk-...',
  secretKey: env.LANGFUSE_SECRET_KEY || 'sk-...',
  baseUrl: env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
});

export async function createTrace(name: string, metadata?: Record<string, unknown>) {
  return langfuse.trace({
    name,
    metadata: {
      ...metadata,
      userId: metadata?.userEmail || 'anonymous',
      environment: env.NODE_ENV || 'development',
    },
  });
}
```

#### Step 4.3: Wrap LLM Calls with Tracing (`lib/observability/wrap-llm.ts`)

```typescript
import { langfuse, createTrace } from './langfuse';

export async function tracedLLMCall<T>(
  prompt: string,
  options: {
    model: string;
    temperature?: number;
    userId?: string;
    tags?: string[];
  }
): Promise<T> {
  const generation = langfuse.generation({
    name: 'llm_call',
    input: prompt,
    model: options.model,
    modelParameters: {
      temperature: options.temperature ?? 0.7,
    },
    userId: options.userId,
    tags: options.tags,
  });

  try {
    const response = await fetch(`${env.OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });

    const data = await response.json();
    const output = data.choices[0].message.content;

    generation.end({
      output,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
      },
    });

    return output as T;
  } catch (error) {
    generation.end({
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
```

#### Step 4.4: Trace LangGraph Execution

```typescript
import { langfuse } from './langfuse';

// Wrap graph invocation
async function tracedGraphInvoke(graph, state, config) {
  const trace = await createTrace('langgraph_execution', {
    threadId: config.configurable?.thread_id,
    nodeCount: Object.keys(state).length,
  });

  try {
    const span = trace.span({ name: 'graph_invoke' });
    const result = await graph.invoke(state, config);
    span.end({ output: result });
    return result;
  } catch (error) {
    trace.event({
      name: 'error',
      level: 'ERROR',
      input: error.message,
    });
    throw error;
  }
}
```

### Langfuse Dashboard Insights
```
┌─────────────────────────────────────────────────────────────────┐
│                    Langfuse Dashboard                            │
├─────────────────────────────────────────────────────────────────┤
│  📊 Metrics:                                                    │
│  • Token Usage: $0.024/1K tokens (Ollama = free locally)        │
│  • Latency P50: 342ms | P95: 1.2s | P99: 3.4s                   │
│  • Error Rate: 2.3%                                             │
│                                                                 │
│  🔍 Traces:                                                     │
│  • "user asked about order #12345"                              │
│    └─> classify_intent (45ms) ✓                                 │
│    └─> execute_tools (120ms) ✓                                  │
│    └─> generate_response (280ms) ✓                              │
│                                                                 │
│  🎯 Quality Scores:                                             │
│  • Tool Correctness: 0.85                                       │
│  • Answer Relevancy: 0.72                                       │
│  • Faithfulness: 0.68                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Netdata Infrastructure Monitoring

### Current State
- No infrastructure monitoring
- Docker services running without visibility

### Target: Real-time per-second monitoring with Netdata

### Implementation Steps

#### Step 5.1: Add Netdata to Docker Compose

```yaml
# docker-compose.yml - Add Netdata
services:
  netdata:
    image: netdata/netdata:latest
    container_name: smart-commerce-netdata
    hostname: smart-commerce
    pid: host
    network_mode: host
    restart: unless-stopped
    cap_add:
      - SYS_PTRACE
    security_opt:
      - apparmor:unconfined
    volumes:
      - netdata_config:/etc/netdata
      - netdata_lib:/var/lib/netdata
      - netdata_cache:/var/cache/netdata
      - /:/host/root:ro,rslave
      - /etc/passwd:/host/etc/passwd:ro
      - /etc/group:/host/etc/group:ro
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - NETDATA_CLAIM_TOKEN=${NETDATA_CLAIM_TOKEN}
      - NETDATA_CLAIM_URL=https://app.netdata.cloud

volumes:
  netdata_config:
  netdata_lib:
  netdata_cache:
```

#### Step 5.2: Start All Services
```bash
# Create startup script
cat > scripts/start-infrastructure.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Smart Commerce Agent Infrastructure..."

# Start core services
docker compose up -d

# Wait for services
sleep 5

# Verify services
echo "✅ Services running:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Show Netdata URL
echo ""
echo "🌐 Netdata Dashboard: http://localhost:19999"
echo "📊 Qdrant Dashboard: http://localhost:6333/dashboard"
echo "🗄️  PostgreSQL: localhost:5432"
echo "🔴 Redis: localhost:6379"
EOF
chmod +x scripts/start-infrastructure.sh
```

#### Step 5.3: Monitor Key Metrics

**Netdata automatically monitors:**
- CPU/Memory per container
- Docker container health
- Network I/O
- Disk I/O
- PostgreSQL queries/connections
- Redis memory/ops/sec
- Qdrant collection size/search latency

**Custom metrics to add:**
```bash
# Create Netdata Python plugin for custom metrics
cat > /opt/netdata/python.d/custom.conf << 'EOF'
smart_commerce:
  command: python3 /opt/netdata/custom_metrics.py
EOF
```

### Netdata Dashboard Preview
```
┌─────────────────────────────────────────────────────────────────┐
│              Netdata - Smart Commerce Agent                      │
├─────────────────────────────────────────────────────────────────┤
│  🔧 System: Linux 6.8.0 | CPU: 8 cores | RAM: 16GB             │
│                                                                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │   CPU %     │   RAM GB    │   Disk I/O  │  Net I/O    │     │
│  │   ████░░    │   ██████░░  │   ██░░░░░   │  █░░░░░░    │     │
│  │   45%       │   8.2/16     │   25 MB/s   │   5 MB/s    │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
│                                                                 │
│  🐳 Containers:                                                 │
│  • smart-commerce-ollama     🟢 running  |  1.2 GB RAM          │
│  • smart-commerce-qdrant     🟢 running  |  256 MB RAM          │
│  • smart-commerce-postgres   🟢 running  |  512 MB RAM          │
│  • smart-commerce-redis      🟢 running  |   45 MB RAM          │
│  • smart-commerce-netdata    🟢 running  |  128 MB RAM          │
│                                                                 │
│  📈 PostgreSQL:                                                 │
│  • Connections: 12/100                                          │
│  • Queries/sec: 145                                             │
│  • Cache Hit Ratio: 99.2%                                       │
│                                                                 │
│  🔴 Redis:                                                      │
│  • Memory Used: 45 MB / 1 GB                                    │
│  • Ops/sec: 1,234                                               │
│  • Key Count: 15,432                                            │
│                                                                 │
│  🔍 Qdrant:                                                     │
│  • Collection Size: 1,234 vectors                               │
│  • Search Latency: 12ms P95                                     │
│  • Disk Usage: 156 MB                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Consolidated Docker Compose

```yaml
version: '3.8'

services:
  # Vector Database (Primary)
  qdrant:
    image: qdrant/qdrant:latest
    container_name: smart-commerce-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Cache & Checkpoints
  redis:
    image: redis:7-alpine
    container_name: smart-commerce-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Primary Database
  postgres:
    image: pgvector/pgvector:pg17
    container_name: smart-commerce-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: smart_commerce
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Local LLM
  ollama:
    image: ollama/ollama:latest
    container_name: smart-commerce-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=24h
      - OLLAMA_NUM_PARALLEL=2
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/version"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Infrastructure Monitoring
  netdata:
    image: netdata/netdata:latest
    container_name: smart-commerce-netdata
    pid: host
    network_mode: host
    restart: unless-stopped
    cap_add:
      - SYS_PTRACE
    security_opt:
      - apparmor:unconfined
    volumes:
      - netdata_config:/etc/netdata
      - netdata_lib:/var/lib/netdata
      - netdata_cache:/var/cache/netdata
      - /:/host/root:ro,rslave
      - /etc/passwd:/host/etc/passwd:ro
      - /etc/group:/host/etc/group:ro
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro

volumes:
  qdrant_data:
  redis_data:
  postgres_data:
  ollama_data:
  netdata_config:
  netdata_lib:
  netdata_cache:
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Update LangGraph dependencies to latest stable versions
- [ ] Fix Supervisor Agent (`lib/agents/supervisor.ts`)
- [ ] Enable Redis checkpointer with `@langchain/langgraph-checkpoint-redis`
- [ ] Verify LangGraph StateGraph compilation

### Phase 2: Vector Store (Week 2)
- [ ] Add Qdrant to docker-compose
- [ ] Create `lib/vector/qdrant.ts` service
- [ ] Implement hybrid search (`lib/search/hybrid.ts`)
- [ ] Dual-write to pgvector and Qdrant
- [ ] Migrate existing embeddings

### Phase 3: Observability (Week 3)
- [ ] Add Langfuse integration
- [ ] Wrap LLM calls with tracing
- [ ] Trace LangGraph execution
- [ ] Create custom Langfuse metrics

### Phase 4: Monitoring (Week 4)
- [ ] Add Netdata to docker-compose
- [ ] Configure auto-discovery of containers
- [ ] Set up alerts for key metrics
- [ ] Create infrastructure dashboard

### Phase 5: Integration & Testing (Week 5)
- [ ] End-to-end integration testing
- [ ] Performance benchmarking (Qdrant vs pgvector)
- [ ] Latency verification with Langfuse
- [ ] Load testing with Netdata monitoring
- [ ] Documentation update

---

## 8. Interview Talking Points

### The "Architect" Narrative

> "I built a deterministic, stateful agent using graph theory, not just a chaotic prompt loop."

### Key Discussion Points

1. **Why LangGraph?**
   - "State machines provide predictable, debuggable control flow"
   - "Checkpointing enables fault-tolerant, resumable conversations"
   - "Human-in-the-loop for approval workflows (e.g., refunds)"

2. **Why Qdrant over pgvector?**
   - "Qdrant handles 2x throughput with 10x lower latency at scale"
   - "Native hybrid search (vector + keyword) without PostgreSQL extensions"
   - "Sharding enables horizontal scaling as catalog grows"

3. **Why separate observability (Langfuse) from monitoring (Netdata)?**
   - "Langfuse traces AI-specific metrics: token cost, hallucination detection"
   - "Netdata monitors infrastructure: CPU, memory, container health"
   - "Together they provide full-stack visibility from LLM to metal"

4. **Why Netdata over Prometheus/Grafana?**
   - "Netdata installs in one command, auto-discovers all containers"
   - "Per-second granularity out of the box (no configuration)"
   - "Zero YAML engineering required"

5. **Operational Simplicity**
   - "Single docker-compose up -d brings up the entire stack"
   - "No Kubernetes, no Terraform, no external services"
   - "Can run on a laptop, deploy to production with same config"

---

## 9. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Qdrant memory usage | Medium | Start with small collection, monitor growth |
| LangGraph API changes | Medium | Pin to specific version, comprehensive tests |
| Redis persistence | Low | Keep pgvector as backup for checkpoints |
| Netdata resource overhead | Low | Resource limits in docker-compose |

---

## 10. Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Agent Response Latency | N/A (disabled) | < 2s P95 | Langfuse |
| Vector Search Latency | 45ms (pgvector) | < 20ms | Netdata |
| Checkpoint Recovery Time | N/A | < 500ms | Langfuse |
| System Uptime | N/A | 99.9% | Netdata |
| Tool Correctness Score | 0.35 | > 0.80 | LLM Eval |
| Answer Relevancy Score | 0.20 | > 0.70 | LLM Eval |

---

## Appendix: Quick Reference Commands

```bash
# Start infrastructure
./scripts/start-infrastructure.sh

# View logs
docker compose logs -f

# Check Qdrant
curl http://localhost:6333/collections

# Check Redis
redis-cli ping

# View Netdata
# Open http://localhost:19999

# View Langfuse
# Open https://cloud.langfuse.com

# Run LLM evaluation
source .venv/bin/activate && python scripts/llm_eval.py

# Run E2E tests
pnpm test:e2e
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-29
**Status:** Ready for Implementation
