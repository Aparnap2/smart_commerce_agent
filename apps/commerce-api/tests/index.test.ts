import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index.js';

describe('Commerce API', () => {
  const baseUrl = 'http://localhost:3001';

  describe('Health Check', () => {
    it('should return ok status', async () => {
      const req = new Request(`${baseUrl}/health`);
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ok');
    });
  });

  describe('GraphQL Endpoint', () => {
    it('should respond to GraphQL introspection', async () => {
      const query = {
        query: `
          query {
            __schema {
              types {
                name
              }
            }
          }
        `,
      };

      const req = new Request(`${baseUrl}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.__schema.types).toBeDefined();
      expect(json.data.__schema.types.length).toBeGreaterThan(0);
    });

    it('should have required types', async () => {
      const query = {
        query: `
          query {
            __schema {
              types {
                name
              }
            }
          }
        `,
      };

      const req = new Request(`${baseUrl}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      const res = await app.fetch(req);
      const json = await res.json();
      const typeNames = json.data.__schema.types.map((t: { name: string }) => t.name);

      expect(typeNames).toContain('Query');
      expect(typeNames).toContain('Mutation');
      expect(typeNames).toContain('Product');
      expect(typeNames).toContain('Order');
      expect(typeNames).toContain('Cart');
      expect(typeNames).toContain('Refund');
      expect(typeNames).toContain('SupportTicket');
    });
  });

  describe('MCP Endpoints', () => {
    it('should have MCP health endpoint', async () => {
      const req = new Request(`${baseUrl}/mcp/health`);
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.service).toBe('mcp');
    });

    it('should get a product without auth', async () => {
      const req = new Request(`${baseUrl}/mcp/tool/get_product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId: 1 }),
      });

      const res = await app.fetch(req);
      // Should return 404 (product not found) or 200 (if exists)
      expect([200, 404]).toContain(res.status);
    });
  });
});
