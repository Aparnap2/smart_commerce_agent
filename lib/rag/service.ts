/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * Production-ready RAG service for semantic search and knowledge retrieval.
 * Uses PostgreSQL with pgvector for storing and querying embeddings.
 * Uses nomic-embed-text model from Ollama for generating embeddings (768 dimensions).
 *
 * Features:
 * - Vector similarity search with pgvector
 * - Product and document indexing for semantic search
 * - Full RAG query pipeline for LLM context augmentation
 * - Connection pooling and health checks
 */

import { queryDatabase } from '../tools/database.js';
import { logger } from '../redis/logger.ts';
import { env } from '../env.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Embedding configuration
 */
export interface EmbeddingConfig {
  provider: 'local';
  model: string;
  dimensions: number;
  endpoint: string;
}

/**
 * Result of embedding generation
 */
export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  tokenCount?: number;
  error?: string;
}

/**
 * Search options for vector similarity search
 */
export interface VectorSearchOptions {
  limit?: number;
  minScore?: number;
  filter?: Record<string, unknown>;
}

/**
 * Product search result
 */
export interface ProductSearchResult {
  id: number;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  sku: string | null;
  rating: number | null;
  similarity: number;
}

/**
 * Document search result
 */
export interface DocumentSearchResult {
  id: string;
  title: string;
  content: string;
  docType: string;
  category: string | null;
  chunkIndex: number;
  tokenCount: number | null;
  similarity: number;
  metadata: Record<string, unknown>;
}

/**
 * RAG query result
 */
export interface RAGQueryResult {
  query: string;
  context: string;
  sources: Array<{
    type: 'product' | 'document';
    id: string | number;
    title: string;
    relevance: number;
    content?: string;
  }>;
  totalResults: number;
  error?: string;
}

/**
 * Health check result
 */
