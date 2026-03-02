# Smart Commerce Agent - Strategic Implementation Guide

## Executive Summary

This document provides a strategic roadmap for leveraging the existing Smart Commerce Agent codebase to build a **2026-ready agentic e-commerce platform**. The project already has a strong foundation with **hybrid search**, **MCP-style tools**, **LangGraph orchestration**, and **UCP protocol**. This guide maps existing components to the proposed feature catalogue and identifies gaps requiring implementation.

---

## Current Codebase Analysis

### Existing Infrastructure

| Layer | Current Implementation | Tech Stack |
|-------|----------------------|------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS | Next.js 15, React 19 |
| **Backend** | OpenAI SDK + Ollama (local) | OpenAI SDK, Ollama |
| **Database** | PostgreSQL + Prisma + pgvector | PostgreSQL, Prisma 6.7 |
| **AI Framework** | LangGraph (supervisor agent) | LangGraph 0.2 |
| **State** | Redis (checkpoints), Zustand | Redis, Zustand 5 |
| **Payments** | Stripe integration | Stripe SDK |
| **Search** | Hybrid (BM25 + pgvector) | Custom implementation |
| **Protocols** | UCP, MCP-style tools | Custom implementation |
| **Observability** | Langfuse | Langfuse SDK |

### Existing Components Summary

| Component | Location | Status |
|-----------|----------|--------|
| **Hybrid Search Engine** | `lib/search/hybrid.ts` | ✅ Implemented (BM25 + pgvector) |
| **Product Search Tool** | `lib/agents/tools.ts` | ✅ Implemented (Qdrant integration) |
| **Inventory Check Tool** | `lib/agents/tools.ts` | ✅ Implemented (Redis cached) |
| **Order Lookup Tool** | `lib/agents/tools.ts` | ✅ Implemented |
| **Refund Request Tool** | `lib/agents/tools.ts` | ✅ Implemented (Stripe) |
| **Supervisor Agent** | `lib/agents/supervisor.ts` | ✅ Implemented (LangGraph) |
| **UCP Protocol** | `lib/ucp/protocol.ts` | ✅ Mock implemented |
| **Secure MCP Tools** | `lib/mcp/tools.ts` | ✅ Implemented (with auth) |
| **Agent Store** | `lib/stores/agent-store.ts` | ✅ Implemented (Zustand) |
| **ToolCallDisplay (GenUI)** | `lib/components/index.ts` | ✅ Implemented |
| **Prisma Schema** | `prisma/schema.prisma` | ✅ Complete models |

---

## Feature-to-Code Mapping

### Phase 1: Core Commerce (Priority 1)

#### 1.1 Hybrid Product Search

**Target Feature**: BM25 keyword + pgvector semantic fusion

**Existing Code**:
- `lib/search/hybrid.ts` - Full hybrid search implementation with RRF
- `prisma/schema.prisma` - Product model with `Unsupported("vector")` embedding
- `lib/services/user-prefs.ts` - Query embedding generation

**Implementation Strategy**:
```typescript
// Leverage existing hybrid.ts
import { hybridSearch, searchProducts } from '@/lib/search/hybrid';

// Add to agent tools (lib/agents/tools.ts)
export async function hybridProductSearch(input: ProductSearchInput) {
  return searchProducts(input.query, { limit: input.limit });
}
```

**GenUI Component**: `<ProductGrid />` - Reuse dashboard component structure from `app/dashboard/components/genui/`

**Gaps to Fill**:
- OpenSearch integration (currently uses Qdrant)
- Autocomplete suggester endpoint
- Faceted filtering aggregations

---

#### 1.2 Conversational Search

**Target Feature**: "Wireless headphones for running under $100"

**Existing Code**:
- `lib/agents/supervisor.ts` - Intent classification via LLM
- `lib/agents/tools.ts` - `productSearch` with query parsing

**Implementation Strategy**:
```typescript
// Extend intent classification in supervisor.ts
const enhancedPrompt = `Classify into:
- product_search: "find/show/recommend products"
- conversational_search: "headphones for running", "laptop for gaming"
Extract: { query, filters: { priceRange, category, attributes } }`
```

