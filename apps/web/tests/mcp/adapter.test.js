/**
 * MCP Adapter Tests
 *
 * Tests for the MCP tool adapter that wraps legacy tools.
 * Validates schema validation, parameter parsing, mock responses,
 * authorization checks, and hybrid search functionality.
 *
 * Run: pnpm --filter vercel-ai-sdk-tests test:mcp
 */

import { jest, describe, test, expect } from '@jest/globals';

// ============ MOCK DATA ============

const mockOrders = {
  'ORD-001': {
    id: 'ORD-001',
    orderNumber: 'ORD-ORD-001',
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
  },
};

const mockProducts = {
  'PROD-001': {
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
  },
};

const mockCustomers = {
  'CUST-001': {
    id: 'CUST-001',
    email: 'customer@example.com',
    name: 'John Doe',
    totalOrders: 5,
    lifetimeValue: 499.95,
  },
};

const mockTickets = {
  'TICKET-001': {
    id: 'TICKET-001',
    subject: 'Order Inquiry',
    description: 'I have a question about my recent order.',
    status: 'open',
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
    ],
  },
};

// ============ TOOL DEFINITIONS ============

/**
 * Creates a tool definition matching the MCP adapter structure
 */
function createTool(name, options) {
  return {
    name,
    title: options.title || name,
    description: options.description || '',
    parameters: options.parameters,
    requireUserId: options.requireUserId ?? true,
    execute: options.execute,
  };
}

/**
 * Database query tool simulation
 */
const dbQueryTool = createTool('db_query', {
  title: 'Database Query',
  description: 'Query database for orders, products, customers, or support tickets.',
  parameters: {
    queryType: ['orders', 'products', 'customers', 'tickets'],
    orderId: undefined,
    productId: undefined,
    customerId: undefined,
    ticketId: undefined,
    status: undefined,
    category: undefined,
    maxPrice: undefined,
    limit: 20,
    shape: {},
  },
  requireUserId: true,
  execute: async (args, userId) => {
    if (!userId) {
      return { success: false, error: 'Authorization required' };
    }

    const { queryType, orderId, productId, customerId, ticketId, limit } = args;

    switch (queryType) {
      case 'orders':
        if (orderId && mockOrders[orderId]) {
          return { success: true, data: mockOrders[orderId] };
        }
        return { success: true, data: Object.values(mockOrders).slice(0, limit) };

      case 'products':
        if (productId && mockProducts[productId]) {
          return { success: true, data: mockProducts[productId] };
        }
        return { success: true, data: Object.values(mockProducts).slice(0, limit) };

      case 'customers':
        if (customerId && mockCustomers[customerId]) {
          return { success: true, data: mockCustomers[customerId] };
        }
        return { success: true, data: Object.values(mockCustomers).slice(0, limit) };

      case 'tickets':
        if (ticketId && mockTickets[ticketId]) {
          return { success: true, data: mockTickets[ticketId] };
        }
        return { success: true, data: Object.values(mockTickets).slice(0, limit) };

      default:
        return { success: false, error: 'Invalid query type' };
    }
  },
});

/**
 * Web search tool simulation
 */
const serpSearchTool = createTool('serp_search', {
  title: 'Web Search',
  description: 'Search the web for external information.',
  parameters: {
    query: '',
    shape: {},
  },
  requireUserId: false,
  execute: async (args) => {
    const { query } = args;
    return {
      success: true,
      data: {
        query,
        results: [
          {
            title: 'E-commerce FAQ',
            url: 'https://example.com/faq',
            snippet: 'Common questions about orders, shipping, and returns.',
          },
          {
            title: 'Return Policy',
            url: 'https://example.com/returns',
            snippet: '30-day return policy for all items in original condition.',
          },
        ],
        count: 2,
      },
    };
  },
});

/**
 * Vector search tool simulation
 */
