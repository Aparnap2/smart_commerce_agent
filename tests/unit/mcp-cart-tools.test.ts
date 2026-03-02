/**
 * MCP Cart Tools Tests
 * 
 * TDD approach: Tests written before implementation
 * Tests for: cart.update_quantity, cart.remove_item, cart.clear, cart.apply_coupon
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database
vi.mock('../../lib/tools/database.js', () => ({
  queryDatabase: vi.fn(),
}));

// Mock logger
vi.mock('../../lib/redis/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MCP Cart Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('cart.update_quantity', () => {
    it('should update cart item quantity successfully', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      vi.mocked(queryDatabase).mockResolvedValue([{ id: 1, quantity: 3 }]);

      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const updateTool = tools.get('cart.update_quantity');

      expect(updateTool).toBeDefined();

      const result = await updateTool?.execute(
        { cartId: 'cart-123', productId: 1, quantity: 3 },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('quantity', 3);
    });

    it('should reject negative quantities', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const updateTool = tools.get('cart.update_quantity');

      const result = await updateTool?.execute(
        { cartId: 'cart-123', productId: 1, quantity: -1 },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('quantity');
    });

    it('should reject zero quantity', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const updateTool = tools.get('cart.update_quantity');

      const result = await updateTool?.execute(
        { cartId: 'cart-123', productId: 1, quantity: 0 },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('quantity');
    });

    it('should handle non-existent cart', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      vi.mocked(queryDatabase).mockResolvedValue([]);

      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const updateTool = tools.get('cart.update_quantity');

      const result = await updateTool?.execute(
        { cartId: 'non-existent', productId: 1, quantity: 2 },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should enforce user ownership', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const updateTool = tools.get('cart.update_quantity');

      // Try to update without user ID
      const result = await updateTool?.execute(
        { cartId: 'cart-123', productId: 1, quantity: 2 },
        undefined
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authorization');
    });
  });

  describe('cart.remove_item', () => {
    it('should remove item from cart successfully', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      vi.mocked(queryDatabase).mockResolvedValue([{ success: true }]);

      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const removeTool = tools.get('cart.remove_item');

      const result = await removeTool?.execute(
        { cartId: 'cart-123', productId: 1 },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('removed', true);
    });

    it('should handle non-existent item gracefully', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      vi.mocked(queryDatabase).mockResolvedValue([]);

      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const removeTool = tools.get('cart.remove_item');

      const result = await removeTool?.execute(
        { cartId: 'cart-123', productId: 999 },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('cart.clear', () => {
    it('should clear all items from cart', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      vi.mocked(queryDatabase).mockResolvedValue([{ count: 5 }]);

      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const clearTool = tools.get('cart.clear');

      const result = await clearTool?.execute(
        { cartId: 'cart-123' },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('clearedItems', 5);
    });

    it('should handle empty cart', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      vi.mocked(queryDatabase).mockResolvedValue([{ count: 0 }]);

      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const clearTool = tools.get('cart.clear');

      const result = await clearTool?.execute(
        { cartId: 'cart-123' },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('clearedItems', 0);
    });
  });

  describe('cart.apply_coupon', () => {
    it('should apply valid coupon successfully', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      vi.mocked(queryDatabase)
        .mockResolvedValueOnce([{ code: 'SAVE10', discount_type: 'percentage', discount_value: 10, is_active: true }])
        .mockResolvedValueOnce([{ id: 1 }]);

      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const couponTool = tools.get('cart.apply_coupon');

      const result = await couponTool?.execute(
        { cartId: 'cart-123', couponCode: 'SAVE10' },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('discount');
    });

    it('should reject invalid coupon code', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      vi.mocked(queryDatabase).mockResolvedValue([]);

      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const couponTool = tools.get('cart.apply_coupon');

      const result = await couponTool?.execute(
        { cartId: 'cart-123', couponCode: 'INVALID' },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid coupon');
    });

    it('should reject expired coupon', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      const expiredDate = new Date('2020-01-01').toISOString();
      vi.mocked(queryDatabase).mockResolvedValue([
        { code: 'EXPIRED', discount_type: 'percentage', discount_value: 10, is_active: true, expires_at: expiredDate }
      ]);

      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const couponTool = tools.get('cart.apply_coupon');

      const result = await couponTool?.execute(
        { cartId: 'cart-123', couponCode: 'EXPIRED' },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject inactive coupon', async () => {
      const { queryDatabase } = await import('../../lib/tools/database.js');
      vi.mocked(queryDatabase).mockResolvedValue([
        { code: 'INACTIVE', discount_type: 'percentage', discount_value: 10, is_active: false }
      ]);

      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const couponTool = tools.get('cart.apply_coupon');

      const result = await couponTool?.execute(
        { cartId: 'cart-123', couponCode: 'INACTIVE' },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });
  });
});

// Mock database factory
function createMockDb() {
  return {
    orders: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    products: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    refunds: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    tickets: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cart: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}
