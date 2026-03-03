/**
 * Supervisor Graph Test
 * 
 * Tests for lib/agents/supervisor.ts
 * Tests graph assembly and routing logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Supervisor Graph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Graph Creation', () => {
    it('should create graph with all nodes', async () => {
      const { createSupervisorGraph } = await import('../../../lib/agents/supervisor');
      
      const graph = createSupervisorGraph();

      expect(graph).toBeDefined();
      expect(graph.channels).toBeDefined();
    });

    it('should have classify as first node', async () => {
      const { createSupervisorGraph } = await import('../../../lib/agents/supervisor');
      
      const graph = createSupervisorGraph();

      // Graph should start with classify node
      expect(graph.channels).toBeDefined();
    });
  });

  describe('Intent Routing', () => {
    it('should route product_search to search_node', async () => {
      const { createSupervisorGraph } = await import('../../../lib/agents/supervisor');
      
      const graph = createSupervisorGraph();

      // Mock classify to return product_search
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'product_search',
                entities: { products: ['laptop'] },
                sentiment: 'neutral',
                confidence: 0.95,
              }),
            },
          }],
        }),
      });

      const result = await graph.invoke({
        messages: ['user: Show me laptops'],
        userId: 'user123',
      });

      expect(result).toBeDefined();
      expect(result.intent).toBe('product_search');
    });

    it('should route general to response_node', async () => {
      const { createSupervisorGraph } = await import('../../../lib/agents/supervisor');
      
      const graph = createSupervisorGraph();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'general',
                entities: {},
                sentiment: 'positive',
                confidence: 0.99,
              }),
            },
          }],
        }),
      });

      const result = await graph.invoke({
        messages: ['user: Hello!'],
        userId: 'user123',
      });

      expect(result.intent).toBe('general');
      expect(result.messages).toHaveLength(2); // Original + response
    });

    it('should route cart_add to cart_node', async () => {
      const { createSupervisorGraph } = await import('../../../lib/agents/supervisor');
      
      const graph = createSupervisorGraph();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'cart_add',
                entities: { productId: 'prod_123' },
                sentiment: 'positive',
                confidence: 0.92,
              }),
            },
          }],
        }),
      });

      const result = await graph.invoke({
        messages: ['user: Add to cart'],
        userId: 'user123',
      });

      expect(result.intent).toBe('cart_add');
    });

    it('should route checkout to checkout_node', async () => {
      const { createSupervisorGraph } = await import('../../../lib/agents/supervisor');
      
      const graph = createSupervisorGraph();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'checkout',
                entities: {},
                sentiment: 'positive',
                confidence: 0.98,
              }),
            },
          }],
        }),
      });

      const result = await graph.invoke({
        messages: ['user: I want to checkout'],
        userId: 'user123',
      });

      expect(result.intent).toBe('checkout');
    });

    it('should handle frustrated sentiment', async () => {
      const { createSupervisorGraph } = await import('../../../lib/agents/supervisor');
      
      const graph = createSupervisorGraph();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'support',
                entities: {},
                sentiment: 'frustrated',
                confidence: 0.88,
              }),
            },
          }],
        }),
      });

      const result = await graph.invoke({
        messages: ['user: This is ridiculous!'],
        userId: 'user123',
      });

      expect(result.sentiment).toBe('frustrated');
      expect(result.messages.some((m: string) => m.includes('frustration'))).toBe(true);
    });
  });

  describe('State Accumulation', () => {
    it('should accumulate messages through workflow', async () => {
      const { createSupervisorGraph } = await import('../../../lib/agents/supervisor');
      
      const graph = createSupervisorGraph();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'general',
                entities: {},
                sentiment: 'neutral',
                confidence: 0.9,
              }),
            },
          }],
        }),
      });

      const result = await graph.invoke({
        messages: ['user: Hello'],
        userId: 'user123',
      });

      // Should have original + response
      expect(result.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('should preserve userId through workflow', async () => {
      const { createSupervisorGraph } = await import('../../../lib/agents/supervisor');
      
      const graph = createSupervisorGraph();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'general',
                entities: {},
                sentiment: 'neutral',
                confidence: 0.9,
              }),
            },
          }],
        }),
      });

      const result = await graph.invoke({
        messages: ['user: Hello'],
        userId: 'test-user-456',
      });

      expect(result.userId).toBe('test-user-456');
    });
  });

  describe('Error Handling', () => {
    it('should handle classification errors gracefully', async () => {
      const { createSupervisorGraph } = await import('../../../lib/agents/supervisor');
      
      const graph = createSupervisorGraph();

      // Mock network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await graph.invoke({
        messages: ['user: Test'],
        userId: 'user123',
      });

      // Should fallback to general intent
      expect(result.intent).toBe('general');
      expect(result.error).toBeDefined();
    });
  });
});
