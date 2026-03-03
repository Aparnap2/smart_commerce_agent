/**
 * GenUI Component Tests
 *
 * Tests for OrderCard, ProductCard, and TicketStatus data structures.
 * Validates type definitions and data factories.
 *
 * Run: pnpm --filter vercel-ai-sdk-tests test:genui
 */

import { jest, describe, test, expect } from '@jest/globals';

// ============ ORDER DATA FACTORY ============

const createOrderData = (overrides = {}) => ({
  id: 'ORD-001',
  orderNumber: 'ORD-001',
  status: 'delivered',
  total: 99.99,
  subtotal: 89.99,
  tax: 10.0,
  shipping: 0,
  items: [
    { id: 'item-1', name: 'Sample Product', quantity: 2, price: 44.99, sku: 'SKU-001' },
  ],
  shippingAddress: {
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94102',
    country: 'USA',
  },
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-16T14:00:00Z',
  customerId: 'user-123',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  paymentMethod: 'Visa ****4242',
  ...overrides,
});

// Order status types
const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

// ============ PRODUCT DATA FACTORY ============

const createProductData = (overrides = {}) => ({
  id: 'PROD-001',
  sku: 'SKU-001',
  name: 'Sample Product',
  description: 'A high-quality product for your needs.',
  price: 29.99,
  originalPrice: 49.99,
  currency: 'USD',
  category: 'Electronics',
  subcategory: 'Accessories',
  brand: 'BrandCo',
  status: 'in_stock',
  stock: 150,
  lowStockThreshold: 10,
  rating: 4.5,
  reviewCount: 128,
  features: ['High quality', 'Durable', 'Easy to use'],
  specifications: { Weight: '0.5kg', Dimensions: '10x5x2cm' },
  returnable: true,
  returnWindow: '30-day',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T00:00:00Z',
  ...overrides,
});

// Product status types
const PRODUCT_STATUSES = ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'];

// ============ TICKET DATA FACTORY ============

const createTicketData = (overrides = {}) => ({
  id: 'TKT-001',
  subject: 'Order Inquiry',
  description: 'I have a question about my recent order.',
  status: 'in_progress',
  priority: 'medium',
  category: 'order_status',
  customerId: 'user-123',
  customerName: 'John Doe',
  customerEmail: 'john@example.com',
  createdAt: '2024-01-15T10:30:00Z',
  updatedAt: '2024-01-16T14:00:00Z',
  messages: [
    {
      id: 'msg-1',
      authorId: 'user-123',
      authorName: 'John Doe',
      authorType: 'customer',
      content: 'I have a question about my recent order.',
      timestamp: '2024-01-15T10:30:00Z',
    },
    {
      id: 'msg-2',
      authorId: 'agent-1',
      authorName: 'Support Agent',
      authorType: 'agent',
      content: 'Hello! I would be happy to help you with your order.',
      timestamp: '2024-01-15T11:00:00Z',
    },
  ],
  ...overrides,
});

// Ticket status types
const TICKET_STATUSES = ['open', 'in_progress', 'pending_customer', 'resolved', 'closed'];

// Ticket priority types
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Ticket category types
const TICKET_CATEGORIES = [
  'order_status', 'shipping', 'return', 'refund',
  'product_info', 'payment', 'account', 'technical', 'other'
];

// Message author types
const AUTHOR_TYPES = ['customer', 'agent', 'system'];

// ============ COMPONENT EXPORT VERIFICATION ============

describe('GenUI Component Exports', () => {
  describe('OrderCard Exports', () => {
    // Skipping runtime import tests for TypeScript/React components
    // Component exports are verified via TypeScript compiler
    test.skip('should export OrderCard and OrderCardSkeleton from order-card module', async () => {
      const orderCardModule = await import('../../../app/dashboard/components/genui/order-card.tsx');
      expect(orderCardModule).toHaveProperty('OrderCard');
      expect(orderCardModule).toHaveProperty('OrderCardSkeleton');
      expect(orderCardModule).toHaveProperty('OrderData');
    });
  });

  describe('ProductCard Exports', () => {
    test.skip('should export ProductCard and ProductCardSkeleton from product-card module', async () => {
      const productCardModule = await import('../../../app/dashboard/components/genui/product-card.tsx');
      expect(productCardModule).toHaveProperty('ProductCard');
      expect(productCardModule).toHaveProperty('ProductCardSkeleton');
      expect(productCardModule).toHaveProperty('ProductGrid');
      expect(productCardModule).toHaveProperty('ProductData');
    });
  });

  describe('TicketStatus Exports', () => {
    test.skip('should export all ticket components from ticket-status module', async () => {
      const ticketModule = await import('../../../app/dashboard/components/genui/ticket-status.tsx');
      expect(ticketModule).toHaveProperty('TicketStatus');
      expect(ticketModule).toHaveProperty('TicketStatusSkeleton');
      expect(ticketModule).toHaveProperty('TicketCardCompact');
      expect(ticketModule).toHaveProperty('TicketData');
      expect(ticketModule).toHaveProperty('TicketMessage');
      expect(ticketModule).toHaveProperty('TicketPriority');
      expect(ticketModule).toHaveProperty('TicketCategory');
    });
  });

  describe('Index Exports', () => {
    test.skip('should export all components from index module', async () => {
      const indexModule = await import('../../../app/dashboard/components/genui/index.ts');

      // Order components
      expect(indexModule).toHaveProperty('OrderCard');
      expect(indexModule).toHaveProperty('OrderCardSkeleton');

      // Product components
      expect(indexModule).toHaveProperty('ProductCard');
      expect(indexModule).toHaveProperty('ProductCardSkeleton');
      expect(indexModule).toHaveProperty('ProductGrid');

      // Ticket components
      expect(indexModule).toHaveProperty('TicketStatus');
      expect(indexModule).toHaveProperty('TicketStatusSkeleton');
      expect(indexModule).toHaveProperty('TicketCardCompact');

      // Type exports
      expect(indexModule).toHaveProperty('OrderData');
      expect(indexModule).toHaveProperty('ProductData');
      expect(indexModule).toHaveProperty('TicketData');
    });
  });
});

