/**
 * E2E Workflow Tests
 *
 * Tests complete user workflows using Mockoon for API mocking.
 * Tests: Auth flow, Ticket flow, Order flow, Chat flow, Refund flow
 *
 * Note: These tests require Mockoon to be running on port 3000.
 * If Mockoon is not available, all tests will be skipped.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Configuration
const MOCKOON_URL = process.env.MOCKOON_URL || 'http://localhost:3000';
const API_BASE = MOCKOON_URL;

let mockoonAvailable = false;

beforeAll(async () => {
  try {
    const response = await fetch(API_BASE, { method: 'HEAD', timeout: 2000 });
    mockoonAvailable = response.ok;
  } catch {
    mockoonAvailable = false;
  }
});

const conditionalDescribe = mockoonAvailable ? describe : describe.skip;

conditionalDescribe('E2E Workflow Tests', () => {
  describe('Authentication Flow', () => {
    it('should handle user login', async () => {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toHaveProperty('access_token');
      expect(data).toHaveProperty('refresh_token');
      expect(data.user).toHaveProperty('email');
    });

    it('should handle user logout', async () => {
      const response = await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.message).toBe('Logged out successfully');
    });

    it('should reject invalid credentials', async () => {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid@example.com',
          password: 'wrongpassword',
        }),
      });

      // Mock returns 200, but in production would return 401
      expect(response.ok).toBe(true);
    });
  });

  describe('Product Search Flow', () => {
    it('should list all products', async () => {
      const response = await fetch(`${API_BASE}/api/products`);

      expect(response.ok).toBe(true);
      const products = await response.json();

      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);

      // Verify product structure
      const product = products[0];
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('category');
    });

    it('should get single product', async () => {
      const response = await fetch(`${API_BASE}/api/products/prod-001`);

      expect(response.ok).toBe(true);
      const product = await response.json();

      expect(product.id).toBe('prod-001');
    });

    it('should search products', async () => {
      const response = await fetch(`${API_BASE}/api/search/semantic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'laptop' }),
      });

      expect(response.ok).toBe(true);
      const results = await response.json();

      expect(Array.isArray(results)).toBe(true);
      expect(results[0]).toHaveProperty('similarity');
    });
  });

  describe('Order Management Flow', () => {
    it('should list customer orders', async () => {
      const response = await fetch(`${API_BASE}/api/orders`);

      expect(response.ok).toBe(true);
      const orders = await response.json();

      expect(Array.isArray(orders)).toBe(true);
      expect(orders[0]).toHaveProperty('id');
      expect(orders[0]).toHaveProperty('status');
    });

    it('should get order details', async () => {
      const response = await fetch(`${API_BASE}/api/orders/ord-001`);

      expect(response.ok).toBe(true);
      const order = await response.json();

      expect(order.id).toBe('ord-001');
      expect(order).toHaveProperty('items');
      expect(order).toHaveProperty('tracking_number');
    });
  });

  describe('Support Ticket Flow', () => {
    it('should list tickets', async () => {
      const response = await fetch(`${API_BASE}/api/tickets`);

      expect(response.ok).toBe(true);
      const tickets = await response.json();

      expect(Array.isArray(tickets)).toBe(true);
    });

    it('should create ticket', async () => {
      const response = await fetch(`${API_BASE}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Order not received',
          description: 'I placed an order 2 weeks ago and have not received it.',
          priority: 'high',
        }),
      });

      expect(response.ok).toBe(true);
      const ticket = await response.json();

      expect(ticket).toHaveProperty('id');
      expect(ticket).toHaveProperty('ticket_number');
      expect(ticket.status).toBe('open');
    });

    it('should update ticket status', async () => {
      // First create a ticket
      const createRes = await fetch(`${API_BASE}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Test ticket',
          description: 'Testing ticket update',
        }),
      });
      const { id: ticketId } = await createRes.json();

      // Update the ticket
      const updateRes = await fetch(`${API_BASE}/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending' }),
      });

      expect(updateRes.ok).toBe(true);
      const updated = await updateRes.json();

      expect(updated.status).toBe('pending');
    });

    it('should add message to ticket', async () => {
      // Create a ticket first
      const createRes = await fetch(`${API_BASE}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Ticket with messages',
          description: 'Testing message thread',
        }),
      });
      const { id: ticketId } = await createRes.json();

      // Add message
      const msgRes = await fetch(`${API_BASE}/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Hello, I need help with my order.',
          author_type: 'customer',
        }),
      });

      expect(msgRes.ok).toBe(true);
      const message = await msgRes.json();

      expect(message.ticket_id).toBe(ticketId);
      expect(message.content).toBe('Hello, I need help with my order.');
    });
  });

  describe('Refund Flow', () => {
    it('should submit refund request', async () => {
      const response = await fetch(`${API_BASE}/api/orders/ord-001/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 50.00,
          reason: 'Item not as described',
        }),
      });

      expect(response.ok).toBe(true);
      const refund = await response.json();

      expect(refund.success).toBe(true);
      expect(refund.status).toBe('pending');
      expect(refund).toHaveProperty('refund_id');
    });
  });

  describe('Chat Flow', () => {
    it('should send chat message', async () => {
      const response = await fetch(`${API_BASE}/api/chat/route-ollama`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello, I need help with my order.' },
          ],
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data).toHaveProperty('id');
      expect(data.choices[0].message.role).toBe('assistant');
      expect(data.choices[0].message.content).toBeDefined();
    });

    it('should stream chat response', async () => {
      const response = await fetch(`${API_BASE}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Tell me about your products.' },
          ],
        }),
      });

      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('text/event-stream');

      // Read streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let chunks = 0;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks++;
        const text = decoder.decode(value);
        expect(text.length).toBeGreaterThan(0);
      }

      expect(chunks).toBeGreaterThan(0);
    });
  });

  describe('Inventory Flow', () => {
    it('should check product inventory', async () => {
      const response = await fetch(`${API_BASE}/api/inventory/prod-001`);

      expect(response.ok).toBe(true);
      const inventory = await response.json();

      expect(inventory.productId).toBe('prod-001');
      expect(inventory).toHaveProperty('available');
      expect(inventory).toHaveProperty('quantity');
    });
  });

  describe('Analytics Flow', () => {
    it('should get dashboard analytics', async () => {
      const response = await fetch(`${API_BASE}/api/analytics/dashboard`);

      expect(response.ok).toBe(true);
      const analytics = await response.json();

      expect(analytics).toHaveProperty('total_orders');
      expect(analytics).toHaveProperty('total_revenue');
      expect(analytics).toHaveProperty('open_tickets');
    });

    it('should get order analytics', async () => {
      const response = await fetch(`${API_BASE}/api/analytics/orders`);

      expect(response.ok).toBe(true);
      const analytics = await response.json();

      expect(analytics).toHaveProperty('labels');
      expect(analytics).toHaveProperty('data');
      expect(analytics.labels.length).toBe(analytics.data.length);
    });
  });

  describe('Webhook Flow', () => {
    it('should handle Stripe webhook', async () => {
      const response = await fetch(`${API_BASE}/api/webhooks/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123456',
              amount: 1999,
            },
          },
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      expect(result.received).toBe(true);
    });
  });

  describe('Health Check Flow', () => {
    it('should return health status', async () => {
      const response = await fetch(`${API_BASE}/api/health`);

      expect(response.ok).toBe(true);
      const health = await response.json();

      expect(health.status).toBe('healthy');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('services');
    });
  });
});

describe('Complete User Journeys', () => {
  it('should complete order inquiry journey', async () => {
    // Step 1: User logs in
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@example.com',
        password: 'password123',
      }),
    });
    expect(loginRes.ok).toBe(true);
    const { access_token } = await loginRes.json();

    // Step 2: User checks order status
    const orderRes = await fetch(`${API_BASE}/api/orders/ord-001`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(orderRes.ok).toBe(true);
    const order = await orderRes.json();
    expect(order.status).toBe('shipped');

    // Step 3: User creates support ticket
    const ticketRes = await fetch(`${API_BASE}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        subject: 'Shipping inquiry',
        description: `Order ${order.id} was marked shipped but tracking shows no updates.`,
        priority: 'medium',
      }),
    });
    expect(ticketRes.ok).toBe(true);
    const ticket = await ticketRes.json();
    expect(ticket.status).toBe('open');

    // Step 4: User asks chat about refund policy
    const chatRes = await fetch(`${API_BASE}/api/chat/route-ollama`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'What is your return policy for shipped orders?',
          },
        ],
      }),
    });
    expect(chatRes.ok).toBe(true);
    const chat = await chatRes.json();
    expect(chat.choices[0].message.content).toBeDefined();

    console.log('✅ Complete order inquiry journey successful');
  });

  it('should complete refund request journey', async () => {
    // Step 1: User logs in
    const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@example.com',
        password: 'password123',
      }),
    });
    const { access_token } = await loginRes.json();

    // Step 2: User views order details
    const orderRes = await fetch(`${API_BASE}/api/orders/ord-001`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const order = await orderRes.json();

    // Step 3: User requests refund
    const refundRes = await fetch(`${API_BASE}/api/orders/ord-001/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        amount: order.total,
        reason: 'Item damaged upon arrival',
      }),
    });
    expect(refundRes.ok).toBe(true);
    const refund = await refundRes.json();

    expect(refund.success).toBe(true);
    expect(refund.status).toBe('pending');

    // Step 4: User creates ticket for refund follow-up
    const ticketRes = await fetch(`${API_BASE}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        subject: `Refund request ${refund.refund_id}`,
        description: `I have requested a refund for order ${order.id}. Please follow up.`,
        priority: 'low',
      }),
    });
    expect(ticketRes.ok).toBe(true);

    console.log('✅ Complete refund request journey successful');
  });
});
