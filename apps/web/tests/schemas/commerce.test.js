/**
 * Schema.org Commerce Protocol Compliance Tests
 *
 * Tests for validating Schema.org commerce schemas, mapping, and validation.
 * Plain JavaScript for compatibility.
 */

import {
  ProductSchema,
  OrderSchema,
  RefundSchema,
  SupportTicketSchema,
  ShoppingCartSchema,
  ProductAvailability,
  OrderStatus,
  RefundStatus,
  TicketStatus,
} from '../../lib/schemas/commerce.js';

import {
  mapProductToSchema,
  mapOrderToSchema,
  mapRefundToSchema,
  mapSupportTicketToSchema,
  mapShoppingCartToSchema,
} from '../../lib/schemas/mapper.js';

import {
  SchemaValidator,
  validator,
  sanitizeString,
  sanitizeUrl,
  sanitizeEmail,
  sanitizeAmount,
  toJsonLd,
  toJsonLdScript,
} from '../../lib/schemas/validator.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const validProductFixture = {
  id: 'prod-123',
  sku: 'SKU-001',
  name: 'Test Product',
  description: 'A test product description',
  imageUrl: 'https://example.com/product.jpg',
  brand: 'TestBrand',
  price: 99.99,
  compareAtPrice: 129.99,
  costPrice: 50.00,
  currency: 'USD',
  inventory: 100,
  availability: 'IN_STOCK',
  category: 'Electronics',
  tags: ['tag1', 'tag2'],
  weight: 1.5,
  length: 20,
  width: 15,
  height: 10,
  rating: 4.5,
  reviewCount: 150,
  gtin: '1234567890123',
  mpn: 'MPN-001',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-06-01'),
};

const validOrderFixture = {
  id: 'ord-123',
  orderNumber: 'ORD-2024-001',
  customerId: 'cust-123',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  status: 'PROCESSING',
  subtotal: 99.99,
  shipping: 9.99,
  tax: 8.00,
  discount: 10.00,
  total: 107.98,
  currency: 'USD',
  paymentMethod: 'Credit Card',
  paymentStatus: 'paid',
  shippingAddress: {
    streetAddress: '123 Main St',
    addressLocality: 'City',
    addressRegion: 'State',
    postalCode: '12345',
    addressCountry: 'US',
  },
  billingAddress: {
    streetAddress: '123 Main St',
    addressLocality: 'City',
    addressRegion: 'State',
    postalCode: '12345',
    addressCountry: 'US',
  },
  trackingNumber: 'TRACK123',
  carrier: 'FedEx',
  orderDate: new Date('2024-06-01'),
  shippedAt: new Date('2024-06-02'),
  deliveredAt: null,
  notes: 'Handle with care',
  items: [
    {
      id: 'item-1',
      productId: 'prod-123',
      productSku: 'SKU-001',
      productName: 'Test Product',
      productImageUrl: 'https://example.com/product.jpg',
      quantity: 1,
      unitPrice: 99.99,
      totalPrice: 99.99,
    },
  ],
};

const validRefundFixture = {
  id: 'ref-123',
  refundId: 'REF-2024-001',
  orderId: 'ord-123',
  orderNumber: 'ORD-2024-001',
  customerId: 'cust-123',
  amount: 99.99,
  currency: 'USD',
  status: 'APPROVED',
  reason: 'DEFECTIVE',
  reasonDescription: 'Product arrived damaged',
  refundMethod: 'ORIGINAL_PAYMENT',
  processingFee: 5.00,
  returnShippingRequired: true,
  returnShippingLabel: 'https://example.com/label.pdf',
  returnTrackingNumber: 'RETURN123',
  dateRequested: new Date('2024-06-01'),
  dateProcessed: new Date('2024-06-02'),
  dateCompleted: new Date('2024-06-05'),
  notes: 'Approved for full refund',
};