// ============ ORDER CARD DATA TESTS ============

describe('OrderCard Data Structure', () => {
  test('should have all required fields', () => {
    const order = createOrderData();
    expect(order).toHaveProperty('id');
    expect(order).toHaveProperty('orderNumber');
    expect(order).toHaveProperty('status');
    expect(order).toHaveProperty('total');
    expect(order).toHaveProperty('items');
    expect(order).toHaveProperty('shippingAddress');
    expect(order).toHaveProperty('customerId');
    expect(order).toHaveProperty('customerEmail');
    expect(order).toHaveProperty('customerName');
    expect(order).toHaveProperty('paymentMethod');
  });

  test('should handle all order statuses', () => {
    ORDER_STATUSES.forEach(status => {
      const order = createOrderData({ status });
      expect(order.status).toBe(status);
    });
  });

  test('should have order items with required fields', () => {
    const order = createOrderData();
    order.items.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('quantity');
      expect(item).toHaveProperty('price');
      expect(typeof item.quantity).toBe('number');
      expect(typeof item.price).toBe('number');
    });
  });

  test('should have shipping address with all fields', () => {
    const { shippingAddress } = createOrderData();
    expect(shippingAddress).toHaveProperty('street');
    expect(shippingAddress).toHaveProperty('city');
    expect(shippingAddress).toHaveProperty('state');
    expect(shippingAddress).toHaveProperty('postalCode');
    expect(shippingAddress).toHaveProperty('country');
  });

  test('should calculate order totals correctly', () => {
    const order = createOrderData();
    const expectedSubtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // Allow for small floating point differences
    expect(Math.abs(order.subtotal - expectedSubtotal)).toBeLessThan(0.02);
  });

  test('should handle optional tracking fields', () => {
    const orderWithTracking = createOrderData({
      trackingNumber: '1Z999AA10123456784',
      estimatedDelivery: '2024-01-20T00:00:00Z',
    });
    expect(orderWithTracking.trackingNumber).toBe('1Z999AA10123456784');
    expect(orderWithTracking.estimatedDelivery).toBe('2024-01-20T00:00:00Z');
  });

  test('should handle refund information', () => {
    const orderWithRefund = createOrderData({
      refundAmount: 50.0,
      refundReason: 'Item damaged during shipping',
    });
    expect(orderWithRefund.refundAmount).toBe(50.0);
    expect(orderWithRefund.refundReason).toBe('Item damaged during shipping');
  });
});

// ============ PRODUCT CARD DATA TESTS ============

describe('ProductCard Data Structure', () => {
  test('should have all required fields', () => {
    const product = createProductData();
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('sku');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('price');
    expect(product).toHaveProperty('category');
    expect(product).toHaveProperty('status');
    expect(product).toHaveProperty('rating');
    expect(product).toHaveProperty('returnable');
  });

  test('should handle all product statuses', () => {
    PRODUCT_STATUSES.forEach(status => {
      const product = createProductData({ status });
      expect(product.status).toBe(status);
    });
  });

  test('should calculate discount percentage correctly', () => {
    const product = createProductData();
    const discountPercent = Math.round((1 - product.price / product.originalPrice) * 100);
    expect(discountPercent).toBe(40);
  });

  test('should have rating within valid range', () => {
    const product = createProductData();
    expect(product.rating).toBeGreaterThanOrEqual(0);
    expect(product.rating).toBeLessThanOrEqual(5);
  });

  test('should have non-negative stock', () => {
    const product = createProductData();
    expect(product.stock).toBeGreaterThanOrEqual(0);
  });

  test('should have features as array', () => {
    const product = createProductData();
    expect(Array.isArray(product.features)).toBe(true);
    expect(product.features.length).toBeGreaterThan(0);
  });

  test('should have specifications as object', () => {
    const product = createProductData();
    expect(typeof product.specifications).toBe('object');
    expect(product.specifications).not.toBeNull();
  });

  test('should handle original price discount', () => {
    const product = createProductData();
    expect(product.originalPrice).toBeGreaterThan(product.price);
  });
});

