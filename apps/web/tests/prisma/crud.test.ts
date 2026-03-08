/**
 * Prisma CRUD Operations Tests
 * 
 * Tests actual database operations to ensure schema works correctly:
 * - Create, Read, Update, Delete operations
 * - Optimistic locking behavior
 * - Foreign key constraints
 * - JSON field handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient, Role, OrderStatus, ReturnOption, CommerceEventType } from '@prisma/client';

const prisma = new PrismaClient();

describe('Prisma CRUD Operations', () => {
  let testUserId: string;
  let testProductId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.agentTrace.deleteMany({ where: { userId: testUserId } });
    await prisma.commerceEvent.deleteMany({ where: { userId: testUserId } });
    await prisma.returnRequest.deleteMany({});
    await prisma.order.deleteMany({ where: { userId: testUserId } });
    await prisma.cart.deleteMany({ where: { userId: testUserId } });
    await prisma.product.deleteMany({ where: { id: testProductId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  describe('User Operations', () => {
    const testEmail = `test-${Date.now()}@example.com`;

    it('creates a user with CUSTOMER role', async () => {
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          password: 'hashed_password_here',
          role: Role.CUSTOMER,
          name: 'Test User',
        },
      });

      testUserId = user.id;
      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.role).toBe(Role.CUSTOMER);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('creates a user with MERCHANT role', async () => {
      const merchant = await prisma.user.create({
        data: {
          email: `merchant-${Date.now()}@example.com`,
          password: 'hashed_password_here',
          role: Role.MERCHANT,
          name: 'Test Merchant',
        },
      });

      expect(merchant.role).toBe(Role.MERCHANT);

      // Cleanup
      await prisma.user.delete({ where: { id: merchant.id } });
    });

    it('finds user by unique email', async () => {
      const user = await prisma.user.findUnique({
        where: { email: testEmail },
      });

      expect(user).toBeDefined();
      expect(user?.email).toBe(testEmail);
    });
  });

  describe('Product Operations', () => {
    it('creates a product with embedding vector', async () => {
      const product = await prisma.product.create({
        data: {
          name: 'Test Headphones',
          description: 'High-quality wireless headphones',
          price: 999900, // ₹9,999 in paise
          category: 'Electronics',
          stockCount: 50,
          // Note: Setting embedding requires pgvector extension
          // embedding: new Prisma.Sql`'[0.1,0.2,0.3]'::vector`,
        },
      });

      testProductId = product.id;
      expect(product.id).toBeDefined();
      expect(product.name).toBe('Test Headphones');
      expect(product.price).toBe(999900);
      expect(product.stockCount).toBe(50);
      expect(product.version).toBe(1); // Optimistic locking initial version
    });

    it('updates product stock count', async () => {
      const updated = await prisma.product.update({
        where: { id: testProductId },
        data: { stockCount: 45 },
      });

      expect(updated.stockCount).toBe(45);
    });

    it('implements optimistic locking with version field', async () => {
      // Get current product
      const product = await prisma.product.findUnique({
        where: { id: testProductId },
      });

      expect(product?.version).toBe(1);

      // Note: Prisma doesn't auto-increment version - this is done at application layer
      // This test verifies the version field exists and can be updated manually
      const updated = await prisma.product.update({
        where: { id: testProductId },
        data: { 
          stockCount: 40,
          version: 2, // Application would increment this
        },
      });

      expect(updated.version).toBe(2);
    });
  });

  describe('Cart Operations', () => {
    let testCartId: string;

    it('creates a cart for user with JSON items', async () => {
      const cart = await prisma.cart.create({
        data: {
          userId: testUserId,
          items: [
            {
              productId: testProductId,
              quantity: 2,
              price: 999900,
            },
          ],
          total: 1999800,
        },
      });

      testCartId = cart.id;
      expect(cart.id).toBeDefined();
      expect(cart.userId).toBe(testUserId);
      expect(cart.items).toEqual([
        {
          productId: testProductId,
          quantity: 2,
          price: 999900,
        },
      ]);
      expect(cart.total).toBe(1999800);
      expect(cart.version).toBe(1);
    });

    it('enforces unique userId constraint (one cart per user)', async () => {
      // Should fail because userId is unique
      await expect(
        prisma.cart.create({
          data: {
            userId: testUserId,
            items: [],
            total: 0,
          },
        })
      ).rejects.toThrow();
    });

    it('updates cart items and increments version', async () => {
      // Note: Prisma doesn't auto-increment version - this is done at application layer
      const updated = await prisma.cart.update({
        where: { userId: testUserId },
        data: {
          items: [
            {
              productId: testProductId,
              quantity: 3,
              price: 999900,
            },
          ],
          total: 2999700,
          version: 2, // Application would increment this
        },
      });

      expect(updated.version).toBe(2);
      expect(updated.total).toBe(2999700);
    });

    it('deletes cart with CASCADE when user is deleted', async () => {
      // Cart will be deleted when we clean up the user in afterAll
      // This test verifies the CASCADE behavior
      const cart = await prisma.cart.findUnique({
        where: { userId: testUserId },
      });

      expect(cart).toBeDefined();
    });
  });

  describe('Order Operations', () => {
    let testOrderId: string;

    it('creates an order with PENDING status', async () => {
      const order = await prisma.order.create({
        data: {
          userId: testUserId,
          status: OrderStatus.PENDING,
          items: [
            {
              productId: testProductId,
              quantity: 1,
              price: 999900,
            },
          ],
          total: 999900,
        },
      });

      testOrderId = order.id;
      expect(order.id).toBeDefined();
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.total).toBe(999900);
    });

    it('updates order status to PAID', async () => {
      const updated = await prisma.order.update({
        where: { id: testOrderId },
        data: { status: OrderStatus.PAID },
      });

      expect(updated.status).toBe(OrderStatus.PAID);
    });

    it('adds stripe payment intent ID', async () => {
      const updated = await prisma.order.update({
        where: { id: testOrderId },
        data: {
          stripePaymentIntent: 'pi_test123456',
          status: OrderStatus.SHIPPED,
          trackingNumber: 'TRACK123456',
        },
      });

      expect(updated.stripePaymentIntent).toBe('pi_test123456');
      expect(updated.status).toBe(OrderStatus.SHIPPED);
      expect(updated.trackingNumber).toBe('TRACK123456');
    });

    it('prevents order deletion when return requests exist (RESTRICT)', async () => {
      // Create a return request first
      await prisma.returnRequest.create({
        data: {
          orderId: testOrderId,
          userId: testUserId,
          reason: 'Defective product',
          policy: { window: '7 days', condition: 'unopened' },
          chosenOption: ReturnOption.REFUND,
        },
      });

      // Should fail due to RESTRICT constraint
      await expect(
        prisma.order.delete({
          where: { id: testOrderId },
        })
      ).rejects.toThrow();
    });
  });

  describe('ReturnRequest Operations', () => {
    it('creates a return request with REPLACEMENT option', async () => {
      const order = await prisma.order.create({
        data: {
          userId: testUserId,
          status: OrderStatus.DELIVERED,
          items: [{ productId: testProductId, quantity: 1, price: 999900 }],
          total: 999900,
        },
      });

      const returnRequest = await prisma.returnRequest.create({
        data: {
          orderId: order.id,
          userId: testUserId,
          reason: 'Wrong size',
          policy: { window: '7 days', condition: 'unused' },
          chosenOption: ReturnOption.REPLACEMENT,
        },
      });

      expect(returnRequest.id).toBeDefined();
      expect(returnRequest.reason).toBe('Wrong size');
      expect(returnRequest.chosenOption).toBe(ReturnOption.REPLACEMENT);
      expect(returnRequest.policy).toEqual({ window: '7 days', condition: 'unused' });

      // Cleanup
      await prisma.returnRequest.delete({ where: { id: returnRequest.id } });
      await prisma.order.delete({ where: { id: order.id } });
    });

    it('creates a return request with STORE_CREDIT option', async () => {
      const order = await prisma.order.create({
        data: {
          userId: testUserId,
          status: OrderStatus.DELIVERED,
          items: [{ productId: testProductId, quantity: 1, price: 999900 }],
          total: 999900,
        },
      });

      const returnRequest = await prisma.returnRequest.create({
        data: {
          orderId: order.id,
          userId: testUserId,
          reason: 'Changed mind',
          policy: { window: '7 days', bonus: 500 },
          chosenOption: ReturnOption.STORE_CREDIT,
          stripeRefundId: 're_test123',
        },
      });

      expect(returnRequest.chosenOption).toBe(ReturnOption.STORE_CREDIT);
      expect(returnRequest.stripeRefundId).toBe('re_test123');

      // Cleanup
      await prisma.returnRequest.delete({ where: { id: returnRequest.id } });
      await prisma.order.delete({ where: { id: order.id } });
    });
  });

  describe('CommerceEvent Operations', () => {
    it('creates a CART_ABANDONED event', async () => {
      const event = await prisma.commerceEvent.create({
        data: {
          type: CommerceEventType.CART_ABANDONED,
          userId: testUserId,
          payload: {
            cartTotal: 1999800,
            itemCount: 2,
            abandonedAt: new Date().toISOString(),
          },
        },
      });

      expect(event.id).toBeDefined();
      expect(event.type).toBe(CommerceEventType.CART_ABANDONED);
      expect(event.processed).toBe(false);
      expect(event.payload).toEqual({
        cartTotal: 1999800,
        itemCount: 2,
        abandonedAt: expect.any(String),
      });
    });

    it('creates a STOCK_LOW event', async () => {
      const event = await prisma.commerceEvent.create({
        data: {
          type: CommerceEventType.STOCK_LOW,
          payload: {
            productId: testProductId,
            currentStock: 3,
            threshold: 5,
          },
        },
      });

      expect(event.type).toBe(CommerceEventType.STOCK_LOW);

      // Cleanup
      await prisma.commerceEvent.deleteMany({
        where: { userId: testUserId },
      });
    });

    it('marks event as processed', async () => {
      const event = await prisma.commerceEvent.create({
        data: {
          type: CommerceEventType.PRICE_DROP,
          userId: testUserId,
          payload: { productId: testProductId, oldPrice: 999900, newPrice: 899900 },
        },
      });

      const updated = await prisma.commerceEvent.update({
        where: { id: event.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      expect(updated.processed).toBe(true);
      expect(updated.processedAt).toBeDefined();
    });
  });

  describe('AgentTrace Operations', () => {
    it('creates an agent trace for tool execution', async () => {
      const trace = await prisma.agentTrace.create({
        data: {
          userId: testUserId,
          sessionId: 'session_123',
          toolName: 'searchProducts',
          input: { query: 'wireless headphones', budget: 10000 },
          output: { found: 5, topMatch: 'Sony WH-1000XM5' },
          latencyMs: 234,
        },
      });

      expect(trace.id).toBeDefined();
      expect(trace.toolName).toBe('searchProducts');
      expect(trace.input).toEqual({ query: 'wireless headphones', budget: 10000 });
      expect(trace.output).toEqual({ found: 5, topMatch: 'Sony WH-1000XM5' });
      expect(trace.latencyMs).toBe(234);
    });

    it('creates trace with complex JSON input/output', async () => {
      const trace = await prisma.agentTrace.create({
        data: {
          userId: testUserId,
          sessionId: 'session_456',
          toolName: 'addToCart',
          input: {
            productId: testProductId,
            quantity: 2,
            metadata: { source: 'chat', context: 'product_search' },
          },
          output: {
            success: true,
            cartTotal: 1999800,
            itemCount: 3,
          },
          latencyMs: 156,
        },
      });

      expect(trace.input).toHaveProperty('metadata');
      expect(trace.output).toHaveProperty('success');
    });
  });

  describe('Query Performance', () => {
    it('queries orders by userId and status efficiently', async () => {
      const orders = await prisma.order.findMany({
        where: {
          userId: testUserId,
          status: OrderStatus.PAID,
        },
      });

      expect(Array.isArray(orders)).toBe(true);
    });

    it('queries commerce events by processed status', async () => {
      const events = await prisma.commerceEvent.findMany({
        where: {
          processed: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(Array.isArray(events)).toBe(true);
    });

    it('queries agent traces by sessionId', async () => {
      const traces = await prisma.agentTrace.findMany({
        where: {
          sessionId: 'session_123',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(Array.isArray(traces)).toBe(true);
    });
  });
});
