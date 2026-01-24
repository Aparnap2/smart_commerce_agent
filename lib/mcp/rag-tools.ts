/**
 * MCP RAG Tools
 *
 * Model Context Protocol (MCP) tools for RAG operations.
 * Provides semantic search and knowledge base retrieval tools
 * for the e-commerce chatbot.
 *
 * @packageDocumentation
 */

import { z } from 'zod';
import type { Tool } from './types.js';
import { createTool } from './server.js';

/**
 * RAG tools factory options
 */
export interface RAGToolsOptions {
  /** Rate limiter function */
  rateLimiter?: {
    check: (userId: string, action: string) => Promise<{ allowed: boolean; remaining: number }>;
  };
}

/**
 * Create RAG MCP tools
 */
export function createRAGTools(options: RAGToolsOptions = {}): Map<string, Tool> {
  const tools = new Map<string, Tool>();

  // ========== VECTOR SEARCH TOOL ==========

  tools.set('vector_search', createTool('vector_search', {
    title: 'Vector Similarity Search',
    description: 'Search products using semantic similarity with vector embeddings. Use this for natural language product queries like "wireless headphones" or "affordable laptops".',
    parameters: z.object({
      query: z.string().min(1).max(500).describe('Search query in natural language'),
      limit: z.number().int().positive().max(50).default(10).describe('Maximum number of results'),
      minScore: z.number().min(0).max(1).default(0.1).describe('Minimum similarity score (0-1)'),
      category: z.string().optional().describe('Filter by product category'),
      minPrice: z.number().nonnegative().optional().describe('Minimum price filter'),
      maxPrice: z.number().nonnegative().optional().describe('Maximum price filter'),
    }),
    requireUserId: false,
    execute: async (args) => {
      try {
        // Dynamic import to avoid circular dependencies
        const { vectorSearch } = await import('../rag/service.js');

        const result = await vectorSearch(args.query, {
          limit: args.limit,
          minScore: args.minScore,
          filter: {
            category: args.category,
            minPrice: args.minPrice,
            maxPrice: args.maxPrice,
          },
        });

        if (result.error) {
          return {
            success: false,
            error: `Search failed: ${result.error}`,
            data: { results: [], total: 0 },
          };
        }

        return {
          success: true,
          data: {
            results: result.results,
            total: result.total,
            query: args.query,
          },
          metadata: {
            executionTime: Date.now(),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Vector search error: ${error instanceof Error ? error.message : 'Unknown'}`,
          data: { results: [], total: 0 },
        };
      }
    },
  }));

  // ========== DOCUMENT SEARCH TOOL ==========

  tools.set('document_search', createTool('document_search', {
    title: 'Knowledge Base Document Search',
    description: 'Search the knowledge base for policies, FAQs, and documentation. Use this for questions about returns, shipping, refunds, or general policies.',
    parameters: z.object({
      query: z.string().min(1).max(500).describe('Search query for knowledge base'),
      limit: z.number().int().positive().max(20).default(5).describe('Maximum number of results'),
      minScore: z.number().min(0).max(1).default(0.1).describe('Minimum similarity score (0-1)'),
      docType: z.enum(['policy', 'faq', 'guide', 'product_info', 'other']).optional().describe('Filter by document type'),
      category: z.string().optional().describe('Filter by category'),
    }),
    requireUserId: false,
    execute: async (args) => {
      try {
        const { documentSearch } = await import('../rag/service.js');

        const result = await documentSearch(args.query, {
          limit: args.limit,
          minScore: args.minScore,
          filter: {
            docType: args.docType,
            category: args.category,
            isActive: true,
          },
        });

        if (result.error) {
          return {
            success: false,
            error: `Document search failed: ${result.error}`,
            data: { results: [], total: 0 },
          };
        }

        return {
          success: true,
          data: {
            results: result.results,
            total: result.total,
            query: args.query,
          },
          metadata: {
            executionTime: Date.now(),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Document search error: ${error instanceof Error ? error.message : 'Unknown'}`,
          data: { results: [], total: 0 },
        };
      }
    },
  }));

  // ========== RAG QUERY TOOL ==========

  tools.set('rag_query', createTool('rag_query', {
    title: 'Full RAG Query',
    description: 'Execute a complete RAG (Retrieval-Augmented Generation) query. Searches both products and knowledge base to provide comprehensive context for answering user questions. Use this for complex queries that need both product information and policy documentation.',
    parameters: z.object({
      query: z.string().min(1).max(1000).describe('The user query to process'),
      productLimit: z.number().int().positive().max(10).default(5).describe('Maximum product results'),
      documentLimit: z.number().int().positive().max(5).default(3).describe('Maximum document results'),
      minScore: z.number().min(0).max(1).default(0.2).describe('Minimum relevance score'),
      includeProducts: z.boolean().default(true).describe('Whether to include product search'),
      includeDocuments: z.boolean().default(true).describe('Whether to include document search'),
    }),
    requireUserId: false,
    execute: async (args) => {
      try {
        const { ragQuery } = await import('../rag/service.js');

        const result = await ragQuery(args.query, {
          productLimit: args.productLimit,
          documentLimit: args.documentLimit,
          minScore: args.minScore,
          includeProducts: args.includeProducts,
          includeDocuments: args.includeDocuments,
        });

        if (result.error) {
          return {
            success: false,
            error: `RAG query failed: ${result.error}`,
            data: {
              context: '',
              sources: [],
              totalResults: 0,
            },
          };
        }

        return {
          success: true,
          data: {
            context: result.context,
            sources: result.sources,
            totalResults: result.totalResults,
            query: result.query,
          },
          metadata: {
            executionTime: Date.now(),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `RAG query error: ${error instanceof Error ? error.message : 'Unknown'}`,
          data: {
            context: '',
            sources: [],
            totalResults: 0,
          },
        };
      }
    },
  }));

  // ========== INDEX PRODUCT TOOL ==========

  tools.set('index_product', createTool('index_product', {
    title: 'Index Product for Semantic Search',
    description: 'Generate and store vector embedding for a product description. This enables semantic search for the product.',
    parameters: z.object({
      productId: z.number().int().positive().describe('Product ID to index'),
      description: z.string().min(10).max(2000).describe('Product description to embed'),
    }),
    requireUserId: false,
    execute: async (args) => {
      try {
        const { indexProduct } = await import('../rag/service.js');

        const result = await indexProduct(args.productId, args.description);

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            data: { productId: args.productId },
          };
        }

        return {
          success: true,
          data: {
            productId: args.productId,
            embeddingId: result.embeddingId,
          },
          metadata: {
            executionTime: Date.now(),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Indexing error: ${error instanceof Error ? error.message : 'Unknown'}`,
          data: { productId: args.productId },
        };
      }
    },
  }));

  // ========== INDEX DOCUMENT TOOL ==========

  tools.set('index_document', createTool('index_document', {
    title: 'Index Knowledge Base Document',
    description: 'Add a document to the knowledge base with automatic chunking and embedding. Use for adding policies, FAQs, or guides.',
    parameters: z.object({
      title: z.string().min(1).max(200).describe('Document title'),
      content: z.string().min(50).max(50000).describe('Full document content'),
      docType: z.enum(['policy', 'faq', 'guide', 'product_info', 'other']).describe('Document type'),
      category: z.string().optional().describe('Document category'),
      chunkSize: z.number().int().positive().max(2000).default(500).describe('Chunk size for splitting'),
      chunkOverlap: z.number().int().positive().max(500).default(50).describe('Overlap between chunks'),
    }),
    requireUserId: false,
    execute: async (args) => {
      try {
        const { indexDocument } = await import('../rag/service.js');

        const result = await indexDocument(args.title, args.content, args.docType, {
          category: args.category,
          chunkSize: args.chunkSize,
          chunkOverlap: args.chunkOverlap,
        });

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            data: {},
          };
        }

        return {
          success: true,
          data: {
            documentId: result.documentId,
            chunkCount: result.chunkCount,
          },
          metadata: {
            executionTime: Date.now(),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Document indexing error: ${error instanceof Error ? error.message : 'Unknown'}`,
          data: {},
        };
      }
    },
  }));

  // ========== HYBRID SEARCH TOOL ==========

  tools.set('hybrid_search', createTool('hybrid_search', {
    title: 'Hybrid Search (Vector + Keyword)',
    description: 'Search using both semantic similarity and keyword matching. This combines vector search with traditional keyword search for better results.',
    parameters: z.object({
      query: z.string().min(1).max(500).describe('Search query'),
      limit: z.number().int().positive().max(20).default(10).describe('Maximum results'),
      vectorWeight: z.number().min(0).max(1).default(0.7).describe('Weight for vector similarity (0-1)'),
      keywordWeight: z.number().min(0).max(1).default(0.3).describe('Weight for keyword matching (0-1)'),
    }),
    requireUserId: false,
    execute: async (args) => {
      try {
        const { vectorSearch, documentSearch } = await import('../rag/service.js');

        // Execute both searches in parallel
        const [productResult, documentResult] = await Promise.all([
          vectorSearch(args.query, { limit: args.limit }),
          documentSearch(args.query, { limit: args.limit }),
        ]);

        // Merge and re-rank results
        const mergedSources = [
          ...productResult.results.map(p => ({
            type: 'product' as const,
            id: p.id,
            title: p.name,
            score: p.similarity * args.vectorWeight,
            content: p.description || '',
          })),
          ...documentResult.results.map(d => ({
            type: 'document' as const,
            id: d.id,
            title: d.title,
            score: d.similarity * args.vectorWeight,
            content: d.content,
          })),
        ];

        // Sort by combined score
        mergedSources.sort((a, b) => b.score - a.score);

        return {
          success: true,
          data: {
            results: mergedSources.slice(0, args.limit),
            total: mergedSources.length,
            query: args.query,
            reranked: true,
          },
          metadata: {
            executionTime: Date.now(),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Hybrid search error: ${error instanceof Error ? error.message : 'Unknown'}`,
          data: { results: [], total: 0 },
        };
      }
    },
  }));

  // ========== RAG HEALTH CHECK TOOL ==========

  tools.set('rag_health', createTool('rag_health', {
    title: 'RAG Service Health Check',
    description: 'Check the health of the RAG service including Ollama embedding API and database connectivity.',
    parameters: z.object({}),
    requireUserId: false,
    execute: async () => {
      try {
        const { checkRAGHealth, getRAGStats } = await import('../rag/service.js');

        const [health, stats] = await Promise.all([
          checkRAGHealth(),
          getRAGStats(),
        ]);

        return {
          success: health.healthy,
          data: {
            healthy: health.healthy,
            ollama: health.ollama,
            database: health.database,
            model: health.model,
            dimensions: health.dimensions,
            stats,
          },
          error: health.error,
          metadata: {
            executionTime: Date.now(),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Health check error: ${error instanceof Error ? error.message : 'Unknown'}`,
          data: { healthy: false },
        };
      }
    },
  }));

  return tools;
}

/**
 * Register all RAG tools with an MCP server
 */
export function registerRAGTools(server: { registerTool: (name: string, tool: Tool) => void }, options?: RAGToolsOptions): void {
  const tools = createRAGTools(options);

  for (const [name, tool] of tools) {
    server.registerTool(name, tool);
  }
}
