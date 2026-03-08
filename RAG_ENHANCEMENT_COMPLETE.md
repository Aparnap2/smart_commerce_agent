# RAG Enhancement Implementation - Complete Documentation

## Overview

This document provides comprehensive documentation for the enhanced RAG (Retrieval-Augmented Generation) system implementation. The implementation follows a phased approach covering accuracy improvements, query optimization, traceability, and production-ready features.

## Implementation Summary

### ✅ Week 1: RAG Accuracy Improvements

#### 1. Semantic Chunking (`lib/rag/semantic-chunker.ts`)

**Purpose**: Replace naive text splitting with semantics-aware chunking for better retrieval quality.

**Features**:
- Sentence and paragraph boundary detection
- Embedding-based similarity merging (threshold: 0.85)
- Configurable chunk size and overlap
- Automatic fallback to legacy chunking

**Key Functions**:
```typescript
// Main chunking function
export async function semanticChunk(
  text: string,
  options: Partial<SemanticChunkerConfig> = {}
): Promise<string[]>

// Legacy wrapper
export async function chunkTextSemantic(
  text: string,
  chunkSize: number = 500,
  chunkOverlap: number = 50
): Promise<string[]>
```

**Configuration**:
```typescript
interface SemanticChunkerConfig {
  maxChunkSize: number;      // Default: 800
  minChunkSize: number;      // Default: 200
  chunkOverlap: number;      // Default: 100
  similarityThreshold: number; // Default: 0.85
  maxChunks?: number;        // Default: 100
}
```

**Usage**:
```typescript
import { semanticChunk } from './lib/rag/semantic-chunker.js';

const chunks = await semanticChunk(documentContent, {
  maxChunkSize: 600,
  similarityThreshold: 0.9,
});
```

**Tests**: 22 unit tests covering sentence splitting, paragraph handling, similarity merging, and edge cases.

---

#### 2. Cross-Encoder Reranker (`lib/rag/reranker.ts`)

**Purpose**: Improve retrieval relevance by reranking candidates using cross-encoder scoring.

**Features**:
- Ollama-based relevance scoring
- Configurable top-K selection
- Minimum score threshold filtering
- Batch reranking support
- Simple text-based fallback scorer

**Key Functions**:
```typescript
// Main reranking function
export async function rerankCandidates(
  query: string,
  candidates: RerankCandidate[],
  options: Partial<RerankerConfig> = {}
): Promise<RerankResult[]>

// Batch processing
export async function rerankBatch(
  queryDocs: Array<{ query: string; candidates: RerankCandidate[] }>,
  options: Partial<RerankerConfig> = {}
): Promise<RerankResult[][]>

// Fallback scorer
export function simpleRelevanceScore(query: string, document: string): number
```

**Configuration**:
```typescript
interface RerankerConfig {
  model: 'ollama' | 'cross-encoder';
  ollamaModel?: string;      // Default: 'qwen2.5-coder:3b'
  ollamaBaseUrl?: string;    // Default: from env
  topK: number;              // Default: 5
  minScore?: number;         // Default: 0.1
}
```

**Usage**:
```typescript
import { rerankCandidates } from './lib/rag/reranker.js';

const reranked = await rerankCandidates(query, candidates, {
  topK: 5,
  minScore: 0.3,
});
```

**Integration**: Automatically integrated into `ragQuery` function in `lib/rag/service.ts`.

**Tests**: 15 unit tests covering scoring, reranking, error handling, and batch processing.

---

### ✅ Week 2: Query Transformation & Caching

#### 3. Query Transformation (`lib/rag/query-transform.ts`)

**Purpose**: Enhance retrieval quality through query rewriting and HyDE expansion.

**Features**:
- LLM-powered query rewriting (3 variations)
- HyDE (Hypothetical Document Embeddings) generation
- Simple synonym-based expansion (no LLM)
- Combined transformation pipeline