**GenUI Component**: `<SearchBar />` + `<FilterSidebar />`

**Gaps to Fill**:
- NER (Named Entity Recognition) for product attributes
- Filter extraction from natural language

---

#### 1.3 Agentic Cart Management

**Target Feature**: Natural language cart operations

**Existing Code**:
- `lib/mcp/tools.ts` - `add_to_cart`, `get_cart` tools implemented
- `lib/agents/tools.ts` - Cart context available
- Prisma schema has Cart model support in MCP tools

**Implementation Strategy**:
```typescript
// Extend lib/mcp/tools.ts
tools.set('update_cart_quantity', createTool('update_cart_quantity', {
  title: 'Update Cart Quantity',
  description: 'Update quantity of item in cart',
  parameters: z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
  }),
  execute: async (args, userId) => {
    // Implementation using Prisma
  }
}));

tools.set('remove_from_cart', createTool('remove_from_cart', {...}));
```

**GenUI Components**:
- `<CartDrawer />` - Slide-in cart
- `<CartItem />` - Individual item
- `<CartSummary />` - Total display
- `<CartUpdated />` - Update notification

**Gaps to Fill**:
- Real-time cart totals (Redis pub/sub)
- Cart persistence across sessions (PostgreSQL)
- Smart quantity parsing ("double the quantity")

---

#### 1.4 Generative Checkout Flow

**Target Feature**: Conversational checkout with Stripe

**Existing Code**:
- `lib/stripe/refund.ts` - Stripe integration
- `lib/ucp/protocol.ts` - Payment workflow (mock)
- `prisma/schema.prisma` - Order, Refund models

**Implementation Strategy**:
```typescript
// Create checkout tools in lib/mcp/tools.ts
tools.set('create_checkout_session', createTool('create_checkout_session', {
  title: 'Create Checkout Session',
  parameters: z.object({
    cartId: z.string(),
    paymentMethod: z.enum(['card', 'wallet', 'bnpl']),
  }),
  execute: async (args, userId) => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: [args.paymentMethod],
      line_items: [...],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_URL}/checkout/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/checkout/cancel`,
    });
    return { sessionId: session.id, url: session.url };
  }
}));
```

**GenUI Components**:
- `<CheckoutWizard />` - Multi-step checkout
- `<AddressForm />` - Shipping address (leverage Customer model)
- `<PaymentSelector />` - Payment method selection
- `<OrderSummary />` - Review order
- `<SecurePayment />` - 3D Secure handling

**Gaps to Fill**:
- Dynamic address lookup from user profile
- Stripe Elements integration
- Order confirmation workflow

---

### Phase 2: Advanced Agentic (Priority 2)

#### 2.1 Personalized Recommendations

**Target Feature**: "Complete the look" suggestions

**Existing Code**:
- `prisma/schema.prisma` - UserEmbedding model for preference history
- `lib/search/hybrid.ts` - `searchWithPreferences` function
- `lib/agents/tools.ts` - Product search with similarity scoring

**Implementation Strategy**:
```typescript
// Extend in lib/search/hybrid.ts
export async function getRecommendations(
  userId: string,
  context: 'browse' | 'cart' | 'checkout',
  limit: number = 5
) {
  // 1. Get user's preference embedding
  const userEmbeddings = await prisma.userEmbedding.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  
  // 2. Aggregate preference vector
  const preferenceVector = aggregateEmbeddings(userEmbeddings);
  
  // 3. Vector search for similar products
  return searchProductsVector(preferenceVector, { limit });
}
```

**GenUI Component**: `<RecommendationCarousel />`

---

#### 2.2 Order Lifecycle Management

**Target Feature**: Order tracking, history, returns

**Existing Code**:
- `lib/mcp/tools.ts` - `get_order`, `list_orders` implemented
- `lib/agents/tools.ts` - `orderLookup` with tracking number
- `prisma/schema.prisma` - Order, OrderRefund models

**Implementation Strategy**:
```typescript
// Add to lib/mcp/tools.ts
tools.set('get_order_tracking', createTool('get_order_tracking', {
  title: 'Get Order Tracking',
  parameters: z.object({ orderId: z.string() }),
  execute: async (args) => {
    const order = await prisma.order.findUnique({ where: { id: args.orderId } });
    // Integrate carrier API (FedEx, UPS, etc.)
    return fetch(`https://api.carrier.com/track/${order.trackingNumber}`);
  }
}));

