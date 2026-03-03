/**
 * MCP Checkout & Order Tools Tests
 * TDD: Tests written before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/tools/database.js', () => ({
  queryDatabase: vi.fn(),
}));

vi.mock('../../lib/redis/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MCP Checkout & Order Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('checkout.create', () => {
    it('should create checkout session successfully', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const checkoutTool = tools.get('checkout.create');

      expect(checkoutTool).toBeDefined();

      const result = await checkoutTool?.execute(
        {
          cartId: 'cart-123',
          paymentMethodId: 'pm_123',
          shippingAddress: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            zip: '10001',
            country: 'US',
          },
        },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('checkoutId');
      expect(result.data).toHaveProperty('status', 'pending');
    });

    it('should require payment method', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const checkoutTool = tools.get('checkout.create');

      const result = await checkoutTool?.execute(
        {
          cartId: 'cart-123',
          shippingAddress: { street: '123 Main St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
        },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('payment');
    });

    it('should handle empty cart', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ 
        db: {
          ...createMockDb(),
          cart: {
            findUnique: vi.fn().mockResolvedValue({ items: [], customerId: 'user-456' }),
          },
        }
      });
      const checkoutTool = tools.get('checkout.create');

      const result = await checkoutTool?.execute(
        {
          cartId: 'cart-123',
          paymentMethodId: 'pm_123',
          shippingAddress: { street: '123 Main St', city: 'NYC', state: 'NY', zip: '10001', country: 'US' },
        },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('orders.create_from_cart', () => {
    it('should create order from cart successfully', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const createOrderTool = tools.get('orders.create_from_cart');

      const result = await createOrderTool?.execute(
        { cartId: 'cart-123' },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('orderId');
      expect(result.data).toHaveProperty('status', 'confirmed');
    });

    it('should fail for non-existent cart', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ 
        db: {
          ...createMockDb(),
          cart: { findUnique: vi.fn().mockResolvedValue(null) },
        }
      });
      const createOrderTool = tools.get('orders.create_from_cart');

      const result = await createOrderTool?.execute(
        { cartId: 'non-existent' },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('orders.cancel', () => {
    it('should cancel order successfully', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ db: createMockDb() });
      const cancelTool = tools.get('orders.cancel');

      const result = await cancelTool?.execute(
        { orderId: 'order-123' },
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status', 'cancelled');
    });

    it('should not allow cancelling already shipped order', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ 
        db: {
          ...createMockDb(),
          orders: {
            findUnique: vi.fn().mockResolvedValue({ 
              id: 'order-123', 
              customerId: 'user-456', 
              status: 'shipped' 
            }),
            update: vi.fn(),
          },
        }
      });
      const cancelTool = tools.get('orders.cancel');

      const result = await cancelTool?.execute(
        { orderId: 'order-123' },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot cancel');
    });

    it('should enforce user ownership', async () => {
      const { createSecureTools } = await import('../../lib/mcp/tools.js');
      const tools = createSecureTools({ 
        db: {
          ...createMockDb(),
          orders: {
            findUnique: vi.fn().mockResolvedValue({ 
              id: 'order-123', 
              customerId: 'other-user', 
              status: 'pending' 
            }),
          },
        }
      });
      const cancelTool = tools.get('orders.cancel');

      const result = await cancelTool?.execute(
        { orderId: 'order-123' },
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});

function createMockDb() {
  return {
    orders: {
      findUnique: vi.fn().mockResolvedValue({ id: 'order-123', customerId: 'user-456', status: 'pending' }),
      findMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'order-123', status: 'confirmed' }),
      update: vi.fn().mockResolvedValue({ id: 'order-123', status: 'cancelled' }),
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
      findUnique: vi.fn().mockResolvedValue({ 
        id: 'cart-123', 
        customerId: 'user-456',
        items: [{ productId: 1, quantity: 2, price: 50 }],
      }),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}
