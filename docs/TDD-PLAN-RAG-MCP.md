# TDD Development Plan: RAG + MCP with pgvector

## Overview
Implement a production-ready RAG (Retrieval-Augmented Generation) pipeline using PostgreSQL with pgvector for the e-commerce support chatbot. All implementation will follow Test-Driven Development (TDD) principles.

## Infrastructure Available
- **Database**: PostgreSQL + pgvector (port 5432)
- **Embedding Model**: nomic-embed-text:v1.5 (Ollama)
- **LLM**: qwen2.5-coder:3b (Ollama)
- **Container**: postgres-pgvector (running)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    E-commerce Support Chatbot                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Frontend  │    │  A2UI Exp   │    │  Chrome DevTools    │ │
│  │  (page.tsx) │    │  (future)   │    │  MCP Testing        │ │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘ │
│         │                  │                       │            │
│         └──────────────────┼───────────────────────┘            │
│                            ▼                                    │
│              ┌─────────────────────────────┐                    │
│              │      POST /api/chat         │                    │
│              │   (route.ts - Main Router)  │                    │
│              └─────────────┬───────────────┘                    │
│                            │                                    │
│         ┌──────────────────┼──────────────────┐                 │
│         │                  │                  │                 │
│    ┌────▼────┐       ┌────▼────┐       ┌────▼────┐            │
│    │  RAG    │       │   DB    │       │  Other  │            │
│    │  MCP    │       │   MCP   │       │  Tools  │            │
│    └────┬────┘       └────┬────┘       └────┬────┘            │
│         │                  │                  │                 │
│    ┌────▼──────────────────▼──────────────────▼────┐           │
│    │           MCP Tool Layer                       │           │
│    │  - rag_query     - hybrid_search              │           │
│    │  - vector_search - db_query                   │           │
│    └─────────────────┬─────────────────────────────┘           │
│                      │                                         │
│         ┌────────────┼────────────┐                           │
│         ▼            ▼            ▼                           │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐                  │
│  │ pgvector │ │  PostgreSQL  │ │  Redis   │                  │
│  │ (RAG)    │ │  (Orders,    │ │ (Future) │                  │
│  │          │ │   Products)  │ │          │                  │
│  └──────────┘ └──────────────┘ └──────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: Prisma Schema Extensions (Test First)

### Test File: `tests/unit/schema.test.ts`

```typescript
describe('RAG Schema Models', () => {
  it('should define ProductEmbedding with 768-dim vectors', () => {
    // nomic-embed-text produces 768-dimensional vectors
    const embedding = new ProductEmbedding({
      id: uuid(),
      productId: 1,
      embedding: new Vector([...Array(768).keys()]), // 768 dims
      embeddingModel: 'nomic-embed-text',
    });
    expect(embedding.embedding.dims).toBe(768);
  });

  it('should define DocumentChunk for knowledge base', () => {
    const chunk = new DocumentChunk({
      id: uuid(),
      documentId: 'doc-1',
      content: 'Product return policy: 30 days...',
      chunkIndex: 0,
      metadata: { source: 'returns-policy.pdf' },
    });
    expect(chunk.content).toContain('return policy');
  });
});
```

### Schema Additions

```prisma
// ============================================================================
// RAG / Knowledge Base Models
// ============================================================================

/// Product knowledge embeddings for semantic search
/// Uses 768-dimensional vectors from nomic-embed-text
model ProductEmbedding {
  id              String   @id @default(uuid())
  productId       Int      @map("product_id")
  embedding       Unsupported("vector(768)") @map("embedding")
  embeddingModel  String   @default("nomic-embed-text") @map("embedding_model")
  createdAt       DateTime @default(now()) @map("created_at")

  // Relations
  product         Product  @relation(fields: [productId], references: [id])

  @@index([productId])
  @@map("product_embeddings")
}

/// Knowledge base document for RAG
model Document {
  id          String         @id @default(uuid())
  title       String
  content     String         // Full document content
  docType     String         @map("doc_type") // policy, faq, product_info, etc.
  category    String?
  metadata    Json?          @default("{}")
  isActive    Boolean        @default(true) @map("is_active")
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  // Relations
  chunks      DocumentChunk[]

  @@map("documents")
  @@index([docType])
  @@index([category])
}

/// Document chunks for granular retrieval
model DocumentChunk {
  id          String   @id @default(uuid())
  documentId  String   @map("document_id")
  content     String   // Chunked content
  chunkIndex  Int      @map("chunk_index") // Position in original doc
  embedding   Unsupported("vector(768)")?  // Optional: compute on-demand
  tokenCount  Int?     @map("token_count")
  metadata    Json?    @default("{}")
  createdAt   DateTime @default(now()) @map("created_at")

  // Relations
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, chunkIndex])
  @@index([documentId])
  @@map("document_chunks")
}
```

