/**
 * MCP Server Adapter
 *
 * Model Context Protocol server implementation for the e-commerce agent.
 * Provides standardized tool definitions and secure tool execution.
 *
 * @packageDocumentation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import type { Tool, ToolResult } from './types.js';

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Input schema for get_order tool
 */
export const GetOrderInputSchema = z.object({
  orderId: z.string().describe('The order ID to retrieve'),
});

/**
 * Input schema for list_orders tool
 */
export const ListOrdersInputSchema = z.object({
  status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  limit: z.number().int().positive().max(100).default(20).describe('Maximum number of orders to return'),
  offset: z.number().int().nonnegative().default(0).describe('Number of orders to skip'),
});

/**
 * Input schema for get_product tool
 */
export const GetProductInputSchema = z.object({
  productId: z.string().describe('The product ID to retrieve'),
});

/**
 * Input schema for search_products tool
 */
export const SearchProductsInputSchema = z.object({
  query: z.string().min(1).describe('Search query for products'),
  category: z.string().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  inStock: z.boolean().optional(),
  limit: z.number().int().positive().max(50).default(10),
});

/**
 * Input schema for create_refund tool
 */
export const CreateRefundInputSchema = z.object({
  orderId: z.string().describe('Order ID for the refund'),
  reason: z.enum(['defective', 'not_as_described', 'wrong_item', 'changed_mind', 'other']).describe('Reason for the refund'),
  reasonDescription: z.string().optional().describe('Additional details about the refund reason'),
  amount: z.number().positive().optional().describe('Refund amount (defaults to full order amount)'),
});

/**
 * Input schema for get_refund_status tool
 */
export const GetRefundStatusInputSchema = z.object({
  refundId: z.string().describe('The refund ID to check'),
});

/**
 * Input schema for create_support_ticket tool
 */
export const CreateSupportTicketInputSchema = z.object({
  orderId: z.string().optional().describe('Related order ID'),
  subject: z.string().min(1).max(500).describe('Ticket subject'),
  description: z.string().min(1).max(10000).describe('Detailed description of the issue'),
  category: z.enum(['order_status', 'shipping', 'return', 'refund', 'product_info', 'payment', 'account', 'technical', 'other']).describe('Ticket category'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').describe('Ticket priority'),
});

/**
 * Input schema for get_ticket_status tool
 */
export const GetTicketStatusInputSchema = z.object({
  ticketId: z.string().describe('The ticket ID to check'),
});

/**
 * Input schema for add_ticket_message tool
 */
export const AddTicketMessageInputSchema = z.object({
  ticketId: z.string().describe('The ticket ID to add a message to'),
  message: z.string().min(1).describe('Message content'),
  isInternal: z.boolean().default(false).describe('Whether this is an internal note'),
});

/**
 * Input schema for get_cart tool
 */
export const GetCartInputSchema = z.object({
  cartId: z.string().optional(),
});

/**
 * Input schema for add_to_cart tool
 */
export const AddToCartInputSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().default(1),
});

/**
 * Input schema for remove_from_cart tool
 */
export const RemoveFromCartInputSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive().optional(),
});

// ============================================================================
// MCP Server Class
// ============================================================================

/**
 * MCP Server for e-commerce agent
 */
export class ECatalogMCPServer {
  private server: Server;
  private tools: Map<string, Tool> = new Map();
  private userId: string | null = null;

  constructor(serverName: string = 'e-commerce-agent', serverVersion: string = '1.0.0') {
    this.server = new Server({ name: serverName, version: serverVersion });

    // Set up request handlers
    this.server.setRequestHandler(ListToolsRequestSchema, this.handleListTools.bind(this));
    this.server.setRequestHandler(CallToolRequestSchema, this.handleCallTool.bind(this));
    this.server.setRequestHandler(ListResourcesRequestSchema, this.handleListResources.bind(this));
    this.server.setRequestHandler(ReadResourceRequestSchema, this.handleReadResource.bind(this));
    this.server.setRequestHandler(ListPromptsRequestSchema, this.handleListPrompts.bind(this));
    this.server.setRequestHandler(GetPromptRequestSchema, this.handleGetPrompt.bind(this));
  }

  /**
   * Set the current user context for authorization
   */
  setUserContext(userId: string): void {
    this.userId = userId;
  }

  /**
   * Clear user context
   */
  clearUserContext(): void {
    this.userId = null;
  }

  /**
   * Register a tool with the server
   */
  registerTool(name: string, tool: Tool): void {
    this.tools.set(name, tool);

    // Note: MCP SDK v1.x uses setRequestHandler instead of registerTool
    // Tool execution is handled through handleCallTool
  }

  /**
   * Handle list tools request
   */
  private async handleListTools() {
    const tools = Array.from(this.tools.values()).map((tool) => {
      // Access Zod schema shape - works with both Zod v3 and v4
      const shape = (tool.parameters as any)._def?.shape?.() || (tool.parameters as any).shape || {};
      const required = Object.keys(shape).filter(
        (key: string) => !shape[key]?.isOptional?.()
      );

      return {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: {
          type: 'object' as const,
          properties: shape,
          required,
        },
      };
    });

    return { tools };
  }

  /**
   * Handle call tool request
   */
  private async handleCallTool(request: { params: { name: string; arguments: Record<string, unknown> } }) {
    const { name, arguments: args } = request.params;

    try {
      const result = await this.executeTool(name, args);
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Execute a tool
   */
  private async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Validate arguments
    const parsed = tool.parameters.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }

    // Check authorization
    if (tool.requireUserId && !this.userId) {
      throw new Error('Authorization required');
    }

    // Execute tool
    return tool.execute(parsed.data as Record<string, unknown>, this.userId);
  }

  /**
   * Handle list resources request
   */
  private async handleListResources() {
    return { resources: [] };
  }

  /**
   * Handle read resource request
   */
  private async handleReadResource(request: { params: { uri: string } }) {
    throw new Error(`Unknown resource: ${request.params.uri}`);
  }

  /**
   * Handle list prompts request
   */
  private async handleListPrompts() {
    return { prompts: [] };
  }

  /**
   * Handle get prompt request
   */
  private async handleGetPrompt(request: { params: { name: string; arguments: Record<string, unknown> } }) {
    throw new Error(`Unknown prompt: ${request.params.name}`);
  }

  /**
   * Get the underlying MCP server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Start the server
   * Note: MCP transport is disabled for browser environments
   * In production, this would connect to an MCP client
   */
  async start(): Promise<void> {
    // Transport is not used in browser/Next.js context
    // MCP server functionality is available through direct method calls
    console.log('[MCP] Server initialized (transport disabled in browser context)');
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // MCP SDK v1.x doesn't have a disconnect method
    console.log('[MCP] Server stopped');
  }
}

// ============================================================================
// Tool Type Helpers
// ============================================================================

/**
 * Create a tool with proper typing
 */
export function createTool<T extends z.ZodType = z.ZodType>(
  name: string,
  options: {
    title: string;
    description: string;
    parameters: T;
    requireUserId?: boolean;
    execute: (args: z.infer<T>, userId: string | null) => Promise<unknown>;
  }
): Tool<z.infer<T>> {
  return {
    name,
    title: options.title,
    description: options.description,
    parameters: options.parameters as z.ZodType<z.infer<T>>,
    requireUserId: options.requireUserId ?? true,
    execute: options.execute,
  } as Tool<z.infer<T>>;
}

// ============================================================================
// Re-export types
// ============================================================================

export type {
  Tool,
  ToolResult,
} from './types.js';