export interface RAGHealthStatus {
  healthy: boolean;
  ollama: boolean;
  database: boolean;
  dimensions: number;
  model: string;
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get embedding configuration from environment
 */
export function getEmbeddingConfig(): EmbeddingConfig {
  return {
    provider: 'local',
    model: env.EMBEDDING_MODEL || 'nomic-embed-text',
    dimensions: parseInt(env.EMBEDDING_DIMENSIONS?.toString() || '768', 10),
    endpoint: env.OLLAMA_BASE_URL
      ? `${env.OLLAMA_BASE_URL}/api/embeddings`
      : 'http://localhost:11434/api/embeddings',
  };
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding for text using Ollama nomic-embed-text model
 *
 * @param text - Text to generate embedding for
 * @returns EmbeddingResult with embedding vector or error
 */
export async function embedQuery(text: string): Promise<EmbeddingResult> {
  const config = getEmbeddingConfig();

  if (!text || text.trim().length === 0) {
    return {
      embedding: [],
      model: config.model,
      dimensions: config.dimensions,
      error: 'Text input cannot be empty',
    };
  }

  logger.info('RAG', 'Generating embedding', {
    model: config.model,
    dimensions: config.dimensions,
    textLength: text.length,
  });

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: text.trim(),
        options: {
          num_predict: config.dimensions,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Handle different response formats from Ollama
    let embedding: number[];
    if (Array.isArray(data.embedding)) {
      embedding = data.embedding;
    } else if (Array.isArray(data.embeddings) && data.embeddings.length > 0) {
      embedding = data.embeddings[0];
    } else {
      throw new Error('Invalid embedding response format');
    }

    // Validate embedding dimensions
    if (embedding.length !== config.dimensions) {
      logger.warn('RAG', 'Embedding dimension mismatch', {
        expected: config.dimensions,
        actual: embedding.length,
      });
    }

    logger.info('RAG', 'Embedding generated successfully', {
      dimensions: embedding.length,
      model: config.model,
    });

    return {
      embedding,
      model: config.model,
      dimensions: embedding.length,
      tokenCount: data.token_count || data.eval_count || undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RAG', 'Embedding generation failed', error);

    return {
      embedding: [],
      model: config.model,
      dimensions: config.dimensions,
      error: errorMessage,
    };
  }
}

/**
 * Generate embedding with validation
 *
 * @param text - Text to generate embedding for
 * @param expectedDimensions - Expected dimensions (default: 768 for nomic-embed-text)
 * @returns Validated EmbeddingResult
 */
export async function generateValidatedEmbedding(
  text: string,
  expectedDimensions: number = 768
): Promise<EmbeddingResult> {
  const result = await embedQuery(text);

  if (result.error) {
    return result;
  }

  if (result.embedding.length !== expectedDimensions) {
    return {
      ...result,
      error: `Dimension mismatch: expected ${expectedDimensions}, got ${result.embedding.length}`,
    };
  }

  // Validate all values are finite numbers
  if (!result.embedding.every((v) => typeof v === 'number' && isFinite(v))) {
    return {
      ...result,
      error: 'Embedding contains non-finite values',
    };
  }

  return result;
}

// ============================================================================
// Product Indexing
// ============================================================================

/**
 * Index a product for semantic search by generating and storing its embedding
 *
 * @param productId - Product ID to index
 * @param description - Product description to embed
 * @returns Success status with embedded record ID
 */
export async function indexProduct(
  productId: number,
  description: string
): Promise<{ success: boolean; embeddingId?: string; error?: string }> {
  const config = getEmbeddingConfig();

  if (!description || description.trim().length === 0) {
    return { success: false, error: 'Product description cannot be empty' };
  }

  logger.info('RAG', 'Indexing product', {
    productId,
    descriptionLength: description.length,
  });

  try {
    // Generate embedding for product description
    const embeddingResult = await embedQuery(description);

    if (embeddingResult.error || embeddingResult.embedding.length === 0) {
      throw new Error(`Failed to generate embedding: ${embeddingResult.error}`);
    }

    // Store embedding in database
    const vectorString = JSON.stringify(embeddingResult.embedding);
    const result = await queryDatabase(
      `INSERT INTO product_embeddings (id, product_id, embedding, embedding_model, created_at)
       VALUES (gen_random_uuid(), $1, $2::vector, $3, NOW())
       ON CONFLICT (product_id) DO UPDATE
       SET embedding = EXCLUDED.embedding, embedding_model = EXCLUDED.embedding_model
       RETURNING id`,
      [productId, vectorString, config.model]
    );

    const embeddingId = result[0]?.id;

    logger.info('RAG', 'Product indexed successfully', {
      productId,
      embeddingId,
      dimensions: embeddingResult.dimensions,
    });

    return { success: true, embeddingId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RAG', 'Product indexing failed', error);

    return { success: false, error: errorMessage };
  }
}

/**
 * Batch index multiple products
 *
 * @param products - Array of { productId, description } objects
 * @returns Array of results with success status
 */
export async function indexProductsBatch(
  products: Array<{ productId: number; description: string }>
): Promise<Array<{ productId: number; success: boolean; error?: string }>> {
  const results = await Promise.all(
    products.map(async ({ productId, description }) => {
      const result = await indexProduct(productId, description);
      return { productId, ...result };
    })
  );

  const successCount = results.filter((r) => r.success).length;
  logger.info('RAG', 'Batch indexing complete', {
    total: products.length,
    successful: successCount,
    failed: products.length - successCount,
  });

  return results;
}

/**
 * Remove product embedding from index
 *
 * @param productId - Product ID to remove
 * @returns Success status
 */
export async function removeProductEmbedding(
  productId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await queryDatabase(
      `DELETE FROM product_embeddings WHERE product_id = $1`,
      [productId]
    );

    logger.info('RAG', 'Product embedding removed', { productId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RAG', 'Failed to remove product embedding', error);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Document Indexing
// ============================================================================

/**
 * Index a knowledge base document by chunking and embedding
 *
 * @param title - Document title
 * @param content - Document content to index
 * @param docType - Document type (e.g., 'faq', 'policy', 'guide')
 * @param options - Optional metadata and chunking options
 * @returns Success status with document ID
 */
export async function indexDocument(
  title: string,
  content: string,
  docType: string,
  options: {
    category?: string;
    metadata?: Record<string, unknown>;
    chunkSize?: number;
    chunkOverlap?: number;
  } = {}
): Promise<{ success: boolean; documentId?: string; chunkCount?: number; error?: string }> {
  const config = getEmbeddingConfig();
  const {
    category,
    metadata = {},
    chunkSize = 500,
    chunkOverlap = 50,
  } = options;

  if (!title || !content) {
    return { success: false, error: 'Title and content are required' };
  }

  logger.info('RAG', 'Indexing document', {
    title: title.substring(0, 100),
    contentLength: content.length,
    docType,
    chunkSize,
  });

  try {
    // Create document record first
    const docResult = await queryDatabase(
      `INSERT INTO "Document" (id, title, content, "doc_type", category, metadata, "is_active", "created_at", "updated_at")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
       RETURNING id`,
      [title, content, docType, category, JSON.stringify(metadata)]
    );

    const documentId = docResult[0]?.id;

    // Chunk the content
    const chunks = chunkText(content, chunkSize, chunkOverlap);

    // Generate embeddings and store chunks
    const chunkInserts = await Promise.all(
      chunks.map(async (chunk, index) => {
        const embeddingResult = await embedQuery(chunk);

        if (embeddingResult.error || embeddingResult.embedding.length === 0) {
          logger.warn('RAG', 'Failed to embed chunk', {
            documentId,
            chunkIndex: index,
          });
          return null;
        }

        const vectorString = JSON.stringify(embeddingResult.embedding);
        return queryDatabase(
          `INSERT INTO "DocumentChunk" (id, "document_id", content, "chunk_index", embedding, "token_count", metadata, "created_at")
           VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5, $6, NOW())`,
          [
            documentId,
            chunk,
            index,
            vectorString,
            embeddingResult.tokenCount || null,
            JSON.stringify({ sourceChunkIndex: index }),
          ]
        );
      })
    );

    const successfulChunks = chunkInserts.filter((r) => r !== null).length;

    logger.info('RAG', 'Document indexed successfully', {
      documentId,
      chunkCount: successfulChunks,
      totalChunks: chunks.length,
    });

    return {
      success: successfulChunks === chunks.length,
      documentId,
      chunkCount: successfulChunks,
      error: successfulChunks < chunks.length
        ? `${chunks.length - successfulChunks} chunks failed to embed`
        : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RAG', 'Document indexing failed', error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Split text into overlapping chunks for better retrieval
 */
function chunkText(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + chunkSize;
    let chunk = text.substring(start, end);

    // Try to break at a sentence boundary
    const lastPeriod = chunk.lastIndexOf('.');
    const lastNewline = chunk.lastIndexOf('\n');

    if (lastPeriod > chunkSize * 0.5) {
      chunk = chunk.substring(0, lastPeriod + 1);
    } else if (lastNewline > chunkSize * 0.5) {
      chunk = chunk.substring(0, lastNewline + 1);
    }

    chunks.push(chunk.trim());
    start += chunk.length - chunkOverlap;

    // Ensure progress
    if (start >= text.length) break;
    if (chunks.length > 100) {
      // Safety limit
      logger.warn('RAG', 'Chunk limit reached, truncating');
      break;
    }
  }

  return chunks;
}

/**
 * Update an existing document
 *
 * @param documentId - Document ID to update
 * @param title - New title
 * @param content - New content
 * @param docType - Document type
 * @returns Success status
 */
export async function updateDocument(
  documentId: string,
  title: string,
  content: string,
  docType: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete existing chunks
    await queryDatabase(
      `DELETE FROM "DocumentChunk" WHERE document_id = $1`,
      [documentId]
    );

    // Re-index with new content
    const result = await indexDocument(title, content, docType);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Update document timestamp
    await queryDatabase(
      `UPDATE "Document" SET "updated_at" = NOW() WHERE id = $1`,
      [documentId]
    );

    logger.info('RAG', 'Document updated', { documentId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RAG', 'Document update failed', error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Soft delete a document
 *
 * @param documentId - Document ID to deactivate
 * @returns Success status
 */
export async function deleteDocument(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await queryDatabase(
      `UPDATE "Document" SET "is_active" = false, "updated_at" = NOW() WHERE id = $1`,
      [documentId]
    );

    logger.info('RAG', 'Document deactivated', { documentId });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RAG', 'Document deletion failed', error);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Vector Search
// ============================================================================

/**
 * Search products using vector similarity
 *
 * @param query - Search query
 * @param options - Search options (limit, minScore, filter)
 * @returns Array of matching products with similarity scores
 */
export async function vectorSearch(
  query: string,
  options: VectorSearchOptions = {}
): Promise<{
  results: ProductSearchResult[];
  total: number;
  error?: string;
}> {
  const { limit = 20, minScore = 0.1, filter } = options;

  logger.info('RAG', 'Vector search', {
    query: query.substring(0, 100),
    limit,
    minScore,
  });

  try {
    // Generate query embedding
    const embeddingResult = await embedQuery(query);

    if (embeddingResult.error || embeddingResult.embedding.length === 0) {
      throw new Error(`Failed to generate embedding: ${embeddingResult.error}`);
    }

    const vectorString = JSON.stringify(embeddingResult.embedding);

    // Build filter conditions if provided
    let filterClause = '';
    const filterParams: unknown[] = [vectorString, limit];

    if (filter) {
      const conditions: string[] = [];
      let paramIndex = 3;

      if (filter.category) {
        conditions.push(`p.category = $${paramIndex}`);
        filterParams.push(filter.category);
        paramIndex++;
      }

      if (filter.minPrice !== undefined) {
        conditions.push(`p.price >= $${paramIndex}`);
        filterParams.push(filter.minPrice);
        paramIndex++;
      }

      if (filter.maxPrice !== undefined) {
        conditions.push(`p.price <= $${paramIndex}`);
        filterParams.push(filter.maxPrice);
        paramIndex++;
      }

      if (conditions.length > 0) {
        filterClause = ` AND ${conditions.join(' AND ')}`;
      }
    }

    // Execute vector similarity search using cosine similarity (<=>)
    const result = await queryDatabase(
      `SELECT
         p.id, p.name, p.description, p.price, p.stock,
         p.category, p.sku, p.rating,
         1 - (pe.embedding <=> $1::vector) as similarity
       FROM "Product" p
       LEFT JOIN product_embeddings pe ON p.id = pe.product_id
       WHERE pe.embedding IS NOT NULL${filterClause}
       ORDER BY similarity DESC
       LIMIT $2`,
      filterParams
    );

    // Filter by minimum score
    const filteredResults = result.filter(
      (row: { similarity: number }) => (row.similarity || 0) >= minScore
    );

    logger.info('RAG', 'Vector search complete', {
      query: query.substring(0, 50),
      resultCount: filteredResults.length,
    });

    return {
      results: filteredResults as ProductSearchResult[],
      total: filteredResults.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RAG', 'Vector search failed', error);
    return { results: [], total: 0, error: errorMessage };
  }
}

/**
 * Search knowledge base documents using vector similarity
 *
 * @param query - Search query
 * @param options - Search options (limit, minScore)
 * @returns Array of matching document chunks with similarity scores
 */
export async function documentSearch(
  query: string,
  options: VectorSearchOptions = {}
): Promise<{
  results: DocumentSearchResult[];
  total: number;
  error?: string;
}> {
  const { limit = 10, minScore = 0.1, filter } = options;

  logger.info('RAG', 'Document search', {
    query: query.substring(0, 100),
    limit,
    minScore,
  });

  try {
    // Generate query embedding
    const embeddingResult = await embedQuery(query);

    if (embeddingResult.error || embeddingResult.embedding.length === 0) {
      throw new Error(`Failed to generate embedding: ${embeddingResult.error}`);
    }

    const vectorString = JSON.stringify(embeddingResult.embedding);

    // Build filter conditions
    let filterClause = '';
    const filterParams: unknown[] = [vectorString, limit];

    if (filter) {
      const conditions: string[] = [];
      let paramIndex = 3;

      if (filter.docType) {
        conditions.push(`d."docType" = $${paramIndex}`);
        filterParams.push(filter.docType);
        paramIndex++;
      }

      if (filter.category) {
        conditions.push(`d.category = $${paramIndex}`);
        filterParams.push(filter.category);
        paramIndex++;
      }

      if (filter.isActive !== undefined) {
        conditions.push(`d."isActive" = $${paramIndex}`);
        filterParams.push(filter.isActive);
        paramIndex++;
      }

      if (conditions.length > 0) {
        filterClause = ` AND ${conditions.join(' AND ')}`;
      }
    }

    // Execute vector similarity search
    const result = await queryDatabase(
      `SELECT
         d.id, d.title, d."docType", d.category, d.metadata as doc_metadata,
         dc.id as chunk_id, dc.content, dc."chunk_index", dc."token_count", dc.metadata as chunk_metadata,
         1 - (dc.embedding <=> $1::vector) as similarity
       FROM "Document" d
       JOIN "DocumentChunk" dc ON d.id = dc."document_id"
       WHERE dc.embedding IS NOT NULL${filterClause}
       ORDER BY similarity DESC
       LIMIT $2`,
      filterParams
    );

    // Filter by minimum score and format results
    const filteredResults = result
      .filter((row: { similarity: number }) => (row.similarity || 0) >= minScore)
      .map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        docType: row.docType,
        category: row.category,
        chunkIndex: row.chunk_index,
        tokenCount: row.token_count,
        similarity: row.similarity,
        metadata: {
          ...(row.doc_metadata || {}),
          ...(row.chunk_metadata || {}),
        },
      }));

    logger.info('RAG', 'Document search complete', {
      query: query.substring(0, 50),
      resultCount: filteredResults.length,
    });

    return {
      results: filteredResults as DocumentSearchResult[],
      total: filteredResults.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RAG', 'Document search failed', error);
    return { results: [], total: 0, error: errorMessage };
  }
}

// ============================================================================
// RAG Query Pipeline
// ============================================================================

/**
 * Execute full RAG query - retrieve context from both products and documents
 *
 * @param query - User query
 * @param options - Search options
 * @returns RAGQueryResult with context and sources for LLM
 */
export async function ragQuery(
  query: string,
  options: {
    productLimit?: number;
    documentLimit?: number;
    minScore?: number;
    includeProducts?: boolean;
    includeDocuments?: boolean;
  } = {}
): Promise<RAGQueryResult> {
  const {
    productLimit = 5,
    documentLimit = 3,
    minScore = 0.2,
    includeProducts = true,
    includeDocuments = true,
  } = options;

  logger.info('RAG', 'RAG query', {
    query: query.substring(0, 100),
    productLimit,
    documentLimit,
  });

  try {
    const sources: RAGQueryResult['sources'] = [];
    const contextParts: string[] = [];

    // Search products if enabled
    if (includeProducts) {
      const productResult = await vectorSearch(query, {
        limit: productLimit,
        minScore,
      });

      if (productResult.results.length > 0) {
        for (const product of productResult.results) {
          sources.push({
            type: 'product',
            id: product.id,
            title: product.name,
            relevance: product.similarity,
            content: product.description || undefined,
          });

          contextParts.push(
            `[Product] ${product.name}\n` +
            `Description: ${product.description || 'N/A'}\n` +
            `Price: $${product.price.toFixed(2)}\n` +
            `Category: ${product.category || 'General'}\n` +
            `Relevance: ${(product.similarity * 100).toFixed(1)}%`
          );
        }
      }
    }

    // Search documents if enabled
    if (includeDocuments) {
      const documentResult = await documentSearch(query, {
        limit: documentLimit,
        minScore,
      });

      if (documentResult.results.length > 0) {
        for (const doc of documentResult.results) {
          sources.push({
            type: 'document',
            id: doc.id,
            title: doc.title,
            relevance: doc.similarity,
            content: doc.content,
          });

          contextParts.push(
            `[Document: ${doc.title}] (${doc.docType})\n` +
            `${doc.content}\n` +
            `Relevance: ${(doc.similarity * 100).toFixed(1)}%`
          );
        }
      }
    }

    // Build context string
    const context = contextParts.length > 0
      ? contextParts.join('\n\n---\n\n')
      : 'No relevant context found for your query.';

    logger.info('RAG', 'RAG query complete', {
      query: query.substring(0, 50),
      sourceCount: sources.length,
    });

    return {
      query,
      context,
      sources,
      totalResults: sources.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('RAG', 'RAG query failed', error);

    return {
      query,
      context: '',
      sources: [],
      totalResults: 0,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Health Checks
// ============================================================================

/**
 * Check health of RAG service dependencies
 */
export async function checkRAGHealth(): Promise<RAGHealthStatus> {
  const config = getEmbeddingConfig();

  const status: RAGHealthStatus = {
    healthy: false,
    ollama: false,
    database: false,
    dimensions: config.dimensions,
    model: config.model,
  };

  // Check Ollama connection
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: 'health check',
        options: { num_predict: 1 },
      }),
    });

    if (response.ok) {
      status.ollama = true;
    } else {
      status.error = `Ollama returned status ${response.status}`;
    }
  } catch (error) {
    status.error = `Ollama connection failed: ${error instanceof Error ? error.message : 'Unknown'}`;
  }

  // Check database connection
  try {
    await queryDatabase('SELECT 1', []);
    status.database = true;
  } catch (error) {
    status.error = `Database connection failed: ${error instanceof Error ? error.message : 'Unknown'}`;
  }

  status.healthy = status.ollama && status.database;

  if (!status.healthy && !status.error) {
    status.error = 'One or more dependencies are unhealthy';
  }

  logger.info('RAG', 'Health check', {
    healthy: status.healthy,
    ollama: status.ollama,
    database: status.database,
  });

  return status;
}

/**
 * Get service statistics
 */
export async function getRAGStats(): Promise<{
  productCount: number;
  documentCount: number;
  chunkCount: number;
  embeddingModel: string;
  dimensions: number;
}> {
  try {
    const [productResult, documentResult, chunkResult] = await Promise.all([
      queryDatabase('SELECT COUNT(*) as count FROM product_embeddings', []),
      queryDatabase('SELECT COUNT(*) as count FROM documents WHERE is_active = true', []),
      queryDatabase('SELECT COUNT(*) as count FROM document_chunks', []),
    ]);

    const config = getEmbeddingConfig();

    return {
      productCount: parseInt(productResult[0]?.count?.toString() || '0', 10),
      documentCount: parseInt(documentResult[0]?.count?.toString() || '0', 10),
      chunkCount: parseInt(chunkResult[0]?.count?.toString() || '0', 10),
      embeddingModel: config.model,
      dimensions: config.dimensions,
    };
  } catch (error) {
    logger.error('RAG', 'Failed to get stats', error);
    throw error;
  }
}

// ============================================================================
// Exports
// ============================================================================

// Note: Types are exported inline with their interface definitions above
