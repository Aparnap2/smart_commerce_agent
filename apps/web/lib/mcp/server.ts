/**
 * MCP Server - Auth Wrapper + Langfuse Tracing
 * 
 * Wraps MCP tools with authentication and observability.
 * All tool calls go through this server for:
 * - User authentication
 * - Rate limiting
 * - Langfuse tracing
 * - Error handling
 */

import { z } from 'zod';
import { logger } from '../redis/logger';
import { getTracer } from '../observability/rag-trace';

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    executionTime: number;
    userId?: string;
    traced?: boolean;
  };
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  execute: (args: any, userId: string) => Promise<ToolExecutionResult>;
  requireUserId?: boolean;
}

/**
 * Rate limiter interface
 */
export interface RateLimiter {
  check: (userId: string, action: string) => Promise<{ allowed: boolean; remaining: number }>;
}

/**
 * MCP Server configuration
 */
export interface MCPServerOptions {
  rateLimiter?: RateLimiter;
  enableTracing?: boolean;
}

/**
 * Create MCP server with auth and tracing
 */
export function createMCPServer(options: MCPServerOptions = {}) {
  const { rateLimiter, enableTracing = true } = options;
  const tools = new Map<string, MCPTool>();

  return {
    /**
     * Register a tool
     */
    registerTool(tool: MCPTool) {
      tools.set(tool.name, tool);
      logger.info('MCP', 'Tool registered', { name: tool.name });
    },

    /**
     * Execute a tool with auth and tracing
     */
    async executeTool(
      toolName: string,
      args: Record<string, unknown>,
      userId?: string
    ): Promise<ToolExecutionResult> {
      const startTime = Date.now();
      const tool = tools.get(toolName);

      if (!tool) {
        return {
          success: false,
          error: `Tool not found: ${toolName}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Validate user ID requirement
      if (tool.requireUserId && !userId) {
        return {
          success: false,
          error: 'Authentication required: userId is required',
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Rate limiting
      if (rateLimiter && userId) {
        const rateCheck = await rateLimiter.check(userId, toolName);
        if (!rateCheck.allowed) {
          return {
            success: false,
            error: `Rate limit exceeded. ${rateCheck.remaining} requests remaining`,
            metadata: { executionTime: Date.now() - startTime },
          };
        }
      }

      // Validate args with Zod schema
      const parseResult = tool.schema.safeParse(args);
      if (!parseResult.success) {
        return {
          success: false,
          error: `Invalid arguments: ${parseResult.error.message}`,
          metadata: { executionTime: Date.now() - startTime },
        };
      }

      // Execute with tracing
      if (enableTracing) {
        const tracer = getTracer();
        const traceCtx = tracer.trace(toolName, {
          userId: userId || 'anonymous',
          metadata: { tool: toolName, args: parseResult.data },
        });

        const span = tracer.span(traceCtx, {
          type: 'tool_execution',
          input: parseResult.data,
        });

        try {
          const result = await tool.execute(parseResult.data, userId || 'anonymous');
          
          span.end({
            output: result,
            metadata: {
              executionTime: Date.now() - startTime,
              success: result.success,
            },
          });

          tracer.end(traceCtx, result);

          return {
            ...result,
            metadata: {
              ...result.metadata,
              executionTime: Date.now() - startTime,
              userId,
              traced: true,
            },
          };
        } catch (error) {
          span.end({
            level: 'ERROR',
            statusMessage: error instanceof Error ? error.message : 'Unknown error',
          });

          tracer.end(traceCtx, { error: error instanceof Error ? error.message : 'Unknown' });

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed',
            metadata: { executionTime: Date.now() - startTime, userId, traced: true },
          };
        }
      } else {
        // Execute without tracing
        try {
          const result = await tool.execute(parseResult.data, userId || 'anonymous');
          return {
            ...result,
            metadata: {
              ...result.metadata,
              executionTime: Date.now() - startTime,
              userId,
              traced: false,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed',
            metadata: { executionTime: Date.now() - startTime, userId, traced: false },
          };
        }
      }
    },

    /**
     * Get all registered tools
     */
    getTools() {
      return Array.from(tools.values());
    },

    /**
     * Get tool by name
     */
    getTool(name: string) {
      return tools.get(name);
    },
  };
}

/**
 * Create tool wrapper for easy registration
 */
export function createTool(
  name: string,
  config: {
    title: string;
    description: string;
    parameters: z.ZodObject<any>;
    requireUserId?: boolean;
    execute: (args: any, userId: string) => Promise<ToolExecutionResult>;
  }
): MCPTool {
  return {
    name,
    description: config.description,
    schema: config.parameters,
    requireUserId: config.requireUserId,
    execute: config.execute,
  };
}