tools.set('create_return', createTool('create_return', {
  title: 'Create Return Request',
  parameters: z.object({
    orderId: z.string(),
    items: z.array(z.object({ productId: z.string(), quantity: z.number() })),
    reason: z.string(),
  }),
  execute: async (args, userId) => {
    // Create return in database
    // Trigger Stripe refund
  }
}));
```

**GenUI Components**:
- `<OrderConfirmation />` - Post-payment success
- `<OrderTracking />` - Real-time shipment
- `<OrderHistoryGrid />` - Past purchases
- `<ReturnRequest />` - Returns portal
- `<SubscriptionManager />` - Recurring orders

---

#### 2.3 Bundle Builder

**Target Feature**: "Outfit for beach vacation"

**Existing Code**:
- `lib/search/hybrid.ts` - Context-aware search
- `lib/agents/supervisor.ts` - Multi-step reasoning

**Implementation Strategy**:
```typescript
// New tool: lib/tools/bundle.ts
export async function buildBundle(context: string, budget: number) {
  // 1. Use LLM to decompose context into product categories
  const categories = await llm.decompose(`${context} under $${budget}`);
  
  // 2. Search each category
  const bundles = await Promise.all(
    categories.map(cat => searchProducts(cat.query, { limit: 3 }))
  );
  
  // 3. Optimize bundle for complementarity
  return optimizeBundle(bundles, budget);
}
```

**GenUI Component**: `<BundlePreview />`

---

#### 2.4 Price Drop Alerts

**Target Feature**: "Notify when under $100"

**Existing Code**:
- `lib/redis/client.ts` - Redis client available
- Prisma for database operations

**Implementation Strategy**:
```typescript
// New tool: lib/tools/alerts.ts
export async function createPriceAlert(
  userId: string,
  productId: string,
  targetPrice: number
) {
  // Store alert in Redis with TTL
  await redis.setex(
    `price_alert:${userId}:${productId}`,
    30 * 24 * 60 * 60, // 30 days
    JSON.stringify({ targetPrice, productId })
  );
  
  // Setup cron job to check prices
}

// Cron job checks daily and notifies via email/push
```

**GenUI Component**: `<PriceAlertForm />`

---

### Phase 3: Production Infrastructure (Priority 3)

#### 3.1 Multi-tenant Security

**Target Feature**: User isolation with RLS

**Existing Code**:
- `lib/mcp/tools.ts` - User context enforcement in all tools
- Prisma schema with customerId relationships

**Implementation Strategy**:
```sql
-- Add to migration
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only see own orders" ON "Order"
  FOR ALL USING ("customerId" = current_user_id());
