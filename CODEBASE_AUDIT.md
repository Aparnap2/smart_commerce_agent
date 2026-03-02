# Codebase Audit: Leveraging Existing Assets for Protocol-First Implementation

## Executive Summary

This audit identifies **existing assets** in the Smart Commerce Agent codebase that can be leveraged for the protocol-first implementation, and **gaps** that need to be filled.

---

## Phase-by-Phase Audit

### Phase 0: Product Demo Slice

| Component | Existing Code | Location | Status | Gap/Action |
|-----------|--------------|----------|--------|------------|
| Store Catalog | ❌ | - | **NEW** | Create `app/(store)/store/page.tsx` |
| ProductGrid | ✅ | `app/dashboard/components/genui/product-card.tsx` | **READY** | Reuse `ProductGrid`, `ProductCard` |
| ProductCard | ✅ | `app/dashboard/components/genui/product-card.tsx` | **READY** | Already has quantity selector, add to cart |
| SearchBar | ❌ | - | **NEW** | Create using shadcn Input + agent integration |
| FilterSidebar | ❌ | - | **NEW** | Create using shadcn Checkbox, Slider |
| Cart Drawer | ❌ | - | **NEW** | Create using shadcn Drawer |
| Checkout Wizard | ❌ | - | **NEW** | Create wizard with shadcn Steps |
| Orders Page | ⚠️ | `app/dashboard/components/genui/order-card.tsx` | **PARTIAL** | Extend for `/orders` route |
| CopilotKit | ❌ | - | **NEW** | Integrate CopilotKit sidebar |

---

### Phase 1: shadcn Storefront + GenUI Contract

| Component | Existing Code | Location | Status | Gap/Action |
|-----------|--------------|----------|--------|------------|
| GenUI Registry | ❌ | - | **NEW** | Create `lib/genui/registry.ts` |
| GenUI Adapter | ❌ | - | **NEW** | Create `lib/genui/adapter.ts` |
| ProductGrid Component | ✅ | `app/dashboard/components/genui/product-card.tsx:489` | **READY** | Reuse existing |
| ProductCard Component | ✅ | `app/dashboard/components/genui/product-card.tsx:289` | **READY** | Full-featured with stock, rating, specs |
| CartDrawer Component | ❌ | - | **NEW** | Build on shadcn Drawer |
| CheckoutWizard | ❌ | - | **NEW** | Build on shadcn Steps |
| OrderConfirmation | ⚠️ | `app/dashboard/components/genui/order-card.tsx` | **PARTIAL** | Extract confirmation view |
| OrderTracking | ⚠️ | `app/dashboard/components/genui/order-card.tsx` | **PARTIAL** | Add tracking events |
| OrderHistoryGrid | ⚠️ | `app/dashboard/components/genui/order-card.tsx` | **PARTIAL** | Create list view |

---

### Phase 2: MCP-First Commerce Tool Suite

#### Cart Tools

| Tool | Existing Code | Location | Status | Gap/Action |
|------|--------------|----------|--------|------------|
| `cart.get` | ✅ | `lib/mcp/tools.ts:383-414` | **READY** | Returns `CartToolResult` |
| `cart.add_item` | ✅ | `lib/mcp/tools.ts:416-461` | **READY** | Basic implementation |
| `cart.update_quantity` | ❌ | - | **NEW** | Add to tools |
| `cart.remove_item` | ❌ | - | **NEW** | Add to tools |
| `cart.apply_coupon` | ❌ | - | **NEW** | Add to tools |
| `cart.clear` | ❌ | - | **NEW** | Add to tools |

**Existing Cart Code** (`lib/mcp/tools.ts`):
```typescript
// Already implemented: get_cart, add_to_cart
tools.set('get_cart', createTool('get_cart', {...}));
tools.set('add_to_cart', createTool('add_to_cart', {...}));

// NEEDED: quantity update, remove, clear, coupon
```

#### Orders Tools

| Tool | Existing Code | Location | Status | Gap/Action |
|------|--------------|----------|--------|------------|
| `orders.create_from_cart` | ❌ | - | **NEW** | Create order from cart |
| `orders.get` | ✅ | `lib/mcp/tools.ts:60-97` | **READY** | Returns order details |
| `orders.list` | ✅ | `lib/mcp/tools.ts:99-131` | **READY** | With status filter |
| `orders.cancel` | ❌ | - | **NEW** | Add cancel logic |
| `orders.refund` | ⚠️ | `lib/mcp/tools.ts:214-252` | **PARTIAL** | Create refund, needs Stripe |

**Existing Orders Code**:
```typescript
// Already implemented: get_order, list_orders
tools.set('get_order', createTool('get_order', {...}));
tools.set('list_orders', createTool('list_orders', {...}));

// NEEDED: create_from_cart, cancel, full refund
```

#### Search Tools