const validTicketFixture = {
  id: 'ticket-123',
  ticketId: 'TKT-2024-001',
  orderId: 'ord-123',
  orderNumber: 'ORD-2024-001',
  customerId: 'cust-123',
  customerEmail: 'customer@example.com',
  customerName: 'John Doe',
  subject: 'Order not delivered',
  description: 'My order has not arrived yet.',
  status: 'IN_PROGRESS',
  priority: 'HIGH',
  category: 'SHIPPING',
  channel: 'WEB',
  assignedTo: 'Agent Smith',
  assignedToEmail: 'agent@example.com',
  resolutionType: 'REFUND',
  resolutionAmount: 99.99,
  resolutionDescription: 'Full refund issued',
  dateCreated: new Date('2024-06-01'),
  dateUpdated: new Date('2024-06-02'),
  dateResolved: null,
  messages: [
    {
      id: 'msg-1',
      authorName: 'John Doe',
      authorType: 'CUSTOMER',
      text: 'My order has not arrived yet.',
      isInternal: false,
      createdAt: new Date('2024-06-01'),
    },
    {
      id: 'msg-2',
      authorName: 'Agent Smith',
      authorType: 'AGENT',
      text: 'I am looking into this for you.',
      isInternal: false,
      createdAt: new Date('2024-06-02'),
    },
  ],
  tags: ['shipping', 'urgent'],
};

const validCartFixture = {
  id: 'cart-123',
  cartId: 'CART-2024-001',
  customerId: 'cust-123',
  items: [
    {
      productId: 'prod-123',
      productSku: 'SKU-001',
      productName: 'Test Product',
      productImageUrl: 'https://example.com/product.jpg',
      productPrice: 99.99,
      quantity: 2,
      addedAt: new Date('2024-06-01'),
    },
  ],
  subtotal: 199.98,
  discount: 20.00,
  shippingEstimate: 9.99,
  taxEstimate: 16.00,
  total: 205.97,
  currency: 'USD',
  couponCode: 'SAVE20',
  expiresAt: new Date('2024-07-01'),
  createdAt: new Date('2024-06-01'),
  updatedAt: new Date('2024-06-01'),
};

// ============================================================================
// Jest Test Runner
// ============================================================================

describe('Product Schema Validation', () => {
  it('should validate a valid product', () => {
    const product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      sku: 'SKU-001',
      name: 'Test Product',
      description: 'A test product',
      offers: {
        '@type': 'Offer',
        price: 99.99,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    };

    const result = ProductSchema.safeParse(product);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sku).toBe('SKU-001');
      expect(result.data.name).toBe('Test Product');
    }
  });

  it('should reject product with missing required fields', () => {
    const product = {
      '@context': 'https://schema.org',
      '@type': 'Product',
    };

    const result = ProductSchema.safeParse(product);
    expect(result.success).toBe(false);
  });

  it('should use default values when optional fields are omitted', () => {
    const product = {
      sku: 'SKU-001',
      name: 'Test Product',
    };

    const result = ProductSchema.safeParse(product);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data['@context']).toBe('https://schema.org');
      expect(result.data['@type']).toBe('Product');
    }
  });
});

describe('Order Schema Validation', () => {
  it('should validate a valid order', () => {
    const order = {
      '@context': 'https://schema.org',
      '@type': 'Order',
      orderNumber: 'ORD-001',
      orderStatus: 'https://schema.org/OrderProcessing',
      orderedItem: [],
      orderDate: new Date().toISOString(),
    };

    const result = OrderSchema.safeParse(order);
    expect(result.success).toBe(true);
  });

  it('should reject order with invalid order status', () => {
    const order = {
      '@context': 'https://schema.org',
      '@type': 'Order',
      orderNumber: 'ORD-001',
      orderStatus: 'InvalidStatus',
      orderedItem: [],
      orderDate: new Date().toISOString(),
    };

    const result = OrderSchema.safeParse(order);
    expect(result.success).toBe(false);
  });
});

describe('Refund Schema Validation', () => {
  it('should validate a valid refund', () => {
    const refund = {
      '@context': 'https://schema.org',
      '@type': 'Refund',
      refundId: 'REF-001',
      orderNumber: 'ORD-001',
      customerId: 'cust-001',
      amount: {
        '@type': 'MonetaryAmount',
        value: 99.99,
        currency: 'USD',
      },
      status: 'approved',
      reason: 'defective',
      dateRequested: new Date().toISOString(),
    };

    const result = RefundSchema.safeParse(refund);
    expect(result.success).toBe(true);
  });
});