**Key Functions**:
```typescript
// Generate query variations
export async function rewriteQuery(
  query: string,
  config: Partial<QueryTransformConfig> = {}
): Promise<string[]>

// Generate hypothetical document
export async function hydeExpand(
  query: string,
  config: Partial<QueryTransformConfig> = {}
): Promise<string>

// Combined transformation
export async function transformQuery(
  query: string,
  options: {
    enableRewriting?: boolean;
    enableHyDE?: boolean;
    config?: Partial<QueryTransformConfig>;
  } = {}
): Promise<QueryTransformResult>

// Fast synonym expansion
export function expandQuerySimple(query: string): string[]
```

**Usage**:
```typescript
import { transformQuery } from './lib/rag/query-transform.js';

const result = await transformQuery('wireless headphones', {
  enableRewriting: true,
  enableHyDE: true,
});

console.log(result.rewrittenQueries); // ['wireless headphones', ...]
console.log(result.hydeDocument); // Generated hypothetical doc
```

**Integration**: Integrated into MCP `rag_query` tool with `useQueryTransform` parameter.

---

#### 4. Semantic Cache (`lib/rag/semantic-cache.ts`)

**Purpose**: Reduce latency and API costs by caching similar query results.

**Features**:
- Redis-backed storage
- Embedding-based similarity matching
- Configurable TTL
- Automatic cleanup of expired entries
- Cache statistics

**Key Functions**:
```typescript
// Create cache instance
export function createSemanticCache(
  options: Partial<SemanticCacheConfig> = {}
): SemanticCache

// Cache wrapper
export async function withCache<T>(
  query: string,
  fn: () => Promise<T>,
  cache: SemanticCache
): Promise<T>
```

**Usage**:
```typescript
import { createSemanticCache } from './lib/rag/semantic-cache.js';

const cache = createSemanticCache({
  ttlSeconds: 3600,
  similarityThreshold: 0.95,
});

// Manual caching
const cached = await cache.get(query);
if (!cached) {
  const result = await expensiveOperation(query);
  await cache.set(query, result);
}

// Wrapper approach
const result = await withCache(query, () => expensiveOperation(query), cache);
```

**Integration**: Integrated into MCP `rag_query` tool with `useCache` parameter.

---

### ✅ Week 2: Traceability & Scoring

#### 5. RAG Tracing (`lib/observability/rag-trace.ts`)

**Purpose**: Comprehensive observability for RAG operations using Langfuse.

**Features**:
- Per-span tracing for all RAG operations
- Automatic score logging
- Query transformation tracking
- Cache hit/miss monitoring

**Key Functions**:
```typescript
// Get tracer instance
export function getTracer(): RAGTracer

// Trace complete pipeline
export async function traceRAGPipeline<T>(
  query: string,
  fn: (ctx: RAGTraceContext) => Promise<T>,
  options?: { userId?: string; sessionId?: string }
): Promise<T>

// Create span helpers
export function createRAGSpanHelpers(ctx: RAGTraceContext)
```

**Usage**:
```typescript
import { traceRAGPipeline, getTracer } from './lib/observability/rag-trace.js';

const result = await traceRAGPipeline(query, async (ctx) => {
  const tracer = getTracer();
  const spans = createRAGSpanHelpers(ctx);
  
  // Track query transform
  const transformSpan = spans.queryTransform(query);
  const transformed = await transformQuery(query);
  transformSpan.end({ transformed });
  
  // Track retrieval
  const retrievalSpan = spans.vectorSearch(query);
  const results = await vectorSearch(query);
  retrievalSpan.end({ count: results.length });
  
  return results;
}, { userId: 'user123' });
```

**Environment Variables**:
```bash
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com
```

---

#### 6. LLM Judge Scoring (`lib/observability/llm-judge.ts`)

**Purpose**: Evaluate RAG output quality using LLM-as-Judge methodology.

**Features**:
- Faithfulness scoring (answer vs context)
- Relevance scoring (answer vs query)
- Answer relevance (substantiveness)
- Batch evaluation support
- Average score calculation