| Tool | Existing Code | Location | Status | Gap/Action |
|------|--------------|----------|--------|------------|
| `catalog.search` | ⚠️ | `lib/mcp/tools.ts:158-210` | **PARTIAL** | Has `search_products` |
| `catalog.autocomplete` | ❌ | - | **NEW** | Add OpenSearch suggester |
| `catalog.recommendations` | ❌ | - | **NEW** | Use hybrid search |

**Existing Search Code** (`lib/search/hybrid.ts`):
```typescript
// FULLY IMPLEMENTED: hybrid search with BM25 + pgvector RRF
export async function hybridSearch(params: {...}) {...}
export async function searchProducts(query: string, options: {...}) {...}
export async function searchWithPreferences(query: string, userId: string) {...}
```

#### Refund Tools

| Tool | Existing Code | Location | Status | Gap/Action |
|------|--------------|----------|--------|------------|
| `refunds.create` | ✅ | `lib/agents/refund.ts` | **READY** | Full refund workflow |
| `refunds.get` | ✅ | `lib/mcp/tools.ts:254-282` | **READY** | Status check |

**Existing Refund Code**:
- `lib/agents/refund.ts` - Agent for refund processing
- `lib/stripe/client.ts` - Full Stripe SDK with types
- `lib/stripe/refund.ts` - Refund webhook handler

---

### Phase 3: UCP as Backbone

| Component | Existing Code | Location | Status | Gap/Action |
|-----------|--------------|----------|--------|------------|
| UCP Types | ✅ | `lib/ucp/types.ts` | **MOCK** | Extend with real actions |
| UCP Protocol | ✅ | `lib/ucp/protocol.ts` | **MOCK** | Connect to real tools |
| Schema.org Schemas | ✅ | `lib/schemas/commerce.ts` | **READY** | 631 lines of Zod schemas! |

**Existing UCP Code** (`lib/ucp/types.ts`):
```typescript
// Already defined:
export interface UCPOffer {...}
export interface UCPPayment {...}
export interface UCPOrder {...}
export interface UCPCustomer {...}

// NEEDED: Add UCPMessage with actions
export type UCPAction = 
  | 'SEARCH_PRODUCTS' | 'ADD_TO_CART' | 'CREATE_CHECKOUT' ...
```

**Existing Schema.org Schemas** (`lib/schemas/commerce.ts:631`):
```typescript
// FULLY IMPLEMENTED - 631 lines of schemas!
export const ProductSchema = z.object({...})
export const OrderSchema = z.object({...})
export const RefundSchema = z.object({...})
export const ShoppingCartSchema = z.object({...})
export const SupportTicketSchema = z.object({...})
```

---

### Phase 4: Stripe via MCP

| Component | Existing Code | Location | Status | Gap/Action |
|-----------|--------------|----------|--------|------------|
| Stripe Client | ✅ | `lib/stripe/client.ts` | **READY** | Full typed SDK wrapper |
| Refund Logic | ✅ | `lib/stripe/refund.ts` | **READY** | Webhook handling |
| Create Checkout | ❌ | - | **NEW** | Add checkout session tool |
| Payment Intent | ❌ | - | **NEW** | Add payment intent tool |

**Existing Stripe Code** (`lib/stripe/client.ts:339`):
```typescript
// FULLY IMPLEMENTED:
export async function createRefund(params: CreateRefundParams): Promise<RefundResult> {...}
export async function getRefund(refundId: string): Promise<RefundResult> {...}
export async function getPaymentIntent(paymentIntentId: string): Promise<PaymentIntentInfo> {...}
export function verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {...}
export function calculateRefundableAmount(paymentIntent: PaymentIntentInfo): number {...}
export function isRefundable(paymentIntent: PaymentIntentInfo): boolean {...}
```

---

### Phase 5: OpenSearch + Analytics

| Component | Existing Code | Location | Status | Gap/Action |
|-----------|--------------|----------|--------|------------|
| Hybrid Search | ✅ | `lib/search/hybrid.ts` | **READY** | BM25 + pgvector |
| Qdrant Integration | ✅ | `lib/agents/tools.ts:129-220` | **READY** | Vector search |
| OpenSearch | ❌ | - | **NEW** | Add OpenSearch adapter |
| Analytics | ❌ | - | **NEW** | Build dashboard |

---

## Detailed Gap Analysis

### 1. MCP Server (`lib/mcp/server.ts`)

**Status**: ✅ FULLY IMPLEMENTED
- `ECatalogMCPServer` class with tool registration
- `createTool` helper function
- Zod schema validation
- User context enforcement

```typescript
// lib/mcp/server.ts - Already ready to use!
export class ECatalogMCPServer {
  registerTool(name: string, tool: Tool): void {...}
  async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {...}
}

export function createTool<T extends z.ZodType>(
  name: string,
  options: {...}
): Tool<z.infer<T>> {...}
```

### 2. Tool Types (`lib/mcp/types.ts`)

**Status**: ✅ FULLY IMPLEMENTED
- `Tool` interface with Zod parameters
- `ToolResult`, `ToolError`, `ToolErrorCode`
- Category definitions
- Specific result types (`OrderToolResult`, `ProductToolResult`, etc.)

