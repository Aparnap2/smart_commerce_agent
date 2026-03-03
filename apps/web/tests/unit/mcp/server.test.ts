/**
 * MCP Server Tests
 * 
 * Tests for lib/mcp/server.ts
 * Tests auth wrapper, rate limiting, and Langfuse tracing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createMCPServer, createTool } from '../../../lib/mcp/server';

// Mock logger
vi.mock('../../../lib/redis/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock tracer
vi.mock('../../../lib/observability/rag-trace', () => ({
  getTracer: () => ({
    trace: vi.fn().mockReturnValue({ traceId: 'test-trace' }),
    span: vi.fn().mockReturnValue({
      end: vi.fn(),
    }),
    end: vi.fn(),
  }),
}));

describe('MCP Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Server Creation', () => {
    it('should create server with default options', () => {
      const server = createMCPServer();
      expect(server).toBeDefined();
      expect(server.getTools()).toEqual([]);
    });

    it('should create server with rate limiter', () => {
      const rateLimiter = { check: vi.fn().mockResolvedValue({ allowed: true, remaining: 100 }) };
      const server = createMCPServer({ rateLimiter });
      expect(server).toBeDefined();
    });

    it('should create server without tracing', () => {
      const server = createMCPServer({ enableTracing: false });
      expect(server).toBeDefined();
    });
  });

  describe('Tool Registration', () => {
    it('should register tool successfully', () => {
      const server = createMCPServer();
      const tool = createTool('test_tool', {
        title: 'Test Tool',
        description: 'A test tool',
        parameters: z.object({ value: z.string() }),
        execute: async (args) => ({ success: true, data: args }),
      });
      server.registerTool(tool);
      expect(server.getTools()).toHaveLength(1);
    });

    it('should register multiple tools', () => {
      const server = createMCPServer();
      server.registerTool(createTool('tool1', {
        title: 'Tool 1', description: 'First', parameters: z.object({}),
        execute: async () => ({ success: true }),
      }));
      server.registerTool(createTool('tool2', {
        title: 'Tool 2', description: 'Second', parameters: z.object({}),
        execute: async () => ({ success: true }),
      }));
      expect(server.getTools()).toHaveLength(2);
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool successfully', async () => {
      const server = createMCPServer();
      server.registerTool(createTool('echo', {
        title: 'Echo', description: 'Echoes', parameters: z.object({ message: z.string() }),
        execute: async (args) => ({ success: true, data: args }),
      }));
      const result = await server.executeTool('echo', { message: 'Hello' }, 'user123');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ message: 'Hello' });
    });

    it('should fail for non-existent tool', async () => {
      const server = createMCPServer();
      const result = await server.executeTool('nonexistent', {}, 'user123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    it('should fail when userId required but not provided', async () => {
      const server = createMCPServer();
      server.registerTool(createTool('auth_tool', {
        title: 'Auth', description: 'Requires auth', parameters: z.object({}),
        requireUserId: true, execute: async () => ({ success: true }),
      }));
      const result = await server.executeTool('auth_tool', {}, undefined);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication required');
    });

    it('should validate arguments with Zod', async () => {
      const server = createMCPServer();
      server.registerTool(createTool('num', {
        title: 'Num', description: 'Number', parameters: z.object({ count: z.number().positive() }),
        execute: async (args) => ({ success: true, data: args }),
      }));
      const result = await server.executeTool('num', { count: -5 }, 'user123');
      expect(result.success).toBe(false);
    });

    it('should handle execution errors', async () => {
      const server = createMCPServer();
      server.registerTool(createTool('fail', {
        title: 'Fail', description: 'Fails', parameters: z.object({}),
        execute: async () => { throw new Error('Failed'); },
      }));
      const result = await server.executeTool('fail', {}, 'user123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed');
    });
  });

  describe('Rate Limiting', () => {
    it('should block when rate limited', async () => {
      const server = createMCPServer({ rateLimiter: { check: vi.fn().mockResolvedValue({ allowed: false, remaining: 0 }) } });
      server.registerTool(createTool('tool', {
        title: 'Tool', description: 'Tool', parameters: z.object({}),
        execute: async () => ({ success: true }),
      }));
      const result = await server.executeTool('tool', {}, 'user123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit');
    });

    it('should allow when within limit', async () => {
      const server = createMCPServer({ rateLimiter: { check: vi.fn().mockResolvedValue({ allowed: true, remaining: 99 }) } });
      server.registerTool(createTool('tool', {
        title: 'Tool', description: 'Tool', parameters: z.object({}),
        execute: async () => ({ success: true, data: 'ok' }),
      }));
      const result = await server.executeTool('tool', {}, 'user123');
      expect(result.success).toBe(true);
    });
  });

  describe('Tracing', () => {
    it('should trace when enabled', async () => {
      const server = createMCPServer({ enableTracing: true });
      server.registerTool(createTool('trace', {
        title: 'Trace', description: 'Traced', parameters: z.object({ value: z.string() }),
        execute: async (args) => ({ success: true, data: args }),
      }));
      const result = await server.executeTool('trace', { value: 'test' }, 'user123');
      expect(result.metadata?.traced).toBe(true);
    });

    it('should not trace when disabled', async () => {
      const server = createMCPServer({ enableTracing: false });
      server.registerTool(createTool('notrace', {
        title: 'NoTrace', description: 'Not traced', parameters: z.object({}),
        execute: async () => ({ success: true }),
      }));
      const result = await server.executeTool('notrace', {}, 'user123');
      expect(result.metadata?.traced).toBe(false);
    });
  });

  describe('Metadata', () => {
    it('should include execution time', async () => {
      const server = createMCPServer();
      server.registerTool(createTool('time', {
        title: 'Time', description: 'Timed', parameters: z.object({}),
        execute: async () => ({ success: true }),
      }));
      const result = await server.executeTool('time', {}, 'user123');
      expect(result.metadata?.executionTime).toBeDefined();
    });

    it('should preserve tool metadata', async () => {
      const server = createMCPServer();
      server.registerTool(createTool('meta', {
        title: 'Meta', description: 'Metadata', parameters: z.object({}),
        execute: async () => ({ success: true, data: 'test', metadata: { custom: 'value' } }),
      }));
      const result = await server.executeTool('meta', {}, 'user123');
      expect(result.metadata?.custom).toBe('value');
    });
  });
});

describe('createTool Helper', () => {
  it('should create tool with correct structure', () => {
    const tool = createTool('test', {
      title: 'Test', description: 'Test tool', parameters: z.object({ value: z.string() }),
      requireUserId: true, execute: async (args, userId) => ({ success: true, data: { args, userId } }),
    });
    expect(tool.name).toBe('test');
    expect(tool.description).toBe('Test tool');
    expect(tool.schema).toBeDefined();
    expect(tool.requireUserId).toBe(true);
  });
});