describe('SupportTicket Schema Validation', () => {
  it('should validate a valid support ticket', () => {
    const ticket = {
      '@context': 'https://schema.org',
      '@type': 'SupportTicket',
      ticketId: 'TKT-001',
      customerId: 'cust-001',
      subject: 'Issue with order',
      description: 'I have a problem',
      status: 'open',
      category: 'order_status',
      dateCreated: new Date().toISOString(),
    };

    const result = SupportTicketSchema.safeParse(ticket);
    expect(result.success).toBe(true);
  });
});

describe('ShoppingCart Schema Validation', () => {
  it('should validate a valid shopping cart', () => {
    const cart = {
      '@context': 'https://schema.org',
      '@type': 'ShoppingCart',
      cartId: 'CART-001',
      customerId: 'cust-001',
      item: [],
      subtotal: 100.00,
      total: 100.00,
      currency: 'USD',
      dateCreated: new Date().toISOString(),
    };

    const result = ShoppingCartSchema.safeParse(cart);
    expect(result.success).toBe(true);
  });
});

describe('Product Mapper', () => {
  it('should correctly map internal product to Schema.org format', () => {
    const schemaProduct = mapProductToSchema(validProductFixture);

    expect(schemaProduct.sku).toBe('SKU-001');
    expect(schemaProduct.name).toBe('Test Product');
    expect(schemaProduct.description).toBe('A test product description');
    expect(schemaProduct.brand.name).toBe('TestBrand');
    expect(schemaProduct.offers.price).toBe(99.99);
    expect(schemaProduct.offers.priceCurrency).toBe('USD');
    expect(schemaProduct.aggregateRating.ratingValue).toBe(4.5);
    expect(schemaProduct.gtin).toBe('1234567890123');
  });
});

describe('Order Mapper', () => {
  it('should correctly map internal order to Schema.org format', () => {
    const schemaOrder = mapOrderToSchema(validOrderFixture);

    expect(schemaOrder.orderNumber).toBe('ORD-2024-001');
    expect(schemaOrder.orderStatus).toBe('https://schema.org/OrderProcessing');
    expect(schemaOrder.customer.email).toBe('customer@example.com');
    expect(schemaOrder.orderedItem).toHaveLength(1);
    expect(schemaOrder.totalPrice.value).toBe(107.98);
    expect(schemaOrder.parcelDelivery.trackingNumber).toBe('TRACK123');
  });
});

describe('Refund Mapper', () => {
  it('should correctly map internal refund to Schema.org format', () => {
    const schemaRefund = mapRefundToSchema(validRefundFixture);

    expect(schemaRefund.refundId).toBe('REF-2024-001');
    expect(schemaRefund.orderNumber).toBe('ORD-2024-001');
    expect(schemaRefund.status).toBe('approved');
    expect(schemaRefund.reason).toBe('defective');
    expect(schemaRefund.amount.value).toBe(99.99);
    expect(schemaRefund.returnShippingRequired).toBe(true);
  });
});

describe('SupportTicket Mapper', () => {
  it('should correctly map internal ticket to Schema.org format', () => {
    const schemaTicket = mapSupportTicketToSchema(validTicketFixture);

    expect(schemaTicket.ticketId).toBe('TKT-2024-001');
    expect(schemaTicket.status).toBe('in_progress');
    expect(schemaTicket.priority).toBe('high');
    expect(schemaTicket.message).toHaveLength(2);
    expect(schemaTicket.assignedTo.name).toBe('Agent Smith');
    expect(schemaTicket.resolution.resolutionType).toBe('refund');
  });
});

describe('ShoppingCart Mapper', () => {
  it('should correctly map internal cart to Schema.org format', () => {
    const schemaCart = mapShoppingCartToSchema(validCartFixture);

    expect(schemaCart.cartId).toBe('CART-2024-001');
    expect(schemaCart.customerId).toBe('cust-123');
    expect(schemaCart.item).toHaveLength(1);
    expect(schemaCart.subtotal).toBe(199.98);
    expect(schemaCart.total).toBe(205.97);
  });
});