**Key Functions**:
```typescript
// Evaluate single output
export async function evaluateRAGOutput(
  input: EvaluationInput,
  options: Partial<LLMJudgeConfig> = {}
): Promise<EvaluationResult>

// Batch evaluation
export async function batchEvaluate(
  inputs: EvaluationInput[],
  options: Partial<LLMJudgeConfig> = {}
): Promise<EvaluationResult[]>

// Calculate averages
export function calculateAverageScores(
  results: EvaluationResult[]
): { avgFaithfulness: number; avgRelevance: number; avgAnswerRelevance: number }
```

**Usage**:
```typescript
import { evaluateRAGOutput } from './lib/observability/llm-judge.js';

const result = await evaluateRAGOutput({
  query: 'What is the return policy?',
  context: 'Returns accepted within 30 days...',
  answer: 'You can return items within 30 days.',
});

console.log(result.faithfulness); // 0.95
console.log(result.relevance); // 0.98
```

---

#### 7. RAGAS Integration (`scripts/llm_eval.py`)

**Purpose**: Industry-standard RAG evaluation metrics.

**Features**:
- Faithfulness metric
- Answer relevancy
- Context precision
- Context recall
- Answer similarity (with ground truth)
- Answer correctness (with ground truth)

**Usage**:
```bash
# Install RAGAS
pip install ragas datasets

# Run evaluation
python scripts/llm_eval.py
```

**Python API**:
```python
from scripts.llm_eval import evaluate_with_ragas

results = evaluate_with_ragas(
    questions=['What is the return policy?'],
    answers=['30-day return window'],
    contexts=[['Returns accepted within 30 days']],
    ground_truths=['Items can be returned within 30 days']
)
```

---

### ✅ Week 3: Production CX & Guards

#### 8. Guardrails (`lib/guardrails/index.ts`)

**Purpose**: Input/output validation for safety and compliance.

**Features**:
- PII detection (email, phone, SSN, credit card, IP, URL)
- Toxicity detection
- Jailbreak attempt prevention
- Hallucination detection
- Input sanitization
- Middleware for chat handlers

**Key Functions**:
```typescript
// Validate input
export function validateInput(
  input: string,
  config: Partial<GuardrailsConfig> = {}
): ValidationResult

// Validate output
export function validateOutput(
  output: string,
  context?: string,
  config: Partial<GuardrailsConfig> = {}
): ValidationResult

// Sanitize input
export function sanitizeInput(input: string): string

// Create middleware
export function createGuardrailsMiddleware(
  config: Partial<GuardrailsConfig> = {}
)
```

**Usage**:
```typescript
import { validateInput, sanitizeInput, createGuardrailsMiddleware } from './lib/guardrails/index.js';

// Direct validation
const result = validateInput('My email is test@example.com');
if (result.action === 'block') {
  throw new Error('Input blocked');
}

// Sanitize before processing
const clean = sanitizeInput('Contact me at test@example.com');

// Middleware
const middleware = createGuardrailsMiddleware();
const { allowed, sanitizedInput } = await middleware.processInput(userInput);
```

**Tests**: 24 unit tests covering all detection types and sanitization.

---

#### 9. User Memory with Mem0 (`lib/memory/user-memory.ts`)

**Purpose**: Persistent user memory for personalized interactions.

**Features**:
- Preference storage
- Conversation history summary
- User facts tracking
- Interaction metadata
- Memory search

**Key Functions**:
```typescript
// Store context
export async function rememberUserContext(
  userId: string,
  context: Partial<UserMemoryContext>
): Promise<boolean>

// Retrieve context
export async function recallUserContext(userId: string): Promise<UserMemoryContext>

// Add fact
export async function addUserFact(userId: string, fact: string): Promise<boolean>

// Set preference
export async function setUserPreference(
  userId: string,
  key: string,
  value: string | number | boolean
): Promise<boolean>
```

