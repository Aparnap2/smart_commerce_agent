#!/usr/bin/env node
/**
 * Mock API Server for E2E Tests
 *
 * Serves mock API endpoints based on mockoon-environment.json
 * Run: node mocks/mock-server.js
 */

import http from 'http';
import { URL } from 'url';

const PORT = process.env.MOCKOON_PORT || 3000;

// Mock data store
const mockData = {
  health: {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      ollama: process.env.OLLAMA_URL || 'http://localhost:11434',
      supabase: process.env.SUPABASE_URL || 'http://localhost:8000'
    }
  },

  products: [
    { id: 'prod-001', name: 'Laptop Pro 15', description: 'High-performance laptop for professionals', price: 1299.99, category: 'Electronics', stock: 50 },
    { id: 'prod-002', name: 'Wireless Mouse', description: 'Ergonomic wireless mouse with long battery life', price: 49.99, category: 'Accessories', stock: 200 },
    { id: 'prod-003', name: 'USB-C Hub', description: '7-in-1 USB-C hub with HDMI and ethernet', price: 79.99, category: 'Accessories', stock: 75 }
  ],

  orders: [
    { id: 'ord-001', customer_email: 'test@example.com', status: 'shipped', total: 199.99, created_at: new Date().toISOString() },
    { id: 'ord-002', customer_email: 'test@example.com', status: 'processing', total: 79.99, created_at: new Date().toISOString() }
  ],

  tickets: [
    { id: 'tkt-001', subject: 'Order not received', status: 'open', priority: 'high', customer_email: 'test@example.com', created_at: new Date().toISOString() }
  ],

  analytics: {
    dashboard: { total_orders: 1250, total_revenue: 125000, open_tickets: 15, avg_response_time: '2.5 hours', customer_satisfaction: 4.5, period: 'last_30_days' },
    orders: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], data: [45, 52, 38, 65, 72, 89, 95] }
  }
};

// UUID generator
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// JWT mock
function jwt() {
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + btoa(JSON.stringify({ exp: Date.now() + 3600000 }));
}