```

**Gaps to Fill**:
- PostgreSQL RLS policies
- API rate limiting (Upstash Redis mentioned in catalogue)

---

#### 3.2 Observability

**Target Feature**: Full tracing with Langfuse

**Existing Code**:
- `lib/observability/langfuse.ts` - Langfuse integration
- `lib/observability/scoring.ts` - Metrics scoring

**Implementation Strategy**: Already implemented! Extend with custom traces for cart/checkout operations.

---

## Implementation Roadmap

### Week 1-2: Core Commerce

| Task | Existing Code | New Code Required |
|------|--------------|-------------------|
| Hybrid Search Enhancement | `lib/search/hybrid.ts` | OpenSearch adapter, autocomplete |
| Cart Management | `lib/mcp/tools.ts` add_to_cart | Quantity update, remove, persistence |
| Checkout Flow | Stripe SDK existing | Checkout session, address lookup |
| GenUI Components | ToolCallDisplay | ProductGrid, CartDrawer, CheckoutWizard |

### Week 3-4: Advanced Agentic

| Task | Existing Code | New Code Required |
|------|--------------|-------------------|
| Recommendations | UserEmbedding model | Preference aggregation, carousel |
| Order Tracking | Order model | Carrier API integration |
| Bundle Builder | Hybrid search | LLM decomposition, optimization |
| Price Alerts | Redis client | Alert CRUD, cron jobs |

### Week 5: Production Polish

| Task | Existing Code | New Code Required |
|------|--------------|-------------------|
| RLS Policies | Tools with userId | PostgreSQL policies |
| Rate Limiting | - | Upstash Redis integration |
| Admin Dashboard | - | SalesChart, SearchAnalytics |

---

## Conversational Flow Integration

The existing LangGraph supervisor (`lib/agents/supervisor.ts`) already handles intent classification. Extend it for commerce flows:

```typescript
// Updated intent classification
const COMMERCE_INTENTS = {
  product_search: 'find/show/recommend products',
  conversational_search: 'headphones for running under $100',
  cart_add: 'add to cart',
  cart_update: 'update quantity, remove item',
  checkout: 'checkout, buy now',
  order_tracking: 'track order, where is my order',
  returns: 'return item, refund',
  recommendations: 'similar items, complete the look'
};
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Smart Commerce Agent                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Frontend   │  │  Next.js 15  │  │  React 19    │          │
│  │  GenUI Comps │  │              │  │  Tailwind    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘          │
│         │                  │                                     │
│  ┌──────▼─────────────────▼────────────────────────────────┐   │
│  │              API Layer (/api/chat, /api/agent)          │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │         LangGraph Supervisor Agent                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │ Intent      │→ │ Tool        │→ │ Response    │    │   │
│  │  │ Classification│ │ Execution   │  │ Generation  │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │              MCP-Style Tools                             │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────┐  │   │
│  │  │Product    │ │Inventory  │ │Cart/      │ │Order   │  │   │
│  │  │Search     │ │Check      │ │Checkout   │ │Lookup  │  │   │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───┬────┘  │   │
│  └────────┼──────────────┼─────────────┼───────────┼───────┘   │
│           │              │             │           │            │
│  ┌────────▼──────────────▼─────────────▼───────────▼───────┐   │
│  │              Infrastructure Layer                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ ┌────────┐  │   │
│  │  │PostgreSQL│  │ Redis    │  │ Stripe   │ │Langfuse│  │   │
│  │  │+pgvector │  │ Cache    │  │ Payments │ │Tracing │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘ └────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Metrics Integration

The existing observability stack (`lib/observability/`) can track these metrics:

| Metric | Target | Implementation |
|--------|--------|----------------|
| Search-to-Cart | >25% | Add cart event tracking |
| Cart Abandonment | <30% | Track abandoned cart events |
| Checkout Completion | >85% | Funnel analytics |
| Recommendation CTR | >15% | Click-through tracking |
| P95 Search Latency | <100ms | Langfuse trace timing |

---

## Portfolio Demo Script

Based on existing components, demonstrate:

1. **Conversational Search** → "Find running shoes under $120"
   - Uses: `lib/search/hybrid.ts` + intent classification
   
2. **Natural Language Cart** → "Add the Nike React to cart"
   - Uses: `lib/mcp/tools.ts` add_to_cart

3. **Smart Checkout** → "Checkout to my home address"
   - Uses: Stripe integration + UCP protocol

4. **Order Tracking** → "Track my order"
   - Uses: Order model + tracking number display

5. **Admin Analytics** → Open Langfuse dashboard
   - Uses: Existing Langfuse integration

---

## Conclusion

The Smart Commerce Agent codebase provides a **strong foundation** for building a 2026-ready agentic e-commerce platform. The existing implementation of:

- **Hybrid search** (BM25 + pgvector)
- **LangGraph supervisor** with intent classification
- **MCP-style secure tools** with user context
- **UCP protocol** for standardized commerce
- **Zustand state management**
- **Stripe integration**
- **Langfuse observability**

...can be extended to achieve the full feature catalogue with focused development on:

1. Cart persistence and real-time updates (Redis)
2. Checkout wizard and payment flow (Stripe Elements)
3. Order tracking integration (Carrier APIs)
4. Recommendation engine enhancement
5. GenUI component library expansion

This positions the project as a **production-grade agentic commerce platform** demonstrating both cutting-edge AI patterns and practical e-commerce requirements.