**Usage**:
```typescript
import { rememberUserContext, recallUserContext, setUserPreference } from './lib/memory/user-memory.js';

// Store preferences
await setUserPreference('user123', 'currency', 'USD');
await addUserFact('user123', 'Prefers email communication');

// Retrieve
const context = await recallUserContext('user123');
console.log(context.preferences.currency); // 'USD'
```

**Environment Variables**:
```bash
MEM0_API_KEY=your_mem0_api_key
MEM0_BASE_URL=https://api.mem0.ai
```

---

#### 10. Adaptive RAG Node (`lib/agents/adaptive-rag-node.ts`)

**Purpose**: Intelligent routing between RAG and direct LLM responses.

**Features**:
- LLM-based retrieval necessity detection
- Keyword-based fallback
- Intent-aware routing
- Confidence scoring

**Key Functions**:
```typescript
// Decide retrieval necessity
export async function decideRetrievalNecessity(
  query: string,
  conversationHistory: ChatMessage[] = []
): Promise<AdaptiveRAGDecision>

// Create LangGraph node
export function createAdaptiveRAGNode()

// Route with adaptive RAG
export async function routeWithAdaptiveRAG(
  query: string,
  context?: { userId?: string; threadId?: string }
): Promise<{ shouldUseRAG: boolean; queries: string[]; reason: string }>
```

**Usage**:
```typescript
import { routeWithAdaptiveRAG } from './lib/agents/adaptive-rag-node.js';

const decision = await routeWithAdaptiveRAG('Show me laptops', {
  userId: 'user123',
});

if (decision.shouldUseRAG) {
  // Use RAG pipeline
} else {
  // Direct LLM response
}
```

---

#### 11. Proactive CX Agent (`lib/agents/cx-proactive.ts`)

**Purpose**: Automated customer engagement triggers.

**Features**:
- Cart abandonment detection
- Price drop alerts
- Order delay notifications
- Ticket escalation tracking
- Restock alerts
- Personalized offers

**Key Functions**:
```typescript
// Get manager instance
export function getProactiveCXManager(): ProactiveCXManager

// Initialize system
export async function initializeProactiveCX(): Promise<void>

// Track specific events
export async function trackCartAbandonment(...)
export async function trackPriceDrop(...)
export async function trackOrderDelay(...)
```

**Usage**:
```typescript
import { trackCartAbandonment, initializeProactiveCX } from './lib/agents/cx-proactive.js';

// Initialize
await initializeProactiveCX();

// Track event
await trackCartAbandonment(
  'user123',
  'cart456',
  99.99,
  3
);
```

---

## File Structure

```
lib/
├── rag/
│   ├── service.ts              # Main RAG service (updated)
│   ├── semantic-chunker.ts     # NEW: Semantic chunking
│   ├── reranker.ts             # NEW: Cross-encoder reranking
│   ├── query-transform.ts      # NEW: Query transformation
│   └── semantic-cache.ts       # NEW: Semantic caching
├── observability/
│   ├── rag-trace.ts            # NEW: Langfuse tracing
│   └── llm-judge.ts            # NEW: LLM evaluation
├── guardrails/
│   └── index.ts                # NEW: Input/output validation
├── memory/
│   └── user-memory.ts          # NEW: Mem0 integration
├── agents/
│   ├── supervisor.ts           # Existing supervisor
│   ├── adaptive-rag-node.ts    # NEW: Adaptive routing
│   └── cx-proactive.ts         # NEW: Proactive CX
└── mcp/
    └── rag-tools.ts            # Updated MCP tools
```

---

## Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| Semantic Chunker | 22 | ✅ Pass |
| Reranker | 15 | ✅ Pass |
| Guardrails | 24 | ✅ Pass |
| **Total** | **61** | **✅ All Pass** |

---

## Environment Variables

```bash
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:3b
EMBEDDING_MODEL=nomic-embed-text

# Langfuse (Observability)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com

# Mem0 (User Memory)
MEM0_API_KEY=your_mem0_api_key  # Optional
MEM0_BASE_URL=https://api.mem0.ai

# Redis (Caching)
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## API Changes

### Updated `ragQuery` Options

```typescript
// Before
ragQuery(query, {
  productLimit: 5,
  documentLimit: 3,
  minScore: 0.2,
});