## Phase 2: RAG Service (TDD)

### Test File: `tests/unit/rag.service.test.ts`

```typescript
describe('RAG Service', () => {
  let ragService: RAGService;

  beforeEach(() => {
    ragService = new RAGService({
      embeddingModel: 'nomic-embed-text',
      similarityThreshold: 0.7,
      maxResults: 5,
    });
  });

  describe('embedQuery', () => {
    it('should generate 768-dimensional embedding', async () => {
      const embedding = await ragService.embedQuery('wireless headphones');

      expect(embedding).toBeDefined();
      expect(embedding.length).toBe(768);
      expect(typeof embedding[0]).toBe('number');
    });

    it('should handle empty query gracefully', async () => {
      const embedding = await ragService.embedQuery('');
      expect(embedding.length).toBe(768);
      // Empty queries should return near-zero vector
      const magnitude = embedding.reduce((a, b) => a + b * b, 0) ** 0.5;
      expect(magnitude).toBeLessThan(1);
    });
  });

  describe('vectorSearch', () => {
    it('should find similar products by semantic similarity', async () => {
      await ragService.indexProduct(1, 'Premium wireless headphones with noise cancellation');
      await ragService.indexProduct(2, 'Budget wired earbuds');

      const results = await ragService.vectorSearch('noise canceling audio', { topK: 1 });

      expect(results.length).toBe(1);
      expect(results[0].productId).toBe(1);
      expect(results[0].similarity).toBeGreaterThan(0.7);
    });
  });

  describe('ragQuery', () => {
    it('should retrieve relevant context and format for LLM', async () => {
      // Setup: index some product info
      await ragService.indexDocument({
        title: 'Return Policy',
        content: 'You can return products within 30 days of purchase.',
        docType: 'policy',
      });

      const context = await ragService.ragQuery('What is the return window?');

      expect(context).toBeDefined();
      expect(context.source).toBe('knowledge_base');
      expect(context.content).toContain('30 days');
    });
  });
});
```

### Implementation: `lib/rag/service.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { env } from '../env.js';

interface RAGConfig {
  embeddingModel: string;
  similarityThreshold: number;
  maxResults: number;
}

interface SearchResult {
  productId?: number;
  documentId?: string;
  content: string;
  similarity: number;
  source: 'product' | 'document';
  metadata?: Record<string, unknown>;
}

export class RAGService {
  private prisma: PrismaClient;
  private config: RAGConfig;

  constructor(config?: Partial<RAGConfig>) {
    this.prisma = new PrismaClient({
      log: env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    });
    this.config = {
      embeddingModel: 'nomic-embed-text',
      similarityThreshold: 0.7,
      maxResults: 5,
      ...config,
    };
  }