// Request handler
const handler = (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;
  const headers = req.headers;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Log requests
  console.log(`${method} ${path}`);

  // Route matching
  try {
    // Health check
    if (path === '/api/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockData.health));
      return;
    }

    // Auth: Login
    if (path === '/api/auth/login' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const { email } = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            access_token: jwt(),
            refresh_token: uuid(),
            user: { id: uuid(), email: email || 'test@example.com', role: 'customer' },
            session_id: uuid()
          }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Auth: Logout
    if (path === '/api/auth/logout' && method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Logged out successfully' }));
      return;
    }

    // Products: List
    if (path === '/api/products' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockData.products));
      return;
    }

    // Products: Single
    if (path.match(/^\/api\/products\/.+$/) && method === 'GET') {
      const id = path.split('/').pop();
      const product = mockData.products.find(p => p.id === id) || { id, name: `Product ${id}`, description: 'Mock product', price: 99.99, category: 'General', stock: 100 };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(product));
      return;
    }

    // Orders: List
    if (path === '/api/orders' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockData.orders));
      return;
    }

    // Orders: Single
    if (path.match(/^\/api\/orders\/.+$/) && method === 'GET') {
      const id = path.split('/').pop();
      const order = mockData.orders.find(o => o.id === id) || { id, customer_email: 'test@example.com', status: 'shipped', total: 199.99, items: [{ name: 'Product A', quantity: 2, price: 99.99 }], tracking_number: `TRK-${Date.now()}`, created_at: new Date().toISOString() };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(order));
      return;
    }

    // Orders: Refund
    if (path.match(/^\/api\/orders\/.+\/refund$/) && method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        refund_id: `ref-${uuid()}`,
        status: 'pending',
        amount: 99.99,
        message: 'Refund request submitted for review'
      }));
      return;
    }

    // Tickets: List
    if (path === '/api/tickets' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockData.tickets));
      return;
    }

    // Tickets: Create
    if (path === '/api/tickets' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const newTicket = {
            id: uuid(),
            ticket_number: `TKT-${Date.now()}`,
            subject: data.subject || 'New Ticket',
            status: 'open',
            message: 'Ticket created successfully',
            created_at: new Date().toISOString()
          };
          mockData.tickets.push(newTicket);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(newTicket));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Tickets: Update
    if (path.match(/^\/api\/tickets\/.+$/) && method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const id = path.split('/').pop();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id, status: data.status || 'pending', updated_at: new Date().toISOString() }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Tickets: Add Message
    if (path.match(/^\/api\/tickets\/.+\/messages$/) && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const ticketId = path.split('/')[3];
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: uuid(),
            ticket_id: ticketId,
            content: data.content || '',
            author_type: 'customer',
            created_at: new Date().toISOString()
          }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Search: Semantic
    if (path === '/api/search/semantic' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([
          { id: 'prod-001', name: 'Laptop Pro 15', similarity: 0.95, category: 'Electronics' },
          { id: 'prod-002', name: 'Wireless Mouse', similarity: 0.82, category: 'Accessories' }
        ]));
      });
      return;
    }

    // Inventory
    if (path.match(/^\/api\/inventory\/.+$/) && method === 'GET') {
      const productId = path.split('/').pop();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        productId,
        available: true,
        quantity: 100,
        location: 'main-warehouse',
        restock_date: null
      }));
      return;
    }

    // Analytics: Dashboard
    if (path === '/api/analytics/dashboard' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockData.analytics.dashboard));
      return;
    }

    // Analytics: Orders
    if (path === '/api/analytics/orders' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockData.analytics.orders));
      return;
    }

    // Webhooks: Stripe
    if (path === '/api/webhooks/stripe' && method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true, type: data.type || 'unknown', message: 'Webhook received' }));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // Chat: Route Ollama (mock)
    if (path === '/api/chat/route-ollama' && method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: uuid(),
        object: 'chat.completion',
        created: Date.now(),
        model: 'qwen2.5-coder:3b',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'This is a mock response for testing. In production, this routes to Ollama.\n\nTo use real Ollama, ensure the container is running on port 11434.' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 15, completion_tokens: 30, total_tokens: 45 }
      }));
      return;
    }

    // Chat: Stream
    if (path === '/api/chat/stream' && method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.flushHeaders();

      const chunks = [
        `data: ${JSON.stringify({ id: uuid(), object: 'chat.completion.chunk', created: Date.now(), model: 'qwen2.5-coder:3b', choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] })}\n\n`,
        `data: ${JSON.stringify({ id: uuid(), object: 'chat.completion.chunk', created: Date.now(), model: 'qwen2.5-coder:3b', choices: [{ index: 0, delta: { content: 'Mock' }, finish_reason: null }] })}\n\n`,
        `data: ${JSON.stringify({ id: uuid(), object: 'chat.completion.chunk', created: Date.now(), model: 'qwen2.5-coder:3b', choices: [{ index: 0, delta: { content: ' response' }, finish_reason: null }] })}\n\n`,
        'data: [DONE]\n\n'
      ];

      chunks.forEach((chunk, i) => {
        setTimeout(() => res.write(chunk), i * 100);
      });

      setTimeout(() => res.end(), 500);
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path, method }));
  } catch (error) {
    console.error('Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
};

// Start server
const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`Mock API Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/health');
  console.log('  POST /api/auth/login');
  console.log('  POST /api/auth/logout');
  console.log('  GET  /api/products');
  console.log('  GET  /api/products/:id');
  console.log('  GET  /api/orders');
  console.log('  GET  /api/orders/:id');
  console.log('  POST /api/orders/:id/refund');
  console.log('  GET  /api/tickets');
  console.log('  POST /api/tickets');
  console.log('  PUT  /api/tickets/:id');
  console.log('  POST /api/tickets/:id/messages');
  console.log('  POST /api/search/semantic');
  console.log('  GET  /api/inventory/:productId');
  console.log('  GET  /api/analytics/dashboard');
  console.log('  GET  /api/analytics/orders');
  console.log('  POST /api/webhooks/stripe');
  console.log('  POST /api/chat/route-ollama');
  console.log('  POST /api/chat/stream');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
});