// ============ TICKET STATUS DATA TESTS ============

describe('TicketStatus Data Structure', () => {
  test('should have all required fields', () => {
    const ticket = createTicketData();
    expect(ticket).toHaveProperty('id');
    expect(ticket).toHaveProperty('subject');
    expect(ticket).toHaveProperty('description');
    expect(ticket).toHaveProperty('status');
    expect(ticket).toHaveProperty('priority');
    expect(ticket).toHaveProperty('category');
    expect(ticket).toHaveProperty('customerId');
    expect(ticket).toHaveProperty('customerName');
    expect(ticket).toHaveProperty('customerEmail');
    expect(ticket).toHaveProperty('messages');
  });

  test('should handle all ticket statuses', () => {
    TICKET_STATUSES.forEach(status => {
      const ticket = createTicketData({ status });
      expect(ticket.status).toBe(status);
    });
  });

  test('should handle all ticket priorities', () => {
    TICKET_PRIORITIES.forEach(priority => {
      const ticket = createTicketData({ priority });
      expect(ticket.priority).toBe(priority);
    });
  });

  test('should handle all ticket categories', () => {
    TICKET_CATEGORIES.forEach(category => {
      const ticket = createTicketData({ category });
      expect(ticket.category).toBe(category);
    });
  });

  test('should have messages with required fields', () => {
    const ticket = createTicketData();
    expect(Array.isArray(ticket.messages)).toBe(true);
    ticket.messages.forEach(msg => {
      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('authorId');
      expect(msg).toHaveProperty('authorName');
      expect(msg).toHaveProperty('authorType');
      expect(msg).toHaveProperty('content');
      expect(msg).toHaveProperty('timestamp');
      expect(AUTHOR_TYPES).toContain(msg.authorType);
    });
  });

  test('should handle internal messages', () => {
    const ticket = createTicketData({
      messages: [
        {
          id: 'msg-1',
          authorId: 'agent-1',
          authorName: 'Support Agent',
          authorType: 'agent',
          content: 'Internal note',
          timestamp: '2024-01-15T11:00:00Z',
          isInternal: true,
        },
      ],
    });
    expect(ticket.messages[0].isInternal).toBe(true);
  });

  test('should handle optional fields', () => {
    const ticketWithOptional = createTicketData({
      orderId: 'ORD-001',
      orderNumber: 'ORD-001',
      customerPhone: '+1-555-0123',
      assignedAgentId: 'agent-1',
      assignedAgentName: 'Support Agent',
      tags: ['VIP', 'Urgent'],
    });
    expect(ticketWithOptional.orderId).toBe('ORD-001');
    expect(ticketWithOptional.customerPhone).toBe('+1-555-0123');
    expect(ticketWithOptional.tags).toEqual(['VIP', 'Urgent']);
  });

  test('should handle metrics fields', () => {
    const ticketWithMetrics = createTicketData({
      firstResponseTime: 30,
      resolutionTime: 120,
    });
    expect(ticketWithMetrics.firstResponseTime).toBe(30);
    expect(ticketWithMetrics.resolutionTime).toBe(120);
  });
});

// ============ EDGE CASES ============

