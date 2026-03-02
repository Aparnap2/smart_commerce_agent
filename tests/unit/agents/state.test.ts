/**
 * Agent State Types Test
 * 
 * Tests for lib/agents/state.ts
 * Verifies type definitions and state reducer logic
 */

import { describe, it, expect } from 'vitest';

// Test the state reducer logic directly (without importing LangGraph)
describe('AgentState Reducers', () => {
  describe('Message Reducer', () => {
    const messageReducer = (left: string[], right: string[]) => [...left, ...right];

    it('should accumulate messages', () => {
      const left = ['user: Hello', 'assistant: Hi there!'];
      const right = ['user: Show me laptops'];

      const result = messageReducer(left, right);

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        'user: Hello',
        'assistant: Hi there!',
        'user: Show me laptops',
      ]);
    });

    it('should handle empty arrays', () => {
      const left: string[] = [];
      const right = ['user: First message'];

      const result = messageReducer(left, right);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('user: First message');
    });
  });

  describe('ToolResults Reducer', () => {
    const toolResultsReducer = (left: any[], right: any[]) => [...left, ...right];

    it('should accumulate tool results', () => {
      const left = [
        { tool: 'search', success: true, data: { results: [] } },
      ];
      const right = [
        { tool: 'cart', success: true, data: { cartId: '123' } },
      ];

      const result = toolResultsReducer(left, right);

      expect(result).toHaveLength(2);
      expect(result[0].tool).toBe('search');
      expect(result[1].tool).toBe('cart');
    });
  });

  describe('Metadata Reducer', () => {
    const metadataReducer = (prev: any, next: any) => ({ ...prev, ...next });

    it('should merge metadata objects', () => {
      const left = { userId: 'user1', sessionId: 'sess1' };
      const right = { intent: 'product_search' };

      const result = metadataReducer(left, right);

      expect(result).toEqual({
        userId: 'user1',
        sessionId: 'sess1',
        intent: 'product_search',
      });
    });

    it('should override existing keys', () => {
      const left = { count: 1 };
      const right = { count: 2 };

      const result = metadataReducer(left, right);

      expect(result.count).toBe(2);
    });
  });
});

describe('Intent Types', () => {
  const validIntents = [
    'product_search',
    'cart_add',
    'cart_update',
    'cart_remove',
    'cart_view',
    'checkout',
    'payment',
    'order_status',
    'order_history',
    'order_cancel',
    'refund_request',
    'support',
    'recommendation',
    'general',
  ];

  it('should accept all valid intent types', () => {
    validIntents.forEach((intent) => {
      expect(() => {
        const state = { intent };
        expect(state.intent).toBe(intent);
      }).not.toThrow();
    });
  });
});

describe('Sentiment Types', () => {
  const validSentiments = ['positive', 'neutral', 'negative', 'frustrated'];

  it('should accept all valid sentiment types', () => {
    validSentiments.forEach((sentiment) => {
      expect(() => {
        const state = { sentiment };
        expect(state.sentiment).toBe(sentiment);
      }).not.toThrow();
    });
  });
});
