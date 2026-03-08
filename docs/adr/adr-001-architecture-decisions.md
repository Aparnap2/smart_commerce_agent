# Architecture Decision Records (ADR)

This document contains the architectural decisions made for the Smart Commerce Agent project.

## Table of Contents

1. [ADR-001: LangGraph for Agent Orchestration](#adr-001-langgraph-for-agent-orchestration)
2. [ADR-002: Multi-Checkpointer Strategy](#adr-002-multi-checkpointer-strategy)
3. [ADR-003: Qdrant for Vector Search](#adr-003-qdrant-for-vector-search)
4. [ADR-004: Ollama for Local LLM Inference](#adr-004-ollama-for-local-llm-inference)
5. [ADR-005: Langfuse for Observability](#adr-005-langfuse-for-observability)
6. [ADR-006: Intent Classification Router](#adr-006-intent-classification-router)
7. [ADR-007: Human-in-the-Loop for Refunds](#adr-007-human-in-the-loop-for-refunds)
8. [ADR-008: Dual-Mode Scoring System](#adr-008-dual-mode-scoring-system)
9. [ADR-009: Cloud-Native Free Tier Architecture](#adr-009-cloud-native-free-tier-architecture)

---

## ADR-001: LangGraph for Agent Orchestration

**Date:** 2024-01-15
**Status:** Accepted

### Context

The Smart Commerce Agent requires sophisticated workflow management with:
- Stateful conversation context preservation
- Multi-step task orchestration
- Conditional branching based on user intent
- Tool execution with retry logic

### Decision

We chose **LangGraph** for agent orchestration over alternatives like LangChain Agents or custom state machines.

### Reasoning

1. **Explicit Workflow Control**: LangGraph provides fine-grained control over agent flow with explicit node and edge definitions
2. **Persistent State**: Built-in checkpointers enable conversation continuity across sessions
3. **Human-in-the-Loop**: Native support for interruptBefore allows approval workflows for sensitive operations
4. **Type Safety**: Annotation-based state schema provides compile-time type checking
5. **Debugger Integration**: LangGraph Studio enables visual debugging of agent workflows

### Consequences

**Benefits:**
- Clear, maintainable agent workflow structure
- Reliable state persistence across conversations
- Easy to add new nodes and routing logic
- Excellent debugging with LangGraph Studio

**Drawbacks:**
- Additional dependency complexity
- Learning curve for team unfamiliar with graph-based architectures
- ToolNode type compatibility requires careful handling

### Implementation Details

```typescript
const StateAnnotation = Annotation.Root({
  messages: Annotation<Message[]>({
    reducer: (left, right) => [...left, ...right],
    default: () => [],
  }),
  intent: Annotation<IntentClassification | undefined>({
    reducer: (prev, next) => next ?? prev,
  }),
  toolResults: Annotation<unknown[]>({
    reducer: (left, right) => [...(left || []), ...(right || [])],
    default: () => [],
  }),
});
```

---

## ADR-002: Multi-Checkpointer Strategy

**Date:** 2024-01-16
**Status:** Accepted

### Context

LangGraph requires checkpointers for state persistence. Different environments have different requirements:
- Development: In-memory for speed
- Production: Redis for scalability or Postgres for data consistency

### Decision

Implement a **multi-checkpointer factory pattern** supporting memory, Redis, and PostgreSQL checkpointers.

### Reasoning

1. **Environment Flexibility**: Different environments have different needs
2. **Cost Optimization**: Use in-memory for testing, Redis/Postgres for production
3. **Data Consistency**: Postgres checkpointer integrates with existing database
4. **Scalability**: Redis provides fast state access with TTL support

### Consequences

**Benefits:**
- Single configuration point for checkpointer selection
- Graceful fallback if preferred checkpointer is unavailable
- TTL support via Redis for automatic state expiration
- Connection pooling via Prisma for Postgres

**Drawbacks:**
- Additional abstraction layer complexity
- Connection management overhead for multiple backends

### Implementation Details

```typescript
export async function createCheckpointer(
  config?: CheckpointConfig
): Promise<AnyCheckpointer> {
  const type = config?.type || env.CHECKPOINT_TYPE || 'memory';
  switch (type) {
    case 'redis': return await initializeRedisCheckpointer(config);
    case 'postgres': return await initializePostgresCheckpointer(config);
    default: return new MemorySaver();
  }
}
```

### Configuration

```bash
CHECKPOINT_TYPE=redis|memory|postgres
# Redis options
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional
REDIS_DB=0
# Postgres options (via DATABASE_URL)
```

---

## ADR-003: Qdrant for Vector Search

**Date:** 2024-01-17
**Status:** Accepted

### Context

Product search requires semantic similarity matching beyond keyword matching. Users should find products using natural language queries.

### Decision

Deploy **Qdrant** as the vector database for product embeddings.

### Reasoning

1. **Rust-Based Performance**: Qdrant is written in Rust, providing excellent performance
2. **Docker Native**: Easy deployment alongside other infrastructure
3. **REST API**: Simple HTTP interface for integration
4. **Filtering Support**: Supports metadata filtering alongside vector search
5. **Persistent Storage**: Disk-based storage for production durability

### Consequences

**Benefits:**
- Fast semantic product search
- Natural language query support
- Low memory footprint compared to alternatives
- Easy horizontal scaling

**Drawbacks:**
- Additional infrastructure component to maintain
- Requires embedding model for product vectorization
- Learning curve for optimal HNSW index tuning

### Implementation Details

```typescript
// Product embedding generation
const embeddings = new OllamaEmbeddings({
  model: env.OLLAMA_EMBEDDING_MODEL,
  baseUrl: env.OLLAMA_BASE_URL,
});

// Semantic product search
const results = await qdrantClient.search('products', {
  vector: embeddings.embedQuery(query),
  limit: 10,
  score_threshold: 0.5,
  filter: category ? { must: [{ key: 'category', match: { value: category } }] } : undefined,
});
```

---

## ADR-004: Ollama for Local LLM Inference

**Date:** 2024-01-18
**Status:** Accepted

### Context

The agent requires LLM capabilities for:
- Intent classification
- Response generation
- Tool call argument extraction

### Decision

Use **Ollama** for local LLM inference with the Qwen2.5-Coder model.

### Reasoning

1. **Privacy**: No data leaves the local environment
2. **Cost Control**: No per-token API costs
3. **Development Speed**: No API key management during development
4. **Model Choice**: Qwen2.5-Coder optimized for code and structured tasks
5. **Consistency**: Same model for all LLM operations

### Consequences

**Benefits:**
- Zero API costs for development and testing
- Complete data privacy
- Offline operation capability
- Consistent response quality

**Drawbacks:**
- Requires local GPU/memory resources
- Slower inference compared to cloud APIs
- Model updates require manual pulls
- Limited context window

### Configuration

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=384
```

---

## ADR-005: Langfuse for Observability

**Date:** 2024-01-19
**Status:** Accepted

### Context

Agent observability requires:
- Trace visualization for debugging
- Performance metrics
- Quality scoring
- Session analytics

### Decision

Integrate **Langfuse** for end-to-end observability with custom scoring.

### Reasoning

1. **LangGraph Native**: First-class support for LangGraph tracing
2. **Scoring System**: Built-in support for trace scoring and evaluation
3. **Self-Hosted Option**: Can run locally or use cloud
4. **Dashboard**: Rich UI for trace exploration
5. **LLM Cost Tracking**: Token usage and cost analytics

### Consequences

**Benefits:**
- Complete visibility into agent execution
- Identifies bottlenecks and failure points
- Enables quality metrics over time
- Debug complex multi-turn conversations

**Drawbacks:**
- Additional infrastructure (self-hosted) or cost (cloud)
- Tracing overhead (managed via sampling)
- Configuration complexity

### Implementation Details

```typescript
// Initialize Langfuse
const langfuse = initializeLangfuse({
  publicKey: env.LANGFUSE_PUBLIC_KEY,
  secretKey: env.LANGFUSE_SECRET_KEY,
  baseUrl: env.LANGFUSE_BASE_URL,
});

// Create trace for agent session
const trace = createAgentTrace('supervisor', { input: message }, {
  threadId,
  userId,
});

// Add spans for each node
const span = createNodeSpan(trace, 'classify_intent', { message });
```

---

## ADR-006: Intent Classification Router

**Date:** 2024-01-20
**Status:** Accepted

### Context

User queries need to be routed to appropriate tools or agents based on intent:
- Product search queries
- Order inquiry requests
- Inventory checks
- Refund requests
- General support questions

### Decision

Implement **LLM-based intent classification** as the first node in the agent workflow.

### Reasoning

1. **Accuracy**: LLM classification handles natural language variability
2. **Extensibility**: Easy to add new intent types
3. **Context Awareness**: Classification considers full conversation context
4. **Confidence Scores**: Enables fallback routing for low-confidence results

### Consequences

**Benefits:**
- Handles diverse user query formats
- Graceful degradation with confidence thresholds
- Clear routing logic for tool selection
- Easy to audit classification decisions

**Drawbacks:**
- Additional LLM call latency
- Classification can occasionally misclassify
- Requires prompt engineering for accuracy

### Implementation Details

```typescript
async function classifyIntentNode(state: typeof StateAnnotation.State) {
  const response = await fetch(`${env.OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      messages: [{
        role: 'system',
        content: `Classify the user query into one of:
        - product_search: "find/show/recommend products"
        - order_inquiry: "track/order status"
        - inventory_check: "is X in stock"
        - refund_request: "refund/money back"
        - general_support: "other questions"
        Respond with JSON: {"intent": "...", "confidence": 0.x}`,
      }, { role: 'user', content: lastMessage }],
      format: { type: 'json_object' },
    }),
  });
  // ... parse and return intent
}
```

---

## ADR-007: Human-in-the-Loop for Refunds

**Date:** 2024-01-21
**Status:** Accepted

### Context

Refund requests require human approval before processing:
- Financial risk mitigation
- Customer satisfaction verification
- Compliance requirements
- Fraud prevention

### Decision

Use LangGraph's **interruptBefore** feature to pause workflow for human approval on refund requests.

### Reasoning

1. **Risk Mitigation**: Prevents unauthorized refunds
2. **Customer Service**: Human oversight ensures fair handling
3. **Audit Trail**: Clear approval records
4. **Simple Implementation**: Native LangGraph feature

### Consequences

**Benefits:**
- Complete control over refund process
- Audit trail of approvals
- Fraud prevention
- Customer trust

**Drawbacks:**
- Slower refund processing
- Requires human availability
- May frustrate users expecting instant refunds

### Implementation Details

```typescript
const compiled = workflow.compile({
  checkpointer,
  interruptBefore: ['human_review'], // Pause before human review
});

// To resume after approval:
await graph.invoke(state, {
  ...config,
  interruptValues: [{ approved: true, approvedBy: 'agent-123' }],
});
```

---

## ADR-008: Dual-Mode Scoring System

**Date:** 2024-01-22
**Status:** Accepted

### Context

Agent response quality needs evaluation for:
- Continuous improvement
- Session analytics
- Identifying training data needs
- A/B testing validation

### Decision

Implement **dual-mode scoring** with LLM evaluation and rule-based fallback.

### Reasoning

1. **Comprehensive Evaluation**: LLM provides nuanced quality assessment
2. **Reliability**: Fallback ensures scoring always available
3. **Cost Control**: Fallback reduces LLM costs for high-volume sessions
4. **Multi-Dimensional**: Scores across relevance, accuracy, completeness, coherence

### Consequences

**Benefits:**
- Rich quality metrics for each interaction
- Always-available scoring (no dependencies)
- Cost-effective at scale
- Actionable feedback for improvement

**Drawbacks:**
- LLM evaluation adds latency
- Evaluation quality depends on evaluation model
- Requires prompt engineering for consistent scoring

### Implementation Details

```typescript
async function evaluateWithLLM(query: string, response: string) {
  const prompt = `You are an expert evaluator for a customer support AI agent.
  Evaluate the response on: relevance, accuracy, completeness, coherence, helpfulness.
  Respond with JSON: { "scores": { ... }, "feedback": [...] }`;

  const response = await fetch(`${env.OLLAMA_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    body: JSON.stringify({
      model: env.OLLAMA_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      format: { type: 'json_object' },
    }),
  });
  // ... parse and return scores
}

function createFallbackScoring(query: string, response: string) {
  // Rule-based scoring when LLM unavailable
  const queryWords = query.toLowerCase().split(/\s+/);
  const relevance = calculateKeywordMatch(queryWords, response);
  // ... return fallback scores
}
```

---

## Summary

| ADR  | Decision                 | Key Benefit                              |
|------|--------------------------|------------------------------------------|
| 001  | LangGraph                | Explicit workflow control + persistence |
| 002  | Multi-checkpointer       | Environment flexibility                 |
| 003  | Qdrant                   | Semantic product search                 |
| 004  | Ollama                   | Local, cost-free LLM inference          |
| 005  | Langfuse                 | Complete observability                  |
| 006  | Intent Router            | Intelligent query routing               |
| 007  | Human-in-loop            | Refund approval workflow                |
| 008  | Dual-mode scoring        | Reliable quality evaluation             |

---

## Revision History

| Version | Date       | Author                | Changes   |
|---------|------------|-----------------------|-----------|
| 1.0     | 2024-01-22 | Smart Commerce Agent Team | Initial ADRs |

---

## ADR-009: Cloud-Native Free Tier Architecture

**Date:** 2024-01-30
**Status:** Accepted

### Context

Deploying the Smart Commerce Agent on a $0 budget requires avoiding heavy self-hosted infrastructure:
- Docker containers for PostgreSQL/Redis/Qdrant consume ~2GB RAM
- Free tier VPS (512MB RAM) cannot run the full stack
- Serverless platforms offer free tiers with identical APIs

### Decision

Adopt a **hybrid cloud architecture** using serverless free tiers:

| Component      | Local Docker            | Cloud (Free)              | Notes                                          |
|----------------|-------------------------|---------------------------|------------------------------------------------|
| Database       | pgvector/PostgreSQL     | **Neon.tech**             | Serverless Postgres, 100GB storage            |
| State Store    | Redis                   | **Neon Postgres**         | LangGraph uses Postgres checkpointer          |
| Vector DB      | Qdrant                  | **Qdrant Cloud**          | Free cluster, 1GB storage                     |
| Observability  | Langfuse (self)         | **Langfuse Cloud**        | 50K traces/month free                         |
| Hosting        | Docker                  | **Vercel + Render**       | Next.js + Workers                             |

### Reasoning

1. **Cost**: $0 monthly cost for all infrastructure
2. **Compatibility**: Neon uses standard PostgreSQL protocol
3. **Scalability**: Serverless auto-scales (within free limits)
4. **Developer Experience**: Same code works locally and on cloud

### Implementation Details

```typescript
// lib/redis/langgraph-checkpoint.ts
function buildPostgresPoolOptions(config?: CheckpointConfig): PoolConfig {
  const connectionString = config?.postgresUrl || env.DATABASE_URL;

  // Neon detection for optimized pool sizing
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

**Environment Configuration:**
```bash
# Neon Postgres (required for production)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/db

# Checkpointer type
CHECKPOINT_TYPE=postgres

# Neon pool settings (serverless-optimized)
NEON_POOL_MAX=5
NEON_POOL_MIN=0
NEON_IDLE_TIMEOUT=30000
```

### Consequences

**Benefits:**
- Zero infrastructure costs
- Automatic backups (Neon)
- No server maintenance
- Global availability

**Drawbacks:**
- Cold starts on serverless platforms
- Connection limits (Neon: 100 concurrent)
- Cannot run local Docker stack on cloud

### Migration Path

1. Keep `docker-compose.yml` for local development
2. Add cloud-specific environment variables to `lib/env.js`
3. Deploy to Vercel (frontend) + Render (workers)
4. Point `DATABASE_URL` to Neon

### References

- [Neon Free Tier](https://neon.tech/docs/introduction/free-tier)
- [Vercel Serverless](https://vercel.com/docs/serverless-functions)
- [Render Free Tier](https://render.com/docs/free)

---

## References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [Ollama Documentation](https://ollama.com/)
- [Langfuse Documentation](https://langfuse.com/docs/)
- [Neon Serverless Postgres](https://neon.tech/docs/introduction)
- [Vercel Deployment](https://nextjs.org/docs/deployment)
