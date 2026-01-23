/**
 * E-Commerce Support Agent - Tool Agent
 *
 * Handles database queries and searches with hybrid search capabilities:
 * - db_query: PostgreSQL/Prisma queries for orders, products
 * - serp_search: Web search via SerpAPI for external info
 * - vector_search: pgvector for semantic search on preferences
 *
 * Uses MCP adapter for standardized tool definitions and execution.
 *
 * @packageDocumentation
 * TEMPORARILY DISABLED - LangGraph API incompatible with current version
 */

import type {
  AgentState,
  ToolExecutionState,
  ToolResult,
  QueryContext,
} from './state';

import { ToolResultSchema } from './state';
import { hybridSearchTool } from '@/lib/mcp/adapter';

/**
 * Creates the tool agent graph.
 * TEMPORARILY DISABLED - returns null
 */
export function createToolGraph() {
  console.warn('LangGraph tool agent disabled - using Ollama route instead');
  return null;
}

export function createDefaultToolGraph() {
  return createToolGraph();
}

export class ToolAgent {
  constructor(graph = null) {
    this.graph = graph;
  }

  async execute(query: string, context: QueryContext): Promise<ToolResult[]> {
    console.log('[ToolAgent] Executing query:', query, context);
    return [];
  }

  private graph: any = null;
}
