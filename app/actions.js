// app/actions.js
import { generateObject, streamObject, streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const generateSQLQuery = async (input) => {
  'use server';
  try {
    const result = await generateObject({
      model: google('gemini-1.5-flash'),
      system: `
        You are a SQL (PostgreSQL) expert. Generate a SQL query to retrieve data based on the user's natural language input. The table schema is:

        customer (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255) UNIQUE NOT NULL,
          phone VARCHAR(50),
          address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        product (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price FLOAT NOT NULL,
          stock INTEGER NOT NULL,
          image VARCHAR(255)
        );

        "order" (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER REFERENCES customer(id),
          product_id INTEGER REFERENCES product(id),
          order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          total FLOAT NOT NULL,
          status VARCHAR(50) NOT NULL
        );

        support_ticket (
          id SERIAL PRIMARY KEY,
          customer_id INTEGER REFERENCES customer(id),
          issue TEXT NOT NULL,
          status VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        Rules:
        - Only SELECT queries are allowed.
        - Use LOWER() and ILIKE for case-insensitive string searches, e.g., LOWER(email) ILIKE LOWER('%search_term%').
        - Trim whitespace in conditions.
        - Validate email format (contains '@' and '.').
        - Return at least two columns for chart-friendly output.
        - For rates, return decimals (e.g., 10% = 0.1).
        - For 'over time' data, group by year.
        - Use table aliases (e.g., 'o' for "order", 'c' for customer).
        - Quote the "order" table (reserved keyword).
        - For email-based queries, prefer joining with the "order" table unless customer details are explicitly requested.
      `,
      prompt: `Generate a SQL query to retrieve the data the user wants: ${input}`,
      schema: z.object({
        query: z.string().describe('The generated SQL query'),
      }),
    });

    const query = result.object.query;
    if (
      !query.trim().toLowerCase().startsWith('select') ||
      query.trim().toLowerCase().includes('drop') ||
      query.trim().toLowerCase().includes('delete') ||
      query.trim().toLowerCase().includes('insert') ||
      query.trim().toLowerCase().includes('update') ||
      query.trim().toLowerCase().includes('alter') ||
      query.trim().toLowerCase().includes('truncate') ||
      query.trim().toLowerCase().includes('create') ||
      query.trim().toLowerCase().includes('grant') ||
      query.trim().toLowerCase().includes('revoke')
    ) {
      throw new Error('Only SELECT queries are allowed');
    }

    return query;
  } catch (error) {
    console.error('[ERROR] Failed to generate SQL query:', error);
    throw new Error('Failed to generate SQL query');
  }
};

// ============================================================================
// StreamUI-Compatible Server Actions
// ============================================================================

/**
 * Stream UI response for agent chat
 */
export async function streamAgentResponse(messages, options = {}) {
  'use server';

  const {
    model = google('gemini-1.5-flash'),
    maxSteps = 5,
    onStepComplete = null,
    includeUI = true,
  } = options;

  try {
    const result = await streamText({
      model,
      messages,
      maxSteps,
      tools: {
        // Database query tool
        db_query: {
          parameters: z.object({
            queryType: z.enum(['orders', 'products', 'customers', 'tickets']),
            orderId: z.string().optional(),
            productId: z.string().optional(),
            customerId: z.string().optional(),
            ticketId: z.string().optional(),
            status: z.string().optional(),
            category: z.string().optional(),
            maxPrice: z.number().optional(),
            limit: z.number().int().positive().max(100).default(20),
          }),
        },
        // Web search tool
        serp_search: {
          parameters: z.object({
            query: z.string().min(1).describe('Search query for web search'),
          }),
        },
        // Vector search for semantic queries
        vector_search: {
          parameters: z.object({
            query: z.string().min(1).describe('Query for semantic search'),
          }),
        },
        // Hybrid search combining multiple sources
        hybrid_search: {
          parameters: z.object({
            dbQueryType: z.enum(['orders', 'products', 'customers', 'tickets']).optional(),
            dbQueryParams: z.record(z.string(), z.unknown()).optional(),
            webQuery: z.string().optional(),
            semanticQuery: z.string().optional(),
          }),
        },
      },
      system: `You are an e-commerce support agent. Help customers with:
        - Order inquiries and status
        - Product information and recommendations
        - Refund and return requests
        - Support ticket management
        ${includeUI ? 'Use UI components (OrderCard, ProductCard, TicketStatus) when showing structured data.' : ''}
      `,
    });

    if (onStepComplete) {
      result.consumeStream = onStepComplete;
    }

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('[ERROR] Agent stream failed:', error);
    throw error;
  }
}

/**
 * Get order details with UI component data
 */
export async function getOrderDetails(orderId, userId) {
  'use server';

  try {
    // In production, this would query the database
    const orderData = {
      id: orderId,
      orderNumber: `ORD-${orderId}`,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerId: userId,
      customerEmail: 'customer@example.com',
      customerName: 'John Doe',
      paymentMethod: 'Visa ****4242',
    };

    return { success: true, data: orderData };
  } catch (error) {
    console.error('[ERROR] Failed to get order details:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get product details with UI component data
 */
export async function getProductDetails(productId) {
  'use server';

  try {
    const productData = {
      id: productId,
      sku: `SKU-${productId}`,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return { success: true, data: productData };
  } catch (error) {
    console.error('[ERROR] Failed to get product details:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get ticket details with UI component data
 */
export async function getTicketDetails(ticketId, userId) {
  'use server';

  try {
    const ticketData = {
      id: ticketId,
      subject: 'Order Inquiry',
      description: 'I have a question about my recent order.',
      status: 'in_progress',
      priority: 'medium',
      category: 'order_status',
      customerId: userId,
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: 'msg-1',
          authorId: userId,
          authorName: 'John Doe',
          authorType: 'customer',
          content: 'I have a question about my recent order.',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          authorId: 'agent-1',
          authorName: 'Support Agent',
          authorType: 'agent',
          content: 'Hello! I would be happy to help you with your order.',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    return { success: true, data: ticketData };
  } catch (error) {
    console.error('[ERROR] Failed to get ticket details:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create refund request
 */
export async function createRefundRequest(orderId, reason, reasonDescription, amount) {
  'use server';

  try {
    const refundData = {
      id: `REF-${Date.now()}`,
      orderId,
      reason,
      reasonDescription,
      amount: amount || 99.99,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    return { success: true, data: refundData };
  } catch (error) {
    console.error('[ERROR] Failed to create refund:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create support ticket
 */
export async function createSupportTicket(data) {
  'use server';

  try {
    const ticketData = {
      id: `TKT-${Date.now()}`,
      ...data,
      status: 'open',
      priority: data.priority || 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: 'msg-1',
          authorId: data.customerId,
          authorName: data.customerName,
          authorType: 'customer',
          content: data.description,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    return { success: true, data: ticketData };
  } catch (error) {
    console.error('[ERROR] Failed to create ticket:', error);
    return { success: false, error: error.message };
  }
}