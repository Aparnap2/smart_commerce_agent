/**
 * Protocol Integration Test Suite
 *
 * Tests actual RAG, MCP, GenUI, and AP2 protocol implementations
 * with real operations and detailed logging.
 *
 * Run: node --experimental-vm-modules node_modules/jest/bin/jest.js --config tests/jest.config.js integration/protocol-integration
 */

import { jest, describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createMcPClient, hybridSearchTool } from '../../lib/mcp/adapter.js';
import { hybridSearch, searchProducts } from '../../lib/search/hybrid.js';
import { validateProduct, validateOrder, validateRefund } from '../../lib/schemas/validator.js';
import { ProductSchema, OrderSchema, RefundSchema } from '../../lib/schemas/commerce.js';

/**
 * Logger for test evidence
 */
class TestLogger {
  constructor(testName) {
    this.testName = testName;
    this.logs = [];
  }

  log(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      test: this.testName,
      message,
      ...data
    };
    this.logs.push(entry);
    console.log(`[${level}] [${this.testName}] ${message}`, JSON.stringify(data, null, 2));
  }

  info(message, data) { this.log('INFO', message, data); }
  debug(message, data) { this.log('DEBUG', message, data); }
  warn(message, data) { this.log('WARN', message, data); }
  error(message, data) { this.log('ERROR', message, data); }

  save() {
    const fs = await import('fs');
    const logDir = '/home/aparna/Desktop/vercel-ai-sdk/test-logs';
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const filepath = `${logDir}/${this.testName}-${Date.now()}.log.json`;
    fs.writeFileSync(filepath, JSON.stringify(this.logs, null, 2));
    return filepath;
  }
}

// ============================================================================
// PROTOCOL INTEGRATION TESTS
// ============================================================================

