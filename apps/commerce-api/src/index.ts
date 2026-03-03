import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createYoga } from 'graphql-yoga';
import { serve } from '@hono/node-server';
import { db } from './db/client.js';
import { authMiddleware } from './middleware/auth.js';
import { createGraphQLSchema } from './graphql/schema.js';
import { createMCPRegistry } from './mcp/registry.js';

// Define Hono context types
type Variables = {
  userId: string | null;
  role: string | null;
};

const app = new Hono<{ Variables: Variables }>();

// Middleware
app.use(logger());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'],
  credentials: true,
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Auth middleware for protected routes
app.use('/graphql', authMiddleware);
app.use('/mcp/*', authMiddleware);

// GraphQL Yoga
const yoga = createYoga<{ userId: string | null }>({
  schema: createGraphQLSchema(db),
  context: async ({ request }) => {
    // Access Hono's context from the custom property we set
    const userId = (request as unknown as { userId: string | null }).userId ?? null;
    return {
      db,
      userId,
    };
  },
  graphqlEndpoint: '/graphql',
});

app.use('/graphql', async (c) => {
  // Pass Hono context to Yoga through request property
  const request = c.req.raw;
  (request as unknown as { userId: string | null }).userId = c.get('userId') ?? null;
  const response = await yoga.handle(request);
  return response;
});

// MCP REST endpoints
const mcpRoutes = createMCPRegistry(db);
app.route('/mcp', mcpRoutes);

// Start server
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Export for serverless environments
export default {
  port,
  fetch: app.fetch,
};

// For direct execution with node/tsx - check if this file is the entry point
const isMainModule = process.argv[1]?.includes('index.ts') || process.argv[1]?.includes('index.js');

if (isMainModule) {
  console.log(`🚀 Commerce API running on http://localhost:${port}`);
  console.log(`📊 GraphQL endpoint: http://localhost:${port}/graphql`);
  console.log(`🔧 MCP endpoints: http://localhost:${port}/mcp/tool/*`);
  
  serve({
    fetch: app.fetch,
    port,
  });
}