### 3. Agent Supervisor (`lib/agents/supervisor.ts`)

**Status**: ✅ FULLY IMPLEMENTED
- LangGraph-based workflow
- Intent classification
- Tool execution routing
- Response generation

```typescript
// lib/agents/supervisor.ts - Ready to extend!
export async function runSupervisor(
  input: { message: string; threadId: string; userId: string },
  checkpointer?: AnyCheckpointer
): Promise<typeof StateAnnotation.State> {...}
```

### 4. Hybrid Search (`lib/search/hybrid.ts`)

**Status**: ✅ FULLY IMPLEMENTED
- BM25 full-text search
- pgvector similarity search
- Reciprocal Rank Fusion for hybrid results
- Context-aware search routing

### 5. LLM Provider (`lib/llm/provider.ts`)

**Status**: ✅ FULLY IMPLEMENTED
- OpenAI/Ollama abstraction
- Chat completion with streaming support
- Embedding generation

### 6. Observability (`lib/observability/`)

**Status**: ✅ FULLY IMPLEMENTED
- Langfuse integration
- Scoring metrics

---

## Implementation Priority Based on Existing Code

### HIGHEST PRIORITY - Reuse Existing

| # | Task | Leverage Existing |
|---|------|------------------|
| 1 | Cart Tools | Extend `lib/mcp/tools.ts` with quantity update, remove, clear |
| 2 | Orders Tool | Extend with `create_from_cart`, `cancel` |
| 3 | UCP Contract | Extend `lib/ucp/types.ts` with action types |
| 4 | Checkout Tool | Add Stripe checkout session to `lib/mcp/tools.ts` |
| 5 | GenUI Registry | Create `lib/genui/registry.ts` using existing schemas |

### MEDIUM PRIORITY - Build New

| # | Task | Leverage Existing |
|---|------|------------------|
| 6 | Store Pages | Reuse `ProductGrid`, `ProductCard` from dashboard |
| 7 | Cart Drawer | Build on shadcn Drawer |
| 8 | Checkout Wizard | Build on shadcn Steps |
| 9 | Orders Page | Extend `order-card.tsx` component |

### LOWER PRIORITY - Future

| # | Task | Leverage Existing |
|---|------|------------------|
| 10 | OpenSearch | Add to existing search architecture |
| 11 | Analytics | Build on existing Langfuse |

---

## Code Statistics

| Category | Lines of Code | Status |
|----------|---------------|--------|
| MCP Server | 347 | ✅ Ready |
| MCP Tools | 476 | ✅ Ready (partial) |
| UCP Types | 170 | ✅ Ready (mock) |
| UCP Protocol | 430 | ✅ Ready (mock) |
| Commerce Schemas | 631 | ✅ Ready |
| Hybrid Search | 429 | ✅ Ready |
| Agent Supervisor | 558 | ✅ Ready |
| Stripe Client | 339 | ✅ Ready |
| GenUI Components | ~500 | ✅ Ready (dashboard) |
| **TOTAL** | **~3,880** | **Mostly Ready** |

---

## Action Items Summary

### Immediate (This Week)

1. **Add to Cart Tool** → Already exists in `lib/mcp/tools.ts:416-461`
2. **Quantity Update Tool** → Need to add
3. **Remove from Cart Tool** → Need to add
4. **Checkout Session Tool** → Need to add using Stripe

### This Month

5. **UCP Real Contract** → Extend existing `lib/ucp/types.ts`
6. **GenUI Registry** → Create using existing schemas
7. **Store Pages** → Reuse dashboard components
8. **Cart Drawer** → Build on shadcn

### Future

9. **OpenSearch** → Add to existing hybrid search
10. **Analytics** → Build on Langfuse

---

## Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `lib/mcp/tools.ts` | EXTEND | Add cart quantity, remove, checkout |
| `lib/ucp/types.ts` | EXTEND | Add real UCP actions |
| `lib/ucp/protocol.ts` | EXTEND | Connect to real tools |
| `lib/genui/registry.ts` | CREATE | GenUI component types |
| `lib/genui/adapter.ts` | CREATE | Tool → GenUI mapper |
| `app/(store)/store/page.tsx` | CREATE | Catalog page |
| `app/(store)/checkout/page.tsx` | CREATE | Checkout wizard |
| `app/(store)/orders/page.tsx` | CREATE | Orders list |
| `components/commerce/cart-drawer.tsx` | CREATE | Cart drawer |

---

## Conclusion

The Smart Commerce Agent codebase has **~3,880 lines of production-ready code** that can be leveraged for the protocol-first implementation. The main gaps are:

1. **Cart tools** - Basic add exists, need update/remove
2. **UCP contract** - Mock exists, need real implementation
3. **Checkout flow** - Need Stripe session creation
4. **Frontend pages** - Need shadcn storefront

With an estimated **2-3 weeks** of focused work, the full protocol-first commerce platform can be implemented by building on this solid foundation.