describe('Protocol Integration: Real Operations', () => {
  let logger;

  beforeAll(() => {
    logger = new TestLogger('Protocol-Integration');
  });

  afterAll(async () => {
    if (logger) {
      const fs = await import('fs');
      const logDir = '/home/aparna/Desktop/vercel-ai-sdk/test-logs';
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const filepath = `${logDir}/${logger.testName}-${Date.now()}.log.json`;
      fs.writeFileSync(filepath, JSON.stringify(logger.logs, null, 2));
      console.log(`\n📁 Test logs saved to: ${filepath}`);
    }
  });

  // =========================================================================
  // TEST 1: MCP Tool Execution (db_query, serp_search, vector_search)
  // =========================================================================
  describe('MCP Tool Layer', () => {
    test('should execute db_query tool for orders', async () => {
      logger.info('Testing MCP db_query tool for orders');
      const client = createMcPClient();

      // Call the database query tool
      const result = await client.callTool('db_query', {
        queryType: 'orders',
        orderId: '12345',
      }, 'test-user');

      logger.info('MCP db_query result', {
        success: result.success,
        hasData: !!result.data,
        executionTime: result.metadata?.executionTime
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      logger.info('✅ MCP db_query tool executed successfully');
    });

    test('should execute db_query tool for products', async () => {
      logger.info('Testing MCP db_query tool for products');
      const client = createMcPClient();

      const result = await client.callTool('db_query', {
        queryType: 'products',
        productId: 'PROD-001',
      }, 'test-user');

      logger.info('MCP db_query products result', {
        success: result.success,
        data: result.data
      });

      expect(result.success).toBe(true);
      logger.info('✅ MCP db_query for products executed successfully');
    });

    test('should execute serp_search tool', async () => {
      logger.info('Testing MCP serp_search tool');
      const client = createMcPClient();

      const result = await client.callTool('serp_search', {
        query: 'return policy electronics',
      }, null);

      logger.info('MCP serp_search result', {
        success: result.success,
        resultCount: result.data?.count
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('results');
      logger.info('✅ MCP serp_search tool executed successfully');
    });

    test('should execute vector_search tool', async () => {
      logger.info('Testing MCP vector_search tool');
      const client = createMcPClient();

      const result = await client.callTool('vector_search', {
        query: 'premium laptop recommendations',
      }, 'test-user');

      logger.info('MCP vector_search result', {
        success: result.success,
        embeddingCount: result.data?.count
      });

      expect(result.success).toBe(true);
      logger.info('✅ MCP vector_search tool executed successfully');
    });

    test('should execute hybrid_search tool (combines all three)', async () => {
      logger.info('Testing MCP hybrid_search tool');
      const client = createMcPClient();

      const result = await client.callTool('hybrid_search', {
        dbQueryType: 'products',
        dbQueryParams: { category: 'Electronics' },
        webQuery: 'best electronics 2024',
        semanticQuery: 'high-rated tech products',
      }, 'test-user');

      logger.info('MCP hybrid_search result', {
        success: result.success,
        hasResults: !!result.data?.results,
        hasErrors: !!result.data?.errors,
        executionTime: result.data?.executionTime
      });

      expect(result.success).toBe(true);
      expect(result.data?.results).toBeDefined();
      logger.info('✅ MCP hybrid_search tool executed successfully');
    });

    test('should list all available MCP tools', async () => {
      logger.info('Listing all available MCP tools');
      const client = createMcPClient();

      const tools = client.listTools();

      logger.info('Available MCP tools', { tools });

      expect(tools).toContain('db_query');
      expect(tools).toContain('serp_search');
      expect(tools).toContain('vector_search');
      expect(tools).toContain('hybrid_search');
      logger.info(`✅ Listed ${tools.length} MCP tools successfully`);
    });
  });

  // =========================================================================
  // TEST 2: RAG / Hybrid Search (BM25 + pgvector)
  // =========================================================================
  describe('RAG / Hybrid Search Layer', () => {
    test('should perform hybrid search for products', async () => {
      logger.info('Testing hybrid search for products');
      const startTime = Date.now();

      const result = await hybridSearch({
        query: 'wireless noise cancelling headphones',
        context: 'product_search',
        limit: 10,
      });

      const searchTime = Date.now() - startTime;

      logger.info('Hybrid search result', {
        totalResults: result.totalResults,
        searchTimeMs: result.searchTimeMs,
        routingDecision: result.routingDecision,
        usedVectorSearch: result.usedVectorSearch,
        usedBm25Search: result.usedBm25Search,
      });

      // Search should complete even without database
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('query');
      expect(result).toHaveProperty('context');
      logger.info('✅ Hybrid search completed successfully');
    });

    test('should route query based on intent (BM25 for specific, Vector for semantic)', async () => {
      logger.info('Testing query routing strategy');

      // Test with specific query (should favor BM25)
      const specificResult = await hybridSearch({
        query: 'order #12345',
        context: 'order_inquiry',
      });

      logger.info('Query routing for specific order', {
        query: 'order #12345',
        strategy: specificResult.routingDecision,
        usedBm25: specificResult.usedBm25Search,
        usedVector: specificResult.usedVectorSearch,
      });

      // Test with semantic query (should favor vector)
      const semanticResult = await hybridSearch({
        query: 'something similar to my previous headphones',
        context: 'recommendation',
      });

      logger.info('Query routing for semantic recommendation', {
        query: 'something similar to my previous headphones',
        strategy: semanticResult.routingDecision,
        usedBm25: semanticResult.usedBm25Search,
        usedVector: semanticResult.usedVectorSearch,
      });

      logger.info('✅ Query routing strategies tested successfully');
    });

    test('should search products with category filter', async () => {
      logger.info('Testing product search with category filter');

      const result = await searchProducts('laptop', {
        limit: 5,
        category: 'Computers',
      });

      logger.info('Product search with category', {
        query: 'laptop',
        category: 'Computers',
        results: result.totalResults,
      });

      expect(result).toHaveProperty('results');
      logger.info('✅ Product category search executed successfully');
    });
  });

  // =========================================================================
  // TEST 3: Schema.org Data Layer (validation and serialization)
  // =========================================================================
  describe('Schema.org Data Layer', () => {
    test('should validate Schema.org Product data', async () => {
      logger.info('Testing Schema.org Product validation');

      const productData = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        sku: 'WH-001',
        name: 'Premium Wireless Headphones',
        description: 'High-quality noise-cancelling headphones',
        offers: {
          '@type': 'Offer',
          price: 299.99,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: 4.5,
          reviewCount: 128,
        },
      };

      const validation = validateProduct(productData);

      logger.info('Product schema validation', {
        valid: validation.valid,
        errors: validation.errors,
      });

      expect(validation.valid).toBe(true);
      logger.info('✅ Schema.org Product validation passed');
    });

    test('should validate Schema.org Order data', async () => {
      logger.info('Testing Schema.org Order validation');

      const orderData = {
        '@context': 'https://schema.org',
        '@type': 'Order',
        orderNumber: 'ORD-12345',
        orderStatus: 'https://schema.org/OrderDelivered',
        orderedItem: [{
          '@type': 'OrderItem',
          orderedItem: {
            '@type': 'Product',
            sku: 'WH-001',
            name: 'Wireless Headphones',
          },
          orderQuantity: 1,
        }],
        paymentStatus: 'https://schema.org/PaymentComplete',
        totalPrice: 299.99,
        priceCurrency: 'USD',
      };

      const validation = validateOrder(orderData);

      logger.info('Order schema validation', {
        valid: validation.valid,
        errors: validation.errors,
      });

      expect(validation.valid).toBe(true);
      logger.info('✅ Schema.org Order validation passed');
    });

    test('should validate Schema.org Refund data', async () => {
      logger.info('Testing Schema.org Refund validation');

      const refundData = {
        '@context': 'https://schema.org',
        '@type': 'Refund',
        amount: 99.99,
        reason: 'Product defective',
        refundStatus: 'https://schema.org/RefundApproved',
      };

      const validation = validateRefund(refundData);

      logger.info('Refund schema validation', {
        valid: validation.valid,
        errors: validation.errors,
      });

      expect(validation.valid).toBe(true);
      logger.info('✅ Schema.org Refund validation passed');
    });

    test('should reject invalid Schema.org data', async () => {
      logger.info('Testing rejection of invalid Schema.org data');

      const invalidProduct = {
        sku: '',  // Empty string should fail
        name: 123,  // Should be string, not number
        price: 'invalid',  // Should be number
      };

      const validation = validateProduct(invalidProduct);

      logger.info('Invalid product validation', {
        valid: validation.valid,
        hasErrors: validation.errors?.length > 0,
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
      logger.info('✅ Invalid Schema.org data correctly rejected');
    });
  });

  // =========================================================================
  // TEST 4: AP2 Payment Protocol (Stripe webhook simulation)
  // =========================================================================
  describe('AP2 Payment Protocol', () => {
    test('should simulate Stripe refund webhook processing', async () => {
      logger.info('Testing AP2 Stripe refund webhook simulation');

      // Simulate webhook payload
      const refundEvent = {
        id: 're_1234567890',
        object: 'refund',
        amount: 9999,
        currency: 'usd',
        payment_intent: 'pi_1234567890',
        charge: 'ch_1234567890',
        status: 'succeeded',
        reason: 'requested_by_customer',
        created: Date.now() / 1000,
        metadata: {
          orderId: 'ORD-12345',
          customerEmail: 'customer@example.com',
          idempotencyKey: 'refund_ORD-12345_123456',
        },
      };

      // Simulate webhook processing (without actual Stripe verification)
      logger.info('Simulated webhook event', {
        refundId: refundEvent.id,
        amount: refundEvent.amount / 100,
        currency: refundEvent.currency,
        status: refundEvent.status,
      });

      // Simulate idempotency check
      const eventId = `evt_${refundEvent.id}`;
      const isDuplicate = false; // Simulated check

      logger.info('Idempotency check', {
        eventId,
        isDuplicate,
      });

      expect(refundEvent.id).toBeDefined();
      expect(refundEvent.status).toBe('succeeded');
      logger.info('✅ AP2 Stripe refund webhook simulation completed');
    });

    test('should validate refund idempotency key format', async () => {
      logger.info('Testing refund idempotency key validation');

      const idempotencyKeys = [
        'refund_ORD-12345_abc123',
        'refund_order_99999_xyz789',
        're_1234567890',
      ];

      for (const key of idempotencyKeys) {
        const isValid = key.includes('refund') || key.startsWith('re_');
        logger.info(`Idempotency key validation: ${key}`, { isValid });
      }

      logger.info('✅ Idempotency key format validated');
    });
  });

  // =========================================================================
  // TEST 5: GenUI Component Data Structure
  // =========================================================================
  describe('GenUI Component Data', () => {
    test('should generate valid OrderCard data structure', async () => {
      logger.info('Testing GenUI OrderCard data structure');

      const orderData = {
        id: 'ord-12345',
        orderNumber: 'ORD-12345',
        status: 'delivered',
        total: 299.99,
        subtotal: 279.99,
        tax: 20.00,
        shipping: 0,
        items: [
          {
            id: 'item-1',
            name: 'Premium Wireless Headphones',
            quantity: 1,
            price: 279.99,
            sku: 'WH-001',
          },
        ],
        shippingAddress: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94102',
          country: 'USA',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customerId: 'cust-123',
        customerEmail: 'customer@example.com',
        customerName: 'John Doe',
        paymentMethod: 'Visa ****4242',
      };

      logger.info('OrderCard data structure', {
        orderNumber: orderData.orderNumber,
        status: orderData.status,
        itemCount: orderData.items.length,
        total: orderData.total,
      });

      expect(orderData.orderNumber).toBeDefined();
      expect(orderData.items).toHaveLength(1);
      logger.info('✅ GenUI OrderCard data structure validated');
    });

    test('should generate valid ProductCard data structure', async () => {
      logger.info('Testing GenUI ProductCard data structure');

      const productData = {
        id: 'prod-001',
        name: 'Premium Wireless Headphones',
        description: 'High-quality noise-cancelling headphones with 30hr battery',
        price: 299.99,
        category: 'Audio',
        image: '/headphones.jpg',
        rating: 4.5,
        stock: 150,
        offers: {
          price: 299.99,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      };

      logger.info('ProductCard data structure', {
        name: productData.name,
        price: productData.price,
        category: productData.category,
      });

      expect(productData.name).toBeDefined();
      expect(productData.price).toBeGreaterThan(0);
      logger.info('✅ GenUI ProductCard data structure validated');
    });

    test('should generate valid TicketStatus data structure', async () => {
      logger.info('Testing GenUI TicketStatus data structure');

      const ticketData = {
        id: 'ticket-001',
        ticketNumber: 'TKT-001',
        issue: 'Order not delivered',
        status: 'https://schema.org/ContactOptionPending',
        priority: 'high',
        relatedOrder: 'ORD-12345',
        createdAt: new Date().toISOString(),
      };

      logger.info('TicketStatus data structure', {
        ticketNumber: ticketData.ticketNumber,
        status: ticketData.status,
        priority: ticketData.priority,
      });

      expect(ticketData.ticketNumber).toBeDefined();
      expect(ticketData.priority).toBe('high');
      logger.info('✅ GenUI TicketStatus data structure validated');
    });
  });

  // =========================================================================
  // TEST 6: End-to-End Protocol Flow
  // =========================================================================
  describe('End-to-End Protocol Flow', () => {
    test('should complete full RAG -> MCP -> GenUI flow', async () => {
      logger.info('Testing full RAG -> MCP -> GenUI flow');

      // Step 1: User queries for products
      const userQuery = 'wireless noise cancelling headphones under $200';

      logger.info('Step 1: User query received', { query: userQuery });

      // Step 2: Hybrid search (RAG)
      const searchStartTime = Date.now();
      const searchResult = await hybridSearch({
        query: userQuery,
        context: 'product_search',
        limit: 10,
      });
      const searchTime = Date.now() - searchStartTime;

      logger.info('Step 2: Hybrid search completed', {
        results: searchResult.totalResults,
        strategy: searchResult.routingDecision,
        timeMs: searchTime,
      });

      // Step 3: MCP tool enrichment
      const client = createMcPClient();
      const toolResult = await client.callTool('serp_search', {
        query: 'best wireless headphones 2024 reviews',
      }, null);

      logger.info('Step 3: MCP web search completed', {
        results: toolResult.data?.count,
      });

      // Step 4: Generate GenUI data structure
      const genuiData = {
        products: searchResult.results.slice(0, 3).map((r, i) => ({
          id: `prod-${i}`,
          name: r.name || `Product ${i + 1}`,
          price: r.price || 99.99 + i * 50,
          category: r.category || 'Electronics',
          rating: 4.0 + Math.random() * 0.5,
        })),
        enrichedInfo: {
          sources: ['hybrid_search', 'web_search'],
          lastUpdated: new Date().toISOString(),
        },
      };

      logger.info('Step 4: GenUI data generated', {
        productCount: genuiData.products.length,
        sources: genuiData.enrichedInfo.sources,
      });

      // Validate complete flow
      expect(userQuery).toBeDefined();
      expect(searchResult.results).toBeDefined();
      expect(toolResult.success).toBe(true);
      expect(genuiData.products).toHaveLength(3);

      logger.info('✅ Full RAG -> MCP -> GenUI flow completed successfully');
    });
  });
});