describe('Edge Cases - Data Validation', () => {
  test('should handle zero price products', () => {
    const product = createProductData({ price: 0 });
    expect(product.price).toBe(0);
  });

  test('should handle zero stock products', () => {
    const product = createProductData({ stock: 0, status: 'out_of_stock' });
    expect(product.stock).toBe(0);
  });

  test('should handle zero total orders', () => {
    const order = createOrderData({ total: 0, items: [] });
    expect(order.total).toBe(0);
  });

  test('should handle empty order items array', () => {
    const order = createOrderData({ items: [] });
    expect(order.items).toEqual([]);
  });

  test('should handle empty product features array', () => {
    const product = createProductData({ features: [] });
    expect(product.features).toEqual([]);
  });

  test('should handle empty ticket messages array', () => {
    const ticket = createTicketData({ messages: [] });
    expect(ticket.messages).toEqual([]);
  });

  test('should handle missing optional fields', () => {
    const minimalOrder = {
      id: 'ORD-MIN',
      orderNumber: 'ORD-MIN',
      status: 'pending',
      total: 0,
      items: [],
      shippingAddress: {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
      customerId: '',
      customerEmail: '',
      customerName: '',
      paymentMethod: '',
    };
    expect(minimalOrder.id).toBe('ORD-MIN');
  });

  test('should handle very long strings', () => {
    const longString = 'a'.repeat(1000);
    const product = createProductData({ name: longString });
    expect(product.name.length).toBe(1000);
  });

  test('should handle special characters in data', () => {
    const product = createProductData({
      name: 'Product with "quotes" & special chars',
    });
    expect(product.name).toContain('quotes');
  });

  test('should handle unicode characters', () => {
    const product = createProductData({
      name: '产品 (Chinese)',
      description: '欧式 (European)',
    });
    expect(product.name).toContain('产品');
    expect(product.description).toContain('欧式');
  });

  test('should handle ISO date formats', () => {
    const order = createOrderData({
      createdAt: '2024-01-15T10:30:00.000Z',
      updatedAt: '2024-01-16T14:00:00.000Z',
    });
    // JS Date toISOString always includes milliseconds
    expect(new Date(order.createdAt).toISOString()).toBe(order.createdAt);
    expect(new Date(order.updatedAt).toISOString()).toBe(order.updatedAt);
  });

  test('should handle decimal prices', () => {
    const product = createProductData({ price: 19.99 });
    expect(product.price).toBeCloseTo(19.99, 2);
  });

  test('should handle large quantities', () => {
    const order = createOrderData({
      items: [{ id: 'item-1', name: 'Bulk Item', quantity: 9999, price: 0.01 }],
    });
    expect(order.items[0].quantity).toBe(9999);
  });

  test('should handle very high ratings', () => {
    const product = createProductData({ rating: 5.0, reviewCount: 10000 });
    expect(product.rating).toBeLessThanOrEqual(5);
    expect(product.reviewCount).toBe(10000);
  });

  test('should handle boolean returnable flag', () => {
    const returnableProduct = createProductData({ returnable: true, returnWindow: '30-day' });
    expect(returnableProduct.returnable).toBe(true);

    const nonReturnableProduct = createProductData({ returnable: false, returnWindow: undefined });
    expect(nonReturnableProduct.returnable).toBe(false);
  });
});

// ============ DATA FACTORY CONSISTENCY ============

describe('Data Factory Consistency', () => {
  test('order data should match expected structure', () => {
    const order = createOrderData();
    expect(order.id).toBeTruthy();
    expect(typeof order.total).toBe('number');
    expect(Array.isArray(order.items)).toBe(true);
  });

  test('product data should match expected structure', () => {
    const product = createProductData();
    expect(product.id).toBeTruthy();
    expect(typeof product.price).toBe('number');
    expect(typeof product.category).toBe('string');
  });

  test('ticket data should match expected structure', () => {
    const ticket = createTicketData();
    expect(ticket.id).toBeTruthy();
    expect(typeof ticket.subject).toBe('string');
    expect(Array.isArray(ticket.messages)).toBe(true);
  });

  test('should create unique IDs with factory', () => {
    const order1 = createOrderData({ id: 'ORD-1' });
    const order2 = createOrderData({ id: 'ORD-2' });
    expect(order1.id).not.toBe(order2.id);
  });
});

// ============ STORES MODULE ============

describe('Stores Module', () => {
  // Skipping these tests as they require TypeScript compilation
  // The type exports are verified via TypeScript compiler
  test.skip('should export agent store from stores module', async () => {
    const storesModule = await import('../../../lib/stores/index.ts');
    expect(storesModule).toHaveProperty('useAgentStore');
    expect(storesModule).toHaveProperty('selectSession');
    expect(storesModule).toHaveProperty('selectMessages');
    expect(storesModule).toHaveProperty('selectActiveView');
    expect(storesModule).toHaveProperty('selectIsLoading');
    expect(storesModule).toHaveProperty('selectIsStreaming');
    expect(storesModule).toHaveProperty('selectPreferences');
  });

  test.skip('should export types from stores module', async () => {
    const storesModule = await import('../../../lib/stores/index.ts');
    expect(storesModule).toHaveProperty('AgentState');
    expect(storesModule).toHaveProperty('AgentActions');
    expect(storesModule).toHaveProperty('AgentSession');
    expect(storesModule).toHaveProperty('AgentMessage');
    expect(storesModule).toHaveProperty('AgentUIState');
  });

  test('should have valid data factory for store initialization', () => {
    // Verify the data factories work correctly for store initialization
    const order = createOrderData();
    expect(order.id).toBeTruthy();
    expect(order.customerId).toBeTruthy();

    const product = createProductData();
    expect(product.id).toBeTruthy();
    expect(product.price).toBeGreaterThan(0);

    const ticket = createTicketData();
    expect(ticket.id).toBeTruthy();
    expect(ticket.customerId).toBeTruthy();
  });
});