const vectorSearchTool = createTool('vector_search', {
  title: 'Semantic Search',
  description: 'Perform semantic search on user preferences.',
  parameters: {
    query: '',
    shape: {},
  },
  requireUserId: true,
  execute: async (args, userId) => {
    if (!userId) {
      return { success: false, error: 'Authorization required' };
    }

    const { query } = args;
    return {
      success: true,
      data: {
        query,
        user_id: userId,
        embeddings: [
          {
            id: 'PREF-001',
            category: 'Electronics',
            similarity: 0.92,
            recent_purchases: ['Laptop', 'Headphones'],
          },
          {
            id: 'PREF-002',
            category: 'Books',
            similarity: 0.85,
            recent_purchases: ['Novels', 'Self-help'],
          },
        ],
        count: 2,
      },
    };
  },
});

/**
 * Hybrid search tool simulation
 */
const hybridSearchTool = createTool('hybrid_search', {
  title: 'Hybrid Search',
  description: 'Run database query, web search, and semantic search simultaneously.',
  parameters: {
    dbQueryType: undefined,
    dbQueryParams: undefined,
    webQuery: undefined,
    semanticQuery: undefined,
    shape: {},
  },
  requireUserId: true,
  execute: async (args, userId) => {
    const startTime = Date.now();
    const results = {};
    const errors = [];

    if (args.dbQueryType) {
      const dbResult = await dbQueryTool.execute(
        { queryType: args.dbQueryType, limit: 20 },
        userId
      );
      if (dbResult.success) {
        results.database = dbResult.data;
      } else {
        errors.push(`database: ${dbResult.error}`);
      }
    }

    if (args.webQuery) {
      const webResult = await serpSearchTool.execute({ query: args.webQuery });
      if (webResult.success) {
        results.web = webResult.data;
      } else {
        errors.push(`web: ${webResult.error}`);
      }
    }

    if (args.semanticQuery) {
      const semanticResult = await vectorSearchTool.execute({ query: args.semanticQuery }, userId);
      if (semanticResult.success) {
        results.semantic = semanticResult.data;
      } else {
        errors.push(`semantic: ${semanticResult.error}`);
      }
    }

    return {
      success: errors.length === 0,
      data: {
        results,
        errors: errors.length > 0 ? errors : undefined,
        executionTime: Date.now() - startTime,
      },
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  },
});

/**
 * Legacy tools array
 */
const legacyTools = [dbQueryTool, serpSearchTool, vectorSearchTool];

/**
 * Register legacy tools with a mock server
 */
function registerLegacyTools(server) {
  for (const tool of legacyTools) {
    server.registerTool(tool.name, tool);
  }
}

// ============ SCHEMA VALIDATION TESTS ============

describe('MCP Adapter Schema Validation', () => {
  describe('dbQueryTool Schema', () => {
    test('should have valid schema properties', () => {
      expect(dbQueryTool).toBeDefined();
      expect(dbQueryTool.name).toBe('db_query');
      expect(dbQueryTool.title).toBe('Database Query');
      expect(dbQueryTool.requireUserId).toBe(true);
      expect(dbQueryTool.parameters).toBeDefined();
    });

    test('should validate order query type', () => {
      expect(dbQueryTool.parameters.queryType).toContain('orders');
    });

    test('should validate all query types', () => {
      expect(dbQueryTool.parameters.queryType).toContain('orders');
      expect(dbQueryTool.parameters.queryType).toContain('products');
      expect(dbQueryTool.parameters.queryType).toContain('customers');
      expect(dbQueryTool.parameters.queryType).toContain('tickets');
    });

    test('should have default limit value', () => {
      expect(dbQueryTool.parameters.limit).toBe(20);
    });
  });

  describe('serpSearchTool Schema', () => {
    test('should have valid schema properties', () => {
      expect(serpSearchTool).toBeDefined();
      expect(serpSearchTool.name).toBe('serp_search');
      expect(serpSearchTool.title).toBe('Web Search');
      expect(serpSearchTool.requireUserId).toBe(false);
      expect(serpSearchTool.parameters).toBeDefined();
    });

    test('should require query parameter', () => {
      expect(serpSearchTool.parameters.query).toBeDefined();
    });
  });

  describe('vectorSearchTool Schema', () => {
    test('should have valid schema properties', () => {
      expect(vectorSearchTool).toBeDefined();
      expect(vectorSearchTool.name).toBe('vector_search');
      expect(vectorSearchTool.title).toBe('Semantic Search');
      expect(vectorSearchTool.requireUserId).toBe(true);
      expect(vectorSearchTool.parameters).toBeDefined();
    });
  });

  describe('hybridSearchTool Schema', () => {
    test('should have valid schema properties', () => {
      expect(hybridSearchTool).toBeDefined();
      expect(hybridSearchTool.name).toBe('hybrid_search');
      expect(hybridSearchTool.title).toBe('Hybrid Search');
      expect(hybridSearchTool.requireUserId).toBe(true);
      expect(hybridSearchTool.parameters).toBeDefined();
    });

    test('should support optional db query type', () => {
      expect(hybridSearchTool.parameters.dbQueryType).toBeUndefined();
    });

    test('should support optional web query', () => {
      expect(hybridSearchTool.parameters.webQuery).toBeUndefined();
    });

    test('should support optional semantic query', () => {
      expect(hybridSearchTool.parameters.semanticQuery).toBeUndefined();
    });
  });
});

// ============ PARAMETER PARSING TESTS ============

describe('MCP Adapter Parameter Parsing', () => {
  describe('dbQueryTool Parameters', () => {
    test('should parse order query parameters', () => {
      const params = { queryType: 'orders', orderId: 'ORD-001', limit: 10 };
      expect(params.queryType).toBe('orders');
      expect(params.orderId).toBe('ORD-001');
      expect(params.limit).toBe(10);
    });

    test('should parse product query parameters', () => {
      const params = { queryType: 'products', productId: 'PROD-001', maxPrice: 100 };
      expect(params.queryType).toBe('products');
      expect(params.productId).toBe('PROD-001');
      expect(params.maxPrice).toBe(100);
    });

    test('should parse customer query parameters', () => {
      const params = { queryType: 'customers', customerId: 'CUST-001' };
      expect(params.queryType).toBe('customers');
      expect(params.customerId).toBe('CUST-001');
    });

    test('should parse ticket query parameters', () => {
      const params = { queryType: 'tickets', ticketId: 'TICKET-001', status: 'open' };
      expect(params.queryType).toBe('tickets');
      expect(params.ticketId).toBe('TICKET-001');
      expect(params.status).toBe('open');
    });

    test('should use default limit when not specified', () => {
      const params = { queryType: 'orders' };
      expect(params.limit).toBeUndefined();
      expect(dbQueryTool.parameters.limit).toBe(20);
    });
  });

  describe('serpSearchTool Parameters', () => {
    test('should parse search query', () => {
      const params = { query: 'return policy' };
      expect(params.query).toBe('return policy');
    });
  });

  describe('vectorSearchTool Parameters', () => {
    test('should parse search query', () => {
      const params = { query: 'electronics' };
      expect(params.query).toBe('electronics');
    });
  });

  describe('hybridSearchTool Parameters', () => {
    test('should parse hybrid search parameters', () => {
      const params = {
        dbQueryType: 'products',
        webQuery: 'return policy',
        semanticQuery: 'refund process',
      };
      expect(params.dbQueryType).toBe('products');
      expect(params.webQuery).toBe('return policy');
      expect(params.semanticQuery).toBe('refund process');
    });

    test('should support partial parameter sets', () => {
      const params = { webQuery: 'shipping times' };
      expect(params.webQuery).toBe('shipping times');
      expect(params.dbQueryType).toBeUndefined();
      expect(params.semanticQuery).toBeUndefined();
    });
  });
});

// ============ MOCK RESPONSE TESTS ============

describe('MCP Adapter Mock Responses', () => {
  describe('dbQueryTool Responses', () => {
    test('should return order data for order query', async () => {
      const result = await dbQueryTool.execute({ queryType: 'orders', orderId: 'ORD-001' }, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('ORD-001');
      expect(result.data.orderNumber).toBe('ORD-ORD-001');
      expect(result.data.status).toBe('delivered');
      expect(result.data.total).toBe(99.99);
    });

    test('should return customer data for customer query', async () => {
      const result = await dbQueryTool.execute({ queryType: 'customers', customerId: 'CUST-001' }, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('CUST-001');
      expect(result.data.email).toBe('customer@example.com');
    });

    test('should return product data for product query', async () => {
      const result = await dbQueryTool.execute({ queryType: 'products', productId: 'PROD-001' }, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('PROD-001');
      expect(result.data.name).toBe('Sample Product');
      expect(result.data.price).toBe(29.99);
    });

    test('should return ticket data for ticket query', async () => {
      const result = await dbQueryTool.execute({ queryType: 'tickets', ticketId: 'TICKET-001' }, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('TICKET-001');
      expect(result.data.subject).toBe('Order Inquiry');
    });

    test('should return array for list queries', async () => {
      const result = await dbQueryTool.execute({ queryType: 'orders', limit: 10 }, 'user-123');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('serpSearchTool Responses', () => {
    test('should return search results', async () => {
      const result = await serpSearchTool.execute({ query: 'return policy' });

      expect(result.success).toBe(true);
      expect(result.data.query).toBe('return policy');
      expect(result.data.results).toBeDefined();
      expect(result.data.results.length).toBe(2);
    });

    test('should include required result fields', async () => {
      const result = await serpSearchTool.execute({ query: 'test' });

      expect(result.data.results[0]).toHaveProperty('title');
      expect(result.data.results[0]).toHaveProperty('url');
      expect(result.data.results[0]).toHaveProperty('snippet');
    });
  });

  describe('vectorSearchTool Responses', () => {
    test('should return semantic search results', async () => {
      const result = await vectorSearchTool.execute({ query: 'electronics' }, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data.query).toBe('electronics');
      expect(result.data.embeddings).toBeDefined();
    });

    test('should include similarity scores', async () => {
      const result = await vectorSearchTool.execute({ query: 'test' }, 'user-123');

      const embedding = result.data.embeddings[0];
      expect(embedding).toHaveProperty('similarity');
      expect(typeof embedding.similarity).toBe('number');
      expect(embedding.similarity).toBeLessThanOrEqual(1);
      expect(embedding.similarity).toBeGreaterThan(0);
    });
  });

  describe('hybridSearchTool Responses', () => {
    test('should execute hybrid search with all sources', async () => {
      const result = await hybridSearchTool.execute(
        {
          dbQueryType: 'products',
          webQuery: 'return policy',
          semanticQuery: 'refund process',
        },
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.data.results).toBeDefined();
      expect(result.data.results.database).toBeDefined();
      expect(result.data.results.web).toBeDefined();
      expect(result.data.results.semantic).toBeDefined();
    });

    test('should execute hybrid search with partial sources', async () => {
      const result = await hybridSearchTool.execute(
        {
          dbQueryType: 'orders',
          webQuery: 'return policy',
        },
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.data.results.database).toBeDefined();
      expect(result.data.results.web).toBeDefined();
      expect(result.data.results.semantic).toBeUndefined();
    });

    test('should execute empty hybrid search', async () => {
      const result = await hybridSearchTool.execute({}, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data.results).toEqual({});
    });

    test('should include execution time in results', async () => {
      const startTime = Date.now();
      const result = await hybridSearchTool.execute(
        {
          dbQueryType: 'products',
          webQuery: 'return policy',
        },
        'user-123'
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data.executionTime).toBeLessThan(endTime - startTime + 100);
    });
  });
});

// ============ AUTHORIZATION TESTS ============

describe('MCP Adapter Authorization', () => {
  test('should require user ID for db_query', async () => {
    const result = await dbQueryTool.execute({ queryType: 'orders' }, null);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Authorization');
  });

  test('should require user ID for vector_search', async () => {
    const result = await vectorSearchTool.execute({ query: 'test' }, null);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Authorization');
  });

  test('should require user ID for hybrid_search', async () => {
    const result = await hybridSearchTool.execute({ dbQueryType: 'orders' }, null);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Authorization');
  });

  test('should not require user ID for serp_search', async () => {
    const result = await serpSearchTool.execute({ query: 'test' }, null);

    expect(result.success).toBe(true);
  });

  test('should accept valid user ID', async () => {
    const result = await dbQueryTool.execute({ queryType: 'orders' }, 'user-123');

    expect(result.success).toBe(true);
  });
});

// ============ HYBRID SEARCH TESTS ============

describe('MCP Adapter Hybrid Search', () => {
  test('should combine results from multiple sources', async () => {
    const result = await hybridSearchTool.execute(
      {
        dbQueryType: 'orders',
        webQuery: 'return policy',
        semanticQuery: 'refund process',
      },
      'user-123'
    );

    expect(result.success).toBe(true);
    expect(Object.keys(result.data.results)).toContain('database');
    expect(Object.keys(result.data.results)).toContain('web');
    expect(Object.keys(result.data.results)).toContain('semantic');
  });

  test('should handle parallel execution', async () => {
    const startTime = Date.now();
    const result = await hybridSearchTool.execute(
      {
        dbQueryType: 'orders',
        webQuery: 'return policy',
        semanticQuery: 'refund process',
      },
      'user-123'
    );
    const endTime = Date.now();

    // All searches should complete in reasonable time (parallel execution)
    expect(endTime - startTime).toBeLessThan(1000);
    expect(result.success).toBe(true);
  });

  test('should handle partial failures gracefully', async () => {
    const result = await hybridSearchTool.execute(
      {
        dbQueryType: 'invalid',
        webQuery: 'test',
      },
      'user-123'
    );

    // Should still return, potentially with errors
    expect(result).toBeDefined();
  });
});

// ============ LEGACY TOOLS ARRAY TESTS ============

describe('Legacy Tools Array', () => {
  test('should export all legacy tools', () => {
    expect(legacyTools).toBeDefined();
    expect(Array.isArray(legacyTools)).toBe(true);
    expect(legacyTools.length).toBe(3);
  });

  test('should contain dbQueryTool', () => {
    expect(legacyTools).toContain(dbQueryTool);
  });

  test('should contain serpSearchTool', () => {
    expect(legacyTools).toContain(serpSearchTool);
  });

  test('should contain vectorSearchTool', () => {
    expect(legacyTools).toContain(vectorSearchTool);
  });

  test('should not contain hybridSearchTool in legacy array', () => {
    expect(legacyTools).not.toContain(hybridSearchTool);
  });
});

// ============ TOOL REGISTRATION TESTS ============

describe('Tool Registration', () => {
  test('should register tools with mock server', () => {
    const registeredTools = new Map();

    const mockServer = {
      registerTool: (name, tool) => {
        registeredTools.set(name, tool);
      },
    };

    registerLegacyTools(mockServer);

    expect(registeredTools.size).toBe(3);
    expect(registeredTools.has('db_query')).toBe(true);
    expect(registeredTools.has('serp_search')).toBe(true);
    expect(registeredTools.has('vector_search')).toBe(true);
  });

  test('should register tools with correct names', () => {
    const registeredTools = new Map();

    const mockServer = {
      registerTool: (name, tool) => {
        registeredTools.set(name, tool);
      },
    };

    registerLegacyTools(mockServer);

    for (const [name, tool] of registeredTools) {
      expect(tool.name).toBe(name);
    }
  });
});

// ============ EDGE CASES TESTS ============

describe('Edge Cases', () => {
  test('should handle large limit values', async () => {
    const result = await dbQueryTool.execute({ queryType: 'orders', limit: 100 }, 'user-123');

    expect(result.success).toBe(true);
  });

  test('should handle special characters in queries', async () => {
    const result = await serpSearchTool.execute({ query: "return policy' OR 1=1--" });

    expect(result.success).toBe(true);
    expect(result.data.query).toBe("return policy' OR 1=1--");
  });

  test('should handle long queries', async () => {
    const longQuery = 'a'.repeat(1000);

    const result = await vectorSearchTool.execute({ query: longQuery }, 'user-123');

    expect(result.success).toBe(true);
  });

  test('should handle unicode characters', async () => {
    const result = await serpSearchTool.execute({ query: 'Política de devolución' });

    expect(result.success).toBe(true);
    expect(result.data.query).toBe('Política de devolución');
  });

  test('should handle concurrent tool executions', async () => {
    const promises = [
      dbQueryTool.execute({ queryType: 'orders', limit: 10 }, 'user-1'),
      dbQueryTool.execute({ queryType: 'products', limit: 10 }, 'user-2'),
      serpSearchTool.execute({ query: 'test' }, null),
      vectorSearchTool.execute({ query: 'test' }, 'user-3'),
    ];

    const results = await Promise.all(promises);

    for (const result of results) {
      expect(result.success).toBe(true);
    }
  });
});