  /**
   * Generate embedding for query using Ollama nomic-embed-text
   */
  async embedQuery(text: string): Promise<number[]> {
    if (!text.trim()) {
      return Array(768).fill(0);
    }

    const response = await fetch(`${env.OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.embeddingModel,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  }

  /**
   * Index a product for semantic search
   */
  async indexProduct(productId: number, description: string): Promise<void> {
    const embedding = await this.embedQuery(description);

    await this.prisma.productEmbedding.upsert({
      where: { productId },
      update: { embedding },
      create: {
        productId,
        embedding,
        embeddingModel: this.config.embeddingModel,
      },
    });
  }

  /**
   * Vector similarity search using pgvector
   */
  async vectorSearch(
    query: string,
    options: { topK?: number; category?: string } = {}
  ): Promise<SearchResult[]> {
    const embedding = await this.embedQuery(query);
    const topK = options.topK ?? this.config.maxResults;

    // pgvector cosine similarity search
    const results = await this.prisma.$queryRaw`
      SELECT
        pe.product_id as "productId",
        pe.embedding <=> ${embedding}::vector as similarity,
        p.name,
        p.description,
        p.category,
        p.price
      FROM product_embeddings pe
      JOIN "Product" p ON pe.product_id = p.id
      WHERE ${options.category} IS NULL OR p.category = ${options.category}
      ORDER BY similarity ASC
      LIMIT ${topK}
    `;

    return (results as Array<{
      productId: number;
      similarity: number;
      name: string;
      description: string | null;
      category: string | null;
      price: number;
    }>).map((r) => ({
      productId: r.productId,
      content: `${r.name}: ${r.description || ''}`,
      similarity: 1 - r.similarity, // Convert distance to similarity
      source: 'product' as const,
      metadata: { category: r.category, price: r.price },
    }));
  }

  /**
   * Full RAG query: retrieve context for LLM
   */
  async ragQuery(
    query: string,
    options: { sources?: ('product' | 'document')[]; maxTokens?: number } = {}
  ): Promise<{
    content: string;
    sources: Array<{ type: string; id: string; score: number }>;
  }> {
    const sources = options.sources ?? ['product', 'document'];
    const contextParts: string[] = [];
    const sourceRefs: Array<{ type: string; id: string; score: number }> = [];

    if (sources.includes('product')) {
      const productResults = await this.vectorSearch(query, { topK: 3 });
      for (const result of productResults) {
        if (result.similarity >= this.config.similarityThreshold) {
          contextParts.push(`[PRODUCT] ${result.content}`);
          sourceRefs.push({ type: 'product', id: String(result.productId), score: result.similarity });
        }
      }
    }

    if (sources.includes('document')) {
      // Document search implementation...
    }

    return {
      content: contextParts.join('\n\n'),
      sources: sourceRefs,
    };
  }
}
```

## Phase 3: MCP Tools (TDD)

### Test File: `tests/unit/mcp-tools.test.ts`

```typescript
describe('MCP RAG Tools', () => {
  let tools: Map<string, Tool>;
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    tools = createSecureTools({ db: mockDb, rateLimiter });
  });

  describe('vector_search', () => {
    it('should return products matching semantic query', async () => {
      const tool = tools.get('vector_search')!;

      const result = await tool.execute({
        query: 'high quality audio equipment',
        topK: 5,
        category: 'Electronics',
      }, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('products');
      expect(result.data.products.length).toBeLessThanOrEqual(5);
    });

    it('should require user context', async () => {
      const tool = tools.get('vector_search')!;

      await expect(tool.execute({ query: 'test' }, null)).rejects.toThrow('Authorization required');
    });
  });

  describe('hybrid_search', () => {
    it('should combine vector and keyword search', async () => {
      const tool = tools.get('hybrid_search')!;

      const result = await tool.execute({
        query: 'wireless bluetooth headphones noise cancelling',
        mode: 'hybrid',
        weights: { vector: 0.7, keyword: 0.3 },
      }, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('hybridResults');
      expect(result.data).toHaveProperty('reranked', true);
    });
  });
});
```

## Phase 4: Integration Tests

### Test File: `tests/integration/rag-chat.test.ts`

```typescript
describe('RAG Chat Integration', () => {
  it('should answer product questions using RAG', async () => {
    // Setup: seed product embeddings
    await seedProductEmbeddings();

    // Execute: send chat message
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ content: 'What wireless headphones do you recommend?' }],
      }),
    });

    expect(response.status).toBe(200);

    // Verify SSE response contains relevant product info
    const chunks = await collectSSEChunks(response);
    const fullResponse = chunks.map(c => c.choices?.[0]?.delta?.content).join('');

    expect(fullResponse.toLowerCase()).toContain('wireless');
    expect(fullResponse.toLowerCase()).toMatch(/headphone|earbud|speaker/);
  });
});
```

## Implementation Order

| Phase | Files | Tests | Description |
|-------|-------|-------|-------------|
| 1 | `prisma/schema.prisma` | `tests/unit/schema.test.ts` | Add ProductEmbedding, Document, DocumentChunk |
| 2 | `lib/rag/service.ts` | `tests/unit/rag.service.test.ts` | RAG service with vector search |
| 3 | `lib/mcp/rag-tools.ts` | `tests/unit/mcp-rag-tools.test.ts` | MCP tool definitions |
| 4 | `app/api/chat/route.ts` | - | Integrate RAG into chat API |
| 5 | `tests/integration/` | `tests/integration/rag-chat.test.ts` | E2E tests |

## Running Tests

```bash
# Run unit tests
pnpm test:unit

# Run integration tests (requires pgvector + Ollama)
pnpm test:integration

# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage
```

## Success Criteria

- [ ] All unit tests pass
- [ ] Integration tests pass with real pgvector
- [ ] Vector search returns results within 500ms
- [ ] Embedding generation completes within 2s
- [ ] Chat API returns context-aware responses with RAG