// After
ragQuery(query, {
  productLimit: 5,
  documentLimit: 3,
  minScore: 0.2,
  useReranking: true,      // NEW: Enable reranking
  rerankTopK: 5,           // NEW: Top K results after reranking
});
```

### Updated `indexDocument` Options

```typescript
// Before
indexDocument(title, content, docType, {
  chunkSize: 500,
  chunkOverlap: 50,
});

// After
indexDocument(title, content, docType, {
  chunkSize: 500,
  chunkOverlap: 50,
  useSemanticChunking: true,  // NEW: Use semantic chunking
});
```

### New MCP Tool Parameters

```typescript
// rag_query tool now accepts:
{
  query: string,
  useQueryTransform: boolean,  // NEW: Enable query rewriting
  useCache: boolean,           // NEW: Enable semantic caching
}
```

---

## Performance Considerations

### Latency Impact

| Feature | Added Latency | Mitigation |
|---------|--------------|------------|
| Semantic Chunking | +10-50ms per doc | One-time during indexing |
| Reranking | +100-300ms | Parallel scoring, caching |
| Query Transform | +200-500ms | Cache transformed queries |
| Semantic Cache | +5-20ms | Reduces overall latency |
| Guardrails | +1-5ms | Minimal regex-based checks |

### Recommendations

1. **Enable caching** in production for frequently asked queries
2. **Use semantic chunking** for new document indexing
3. **Enable reranking** for high-value queries
4. **Monitor Langfuse** for performance bottlenecks
5. **Adjust thresholds** based on your use case

---

## Migration Guide

### From Legacy Chunking

```typescript
// Old code
import { chunkText } from './lib/rag/service.js';
const chunks = chunkText(content, 500, 50);

// New code (backward compatible)
import { semanticChunk } from './lib/rag/semantic-chunker.js';
const chunks = await semanticChunk(content, {
  maxChunkSize: 500,
  chunkOverlap: 50,
});

// Or use legacy wrapper
import { chunkTextSemantic } from './lib/rag/semantic-chunker.js';
const chunks = await chunkTextSemantic(content, 500, 50);
```

### Enabling Features

```typescript
// In your chat handler
import { validateInput, validateOutput } from './lib/guardrails/index.js';

// Before processing
const inputValidation = validateInput(userQuery);
if (inputValidation.action === 'block') {
  return 'I cannot process that request.';
}

// After generation
const outputValidation = validateOutput(aiResponse, context);
if (outputValidation.action === 'block') {
  return 'Let me rephrase that...';
}
```

---

## Troubleshooting

### Common Issues

**1. Reranking returns 0 results**
- Check Ollama is running: `docker ps | grep ollama`
- Verify model availability: `ollama list`
- Lower `minScore` threshold

**2. Cache not working**
- Verify Redis connection: `redis-cli ping`
- Check Redis logs for errors
- Ensure `enableCache` is true

**3. Guardrails too aggressive**
- Adjust thresholds in config
- Disable specific detections: `enablePIIDetection: false`
- Review regex patterns for false positives

**4. Langfuse not logging**
- Verify API keys are set
- Check network connectivity to Langfuse
- Review Langfuse dashboard for errors

---

## Next Steps

1. **Run Tests**: `pnpm vitest run tests/unit/`
2. **Lint Check**: `pnpm lint`
3. **Deploy**: Follow your deployment process
4. **Monitor**: Watch Langfuse dashboard for metrics
5. **Iterate**: Adjust thresholds based on production data

---

## Support

For issues or questions:
1. Check this documentation
2. Review test files for usage examples
3. Consult Langfuse dashboard for observability
4. Check Ollama logs for embedding/reranking issues

---

*Documentation generated: 2026-02-18*
*Version: 1.0.0*
