# TDD Plan: A2UI + UCP + MCP Integration

## Overview

Implementing Google A2UI (Generative UI), UCP (Universal Commerce Protocol), and MCP (Model Context Protocol) with full transparency, authentication, and browser testing.

## Architecture Decision

**Choice**: Vercel AI SDK's native Generative UI pattern (via @ai-sdk/react)

**Rationale**:
- Already integrated: `@ai-sdk/react`, `langchain`, `@langchain/langgraph`
- Zustand store already has tool call tracking
- Existing GenUI components: ProductCard, OrderCard, TicketStatus
- Best DX for React/Next.js stack

## Implementation Plan

### Phase 1: Authentication (Hardcoded)
```
lib/auth/store.ts       # Auth store with hardcoded credentials
tests/unit/auth.test.ts # Auth tests
```

### Phase 2: Tool Call Display & Transparency
```
lib/components/tool-call-display.tsx  # MCP tool visualization
lib/components/tool-call-list.tsx     # Tool execution list
tests/unit/tool-display.test.ts       # Tool display tests
```

### Phase 3: UCP Protocol Integration
```
lib/ucp/protocol.ts      # UCP mock implementation
lib/ucp/types.ts         # UCP type definitions
tests/unit/ucp.test.ts   # UCP tests
```

### Phase 4: Chrome DevTools MCP Testing
```
tests/e2e/mcp-devtools.test.ts  # Browser automation tests
scripts/mcp-devtools-test.js    # Chrome MCP test script
```

## Test Strategy

### Unit Tests (TDD)
```typescript
// auth.test.ts
describe('AuthStore', () => {
  it('should login with valid credentials', async () => {
  it('should reject invalid password', async () => {
  it('should persist session', async () => {
});

// tool-display.test.ts
describe('ToolCallDisplay', () => {
  it('should show executing tool', async () => {
  it('should show completed tool', async () => {
  it('should show tool error', async () => {
});

// ucp.test.ts
describe('UCP Protocol', () => {
  it('should create direct offer', async () => {
  it('should process payment', async () => {
});
```

### E2E Tests (Chrome DevTools MCP)
```typescript
// mcp-devtools.test.ts
describe('Chrome DevTools MCP', () => {
  it('should connect to browser', async () => {
  it('should execute tool via MCP', async () => {
  it('should show tool calls in UI', async () => {
});
```

## Key Components

### 1. Auth Store (Zustand)
```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  sessionExpiry: number;
}

// Hardcoded credentials (for demo)
const DEMO_USERS = {
  'user@techtrend.com': 'password123',
  'admin@techtrend.com': 'admin456',
};
```

### 2. Tool Call Display
```typescript
interface ToolCallEvent {
  id: string;
  tool: string;
  status: 'pending' | 'executing' | 'completed' | 'error';
  startTime: number;
  endTime?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}
```

### 3. UCP Protocol Types
```typescript
interface UCPOffer {
  id: string;
  productId: string;
  price: number;
  terms: string;
  validUntil: Date;
}

interface UCPPayment {
  id: string;
  offerId: string;
  amount: number;
  status: 'pending' | 'authorized' | 'captured' | 'failed';
}
```

## Execution Order

1. **Auth Tests** → Auth Store → Auth UI
2. **Tool Display Tests** → Tool Call Component → Integration
3. **UCP Tests** → UCP Protocol → Commerce UI
4. **E2E Tests** → Chrome DevTools MCP

## Success Criteria

- [ ] All unit tests pass (>90% coverage)
- [ ] Real browser automation with Chrome DevTools
- [ ] Tool calls displayed with status icons
- [ ] User can login with hardcoded credentials
- [ ] UCP commerce flow works with mock data
- [ ] Server logs show MCP tool execution