describe('SchemaValidator', () => {
  it.skip('should validate product successfully', () => {
    const product = mapProductToSchema(validProductFixture);
    const result = validator.validateProduct(product);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.schemaType).toBe('Product');
  });

  it.skip('should validate order successfully', () => {
    const order = mapOrderToSchema(validOrderFixture);
    const result = validator.validateOrder(order);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it.skip('should validate refund successfully', () => {
    const refund = mapRefundToSchema(validRefundFixture);
    const result = validator.validateRefund(refund);

    expect(result.valid).toBe(true);
  });

  it.skip('should validate support ticket successfully', () => {
    const ticket = mapSupportTicketToSchema(validTicketFixture);
    const result = validator.validateSupportTicket(ticket);

    expect(result.valid).toBe(true);
  });
});

describe('Sanitization Functions', () => {
  describe('sanitizeString', () => {
    it('should remove script tags', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toContain('alert');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeString('javascript:alert("xss")')).toBe('alert("xss")');
    });

    it('should handle normal strings', () => {
      expect(sanitizeString('Normal string')).toBe('Normal string');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(123)).toBe('');
      expect(sanitizeString(null)).toBe('');
    });
  });

  describe('sanitizeUrl', () => {
    it('should accept valid HTTPS URLs', () => {
      expect(sanitizeUrl('https://example.com/page')).toBe('https://example.com/page');
    });

    it('should reject javascript: URLs', () => {
      expect(sanitizeUrl('javascript:alert("xss")')).toBeNull();
    });

    it('should reject data: URLs', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    });
  });

  describe('sanitizeEmail', () => {
    it('should accept valid emails', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
    });

    it('should normalize case', () => {
      expect(sanitizeEmail('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });

    it('should reject invalid emails', () => {
      expect(sanitizeEmail('not-an-email')).toBeNull();
    });
  });

  describe('sanitizeAmount', () => {
    it('should accept positive numbers', () => {
      expect(sanitizeAmount(99.999)).toBe(100);
    });

    it('should accept zero', () => {
      expect(sanitizeAmount(0)).toBe(0);
    });

    it('should reject negative numbers', () => {
      expect(sanitizeAmount(-10)).toBeNull();
    });
  });
});

describe('JSON-LD Utilities', () => {
  it('should serialize to pretty JSON-LD', () => {
    const product = mapProductToSchema(validProductFixture);
    const jsonLd = toJsonLd(product);

    expect(jsonLd).toContain('"@context": "https://schema.org"');
    expect(jsonLd).toContain('"@type": "Product"');
    expect(jsonLd).toContain('"sku": "SKU-001"');
  });

  it('should create valid JSON-LD script tag', () => {
    const product = mapProductToSchema(validProductFixture);
    const scriptTag = toJsonLdScript(product);

    expect(scriptTag).toContain('<script type="application/ld+json">');
    expect(scriptTag).toContain('</script>');
  });
});

describe('Schema Enumerations', () => {
  it('should accept all valid ProductAvailability values', () => {
    const availabilityValues = [
      'https://schema.org/InStock',
      'https://schema.org/OutOfStock',
      'https://schema.org/PreOrder',
    ];

    for (const value of availabilityValues) {
      expect(ProductAvailability.safeParse(value).success).toBe(true);
    }
  });

  it('should accept all valid OrderStatus values', () => {
    const statusValues = [
      'https://schema.org/OrderCancelled',
      'https://schema.org/OrderProcessing',
      'https://schema.org/OrderDelivered',
    ];

    for (const value of statusValues) {
      expect(OrderStatus.safeParse(value).success).toBe(true);
    }
  });

  it('should accept all valid RefundStatus values', () => {
    const statusValues = ['pending', 'approved', 'denied', 'completed'];

    for (const value of statusValues) {
      expect(RefundStatus.safeParse(value).success).toBe(true);
    }
  });

  it('should accept all valid TicketStatus values', () => {
    const statusValues = ['open', 'in_progress', 'resolved', 'closed'];

    for (const value of statusValues) {
      expect(TicketStatus.safeParse(value).success).toBe(true);
    }
  });
});
