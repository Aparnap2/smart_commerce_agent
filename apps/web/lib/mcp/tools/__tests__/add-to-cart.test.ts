/**
 * Add to Cart Tool Tests
 *
 * TDD Test suite for addToCart MCP tool with idempotency protection.
 * Tests schema validation, tool execution, idempotency, and optimistic locking.
 *
 * @file lib/mcp/tools/__tests__/add-to-cart.test.ts
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { addToCart, addToCartSchema } from '../add-to-cart';
import { prisma } from '@/lib/prisma/client';
import { redis } from '@/lib/redis/client';

// Mock Prisma
vi.mock('@/lib/prisma/client', () => ({
  prisma: {
    product: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    cart: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock Redis
vi.mock('@/lib/redis/client', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn(),
    keys: vi.fn(),
  },
}));

// Mock Langfuse
vi.mock('@/lib/observability/langfuse', () => ({
  initializeLangfuse: () => ({
    trace: vi.fn(() => ({
      span: vi.fn(() => ({
        end: vi.fn(),
      })),
      end: vi.fn(),
    })),
  }),
}));

describe('addToCart Tool', () => {
  describe('Schema Validation', () => {
    it('accepts valid productId and quantity', async () => {
      const result = await addToCartSchema.parseAsync({
        productId: 'prod_123',
        quantity: 2,
      });
      expect(result).toEqual({ productId: 'prod_123', quantity: 2 });
    });

    it('rejects quantity < 1', async () => {
      await expect(
        addToCartSchema.parseAsync({ productId: 'prod_123', quantity: 0 })
      ).rejects.toThrow();
    });

    it('rejects quantity > 99', async () => {
      await expect(
        addToCartSchema.parseAsync({ productId: 'prod_123', quantity: 100 })
      ).rejects.toThrow();
    });

    it('rejects invalid productId format', async () => {
      await expect(
        addToCartSchema.parseAsync({ productId: '', quantity: 1 })
      ).rejects.toThrow();
    });
  });

  describe('Tool Execution', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Mock Redis cleanup
      vi.mocked(redis.keys).mockResolvedValue([]);
      vi.mocked(redis.del).mockResolvedValue(0);
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('adds product to cart and returns updated cart', async () => {
      // Seed test product mock
      const mockProduct = {
        id: 'prod_test_123',
        name: 'Test Headphones',
        price: 9999,
        category: 'headphones',
        stockCount: 10,
      };

      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct);
      vi.mocked(prisma.cart.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cart.create).mockResolvedValue({
        id: 'cart_123',
        userId: 'test-user',
        items: [] as any,
        total: 0,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(prisma.cart.update).mockResolvedValue({
        id: 'cart_123',
        userId: 'test-user',
        items: [{ productId: mockProduct.id, quantity: 1, price: mockProduct.price }] as any,
        total: 9999,
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await addToCart.execute(
        { productId: mockProduct.id, quantity: 1 },
        'test-user'
      );

      expect(result.success).toBe(true);
      expect((result.data as any).cart.items).toHaveLength(1);
      expect((result.data as any).cart.total).toBe(9999);
    });

    it('is idempotent — duplicate call returns same cart', async () => {
      const mockProduct = {
        id: 'prod_test_123',
        name: 'Test',
        price: 9999,
        category: 'test',
        stockCount: 10,
      };

      // First call - execute normally
      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct);
      vi.mocked(prisma.cart.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cart.create).mockResolvedValue({
        id: 'cart_123',
        userId: 'test-user',
        items: [] as any,
        total: 0,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(prisma.cart.update).mockResolvedValue({
        id: 'cart_123',
        userId: 'test-user',
        items: [{ productId: mockProduct.id, quantity: 1, price: mockProduct.price }] as any,
        total: 9999,
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(redis.get).mockResolvedValue(null);

      const result1 = await addToCart.execute(
        { productId: mockProduct.id, quantity: 1 },
        'test-user'
      );

      // Second call - return cached result (idempotency)
      const cachedResult = {
        success: true,
        data: {
          cart: {
            id: 'cart_123',
            userId: 'test-user',
            items: [{ productId: mockProduct.id, quantity: 1, price: mockProduct.price }],
            total: 9999,
            version: 2,
          },
        },
        metadata: { executionTime: Date.now(), userId: 'test-user', traced: true },
      };
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cachedResult));

      const result2 = await addToCart.execute(
        { productId: mockProduct.id, quantity: 1 },
        'test-user'
      );

      // Idempotency key prevents double-add
      expect((result2.data as any).cart.items).toHaveLength(1);
      expect((result2.data as any).cart.total).toBe((result1.data as any).cart.total);
    });

    it('rejects when stock is 0', async () => {
      const mockProduct = {
        id: 'prod_test_123',
        name: 'Test',
        price: 9999,
        category: 'test',
        stockCount: 0,
      };

      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct);

      const result = await addToCart.execute(
        { productId: mockProduct.id, quantity: 1 },
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('stock');
    });

    it('rejects when product not found', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

      const result = await addToCart.execute(
        { productId: 'nonexistent', quantity: 1 },
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('uses optimistic locking (version mismatch → retry)', async () => {
      const mockProduct = {
        id: 'prod_test_123',
        name: 'Test',
        price: 9999,
        category: 'test',
        stockCount: 10,
      };

      // Initial cart
      const initialCart = {
        id: 'cart_123',
        userId: 'test-user',
        items: [{ productId: mockProduct.id, quantity: 1, price: mockProduct.price }],
        total: 9999,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Updated cart after concurrent modification
      const updatedCart = {
        ...initialCart,
        version: 999,
      };

      // Final cart after successful update
      const finalCart = {
        ...updatedCart,
        items: [
          { productId: mockProduct.id, quantity: 2, price: mockProduct.price },
        ],
        total: 19998,
        version: 1000,
      };

      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct);
      vi.mocked(prisma.cart.findUnique)
        .mockResolvedValueOnce(initialCart)
        .mockResolvedValueOnce(updatedCart);

      // First update fails with version mismatch (P2024)
      const prismaError = new Error('Optimistic locking failed');
      (prismaError as any).code = 'P2024';
      vi.mocked(prisma.cart.update).mockRejectedValueOnce(prismaError);

      // Second update succeeds
      vi.mocked(prisma.cart.update).mockResolvedValueOnce(finalCart);

      const result = await addToCart.execute(
        { productId: mockProduct.id, quantity: 1 },
        'test-user'
      );

      // Should succeed after retry
      expect(result.success).toBe(true);
      expect((result.data as any).cart.version).toBeGreaterThan(1);
    });

    it('includes Langfuse tracing metadata', async () => {
      const mockProduct = {
        id: 'prod_test_123',
        name: 'Test',
        price: 9999,
        category: 'test',
        stockCount: 10,
      };

      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct);
      vi.mocked(prisma.cart.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.cart.create).mockResolvedValue({
        id: 'cart_123',
        userId: 'test-user',
        items: [{ productId: mockProduct.id, quantity: 1, price: mockProduct.price }],
        total: 9999,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await addToCart.execute(
        { productId: mockProduct.id, quantity: 1 },
        'test-user'
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.traced).toBe(true);
      expect(result.metadata?.userId).toBe('test-user');
    });

    it('handles errors gracefully', async () => {
      vi.mocked(prisma.product.findUnique).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await addToCart.execute(
        { productId: 'prod_123', quantity: 1 },
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.metadata?.traced).toBe(true);
    });

    it('updates existing cart item quantity', async () => {
      const mockProduct = {
        id: 'prod_test_123',
        name: 'Test Headphones',
        price: 9999,
        category: 'headphones',
        stockCount: 10,
      };

      const existingCart = {
        id: 'cart_123',
        userId: 'test-user',
        items: [{ productId: mockProduct.id, quantity: 1, price: mockProduct.price }],
        total: 9999,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedCart = {
        ...existingCart,
        items: [{ productId: mockProduct.id, quantity: 2, price: mockProduct.price }],
        total: 19998,
        version: 2,
      };

      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct);
      vi.mocked(prisma.cart.findUnique).mockResolvedValue(existingCart);
      vi.mocked(prisma.cart.update).mockResolvedValue(updatedCart);

      const result = await addToCart.execute(
        { productId: mockProduct.id, quantity: 1 },
        'test-user'
      );

      expect(result.success).toBe(true);
      expect((result.data as any).cart.items[0].quantity).toBe(2);
      expect((result.data as any).cart.total).toBe(19998);
    });
  });
});
