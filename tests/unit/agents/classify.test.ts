/**
 * Classify Intent Node Test
 * 
 * Tests for lib/agents/nodes/classify.ts
 * Tests intent classification using Azure AI Foundry
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment
vi.mock('../../../lib/env.js', () => ({
  env: {
    AZURE_OPENAI_ENDPOINT: 'https://test.openai.azure.com',
    AZURE_OPENAI_API_KEY: 'test-key',
    AZURE_OPENAI_DEPLOYMENT: 'gpt-4o-mini',
  },
}));

describe('Classify Intent Node', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Intent Classification', () => {
    it('should classify product search intent', async () => {
      // Mock Azure AI response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'product_search',
                entities: { products: ['laptop'], categories: ['electronics'] },
                sentiment: 'neutral',
                confidence: 0.95,
              }),
            },
          }],
        }),
      });

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: Show me wireless headphones'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      expect(result.intent).toBe('product_search');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should classify cart add intent', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'cart_add',
                entities: { productId: 'prod_123', quantity: 2 },
                sentiment: 'positive',
                confidence: 0.92,
              }),
            },
          }],
        }),
      });

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: Add this to my cart'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      expect(result.intent).toBe('cart_add');
      expect(result.entities?.productId).toBe('prod_123');
    });

    it('should classify checkout intent', async () => {
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

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: I want to checkout'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      expect(result.intent).toBe('checkout');
    });

    it('should classify order status intent', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'order_status',
                entities: { orderId: 'ORD-12345' },
                sentiment: 'neutral',
                confidence: 0.90,
              }),
            },
          }],
        }),
      });

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: Where is my order ORD-12345?'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      expect(result.intent).toBe('order_status');
      expect(result.entities?.orderId).toBe('ORD-12345');
    });

    it('should detect frustrated sentiment', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'support',
                entities: { orderId: 'ORD-999' },
                sentiment: 'frustrated',
                confidence: 0.88,
              }),
            },
          }],
        }),
      });

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: This is ridiculous! My order is still not delivered!'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      expect(result.sentiment).toBe('frustrated');
      expect(result.intent).toBe('support');
    });

    it('should handle general greetings', async () => {
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

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: Hello!'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      expect(result.intent).toBe('general');
    });

    it('should extract price constraints', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'product_search',
                entities: { 
                  products: ['laptop'], 
                  maxPrice: 1000,
                  categories: ['electronics'],
                },
                sentiment: 'neutral',
                confidence: 0.93,
              }),
            },
          }],
        }),
      });

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: Show me laptops under $1000'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      expect(result.entities?.maxPrice).toBe(1000);
      expect(result.entities?.products).toContain('laptop');
    });

    it('should handle Azure AI errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: Show me products'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      // Should fallback to general intent on error
      expect(result.intent).toBe('general');
      expect(result.error).toBeDefined();
    });

    it('should handle invalid JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: { content: 'invalid json' },
          }],
        }),
      });

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: Show me products'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      // Should fallback to general intent on parse error
      expect(result.intent).toBe('general');
      expect(result.error).toBeDefined();
    });
  });

  describe('Entity Extraction', () => {
    it('should extract multiple products from query', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'product_search',
                entities: { 
                  products: ['iPhone', 'AirPods', 'MacBook'],
                  categories: ['smartphones', 'audio', 'laptops'],
                },
                sentiment: 'positive',
                confidence: 0.94,
              }),
            },
          }],
        }),
      });

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: I want to see iPhone, AirPods, and MacBook'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      expect(result.entities?.products).toHaveLength(3);
      expect(result.entities?.products).toContain('iPhone');
    });

    it('should extract email for order lookup', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: 'order_history',
                entities: { email: 'user@example.com' },
                sentiment: 'neutral',
                confidence: 0.91,
              }),
            },
          }],
        }),
      });

      const { classifyIntent } = await import('../../../lib/agents/nodes/classify');
      
      const state = {
        messages: ['user: Show orders for user@example.com'],
        userId: 'user123',
      };

      const result = await classifyIntent(state);

      expect(result.entities?.email).toBe('user@example.com');
    });
  });
});
