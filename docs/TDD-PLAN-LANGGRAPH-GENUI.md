# TDD Plan: LangGraph GenUI + MCP + UCP + A2I

## Architecture Decision

**Choice**: LangGraph Generative UI with OpenAI SDK for LLM

**Rationale**:
- Already integrated: `@langchain/langgraph`, `@langchain/core`, `langchain`
- OpenAI SDK compatible with LangGraph
- `typedUi` for component streaming
- `useStream()` + `LoadExternalComponent` for client-side rendering
- Shadow DOM for style isolation

## Stack

| Component | Technology |
|-----------|------------|
| **LLM** | OpenAI SDK (`openai`) + Ollama backend |
| **GenUI** | `@langchain/langgraph-sdk/react-ui` |
| **State** | Zustand (existing) |
| **UI Components** | Existing GenUI components + new ones |
| **Protocols** | MCP (existing), UCP (mock), LangGraph A2I |

## Implementation Phases

### Phase 1: Authentication (Hardcoded)
```
lib/auth/store.ts           # Auth store with hardcoded credentials
tests/unit/auth.test.ts     # Auth tests
```

### Phase 2: LangGraph GenUI Integration
```
lib/langgraph/ui.tsx        # UI component definitions
langgraph.json              # LangGraph config with UI section
lib/langgraph/agent.ts      # LangGraph agent with typedUi
tests/unit/genui.test.ts    # GenUI tests
```

### Phase 3: Tool Call Display & Transparency
```
lib/components/tool-call-display.tsx  # MCP tool visualization
lib/components/tool-execution-list.tsx # Tool execution timeline
tests/unit/tool-display.test.ts       # Tool display tests
```

### Phase 4: UCP Protocol Integration
```
lib/ucp/types.ts            # UCP type definitions
lib/ucp/protocol.ts         # UCP mock implementation
tests/unit/ucp.test.ts      # UCP tests
```

### Phase 5: Chrome DevTools MCP Testing
```
tests/e2e/mcp-devtools.test.ts  # Browser automation
scripts/chrome-mcp-test.js      # MCP test script
```

## Test Strategy

### Unit Tests (TDD)
```typescript
// auth.test.ts
describe('AuthStore', () => {
  it('should login with valid credentials')
  it('should reject invalid password')
  it('should persist session')
});

// genui.test.ts
describe('LangGraph GenUI', () => {
  it('should render ProductCard component')
  it('should emit UI via typedUi')
  it('should handle loading state')
});

// tool-display.test.ts
describe('ToolCallDisplay', () => {
  it('should show executing tool with animation')
  it('should show completed tool with checkmark')
  it('should show error state')
});

// ucp.test.ts
describe('UCP Protocol', () => {
  it('should create direct offer')
  it('should process mock payment')
});
```

### E2E Tests (Chrome DevTools MCP)
```typescript
// mcp-devtools.test.ts
describe('Chrome DevTools MCP', () => {
  it('should connect to browser via MCP')
  it('should execute tool and capture logs')
  it('should verify UI updates in real-time')
});
```

## Key Files Structure

```
lib/
├── auth/
│   ├── index.ts
│   └── store.ts
├── langgraph/
│   ├── index.ts
│   ├── agent.ts
│   └── ui.tsx              # UI component map
├── ucp/
│   ├── index.ts
│   ├── types.ts
│   └── protocol.ts
├── components/
│   ├── tool-call-display.tsx
│   ├── tool-execution-list.tsx
│   └── genui/
│       └── ...existing...
├── mcp/
│   ├── index.ts
│   ├── tools.ts
│   └── rag-tools.ts
└── stores/
    ├── agent-store.ts      # existing
    └── auth-store.ts       # new

tests/unit/
├── auth.test.ts
├── genui.test.ts
├── tool-display.test.ts
└── ucp.test.ts

tests/e2e/
└── mcp-devtools.test.ts

langgraph.json              # LangGraph config with UI
```

## Execution Steps

1. **Phase 1**: Auth Store → Tests → UI
2. **Phase 2**: LangGraph Config → UI Components → typedUi Integration
3. **Phase 3**: Tool Display → Tool Execution List → MCP Integration
4. **Phase 4**: UCP Types → UCP Protocol → Commerce Flow
5. **Phase 5**: Chrome DevTools → MCP Test Script → E2E Verification

## Success Criteria

- [ ] All unit tests pass (>90% coverage)
- [ ] Real browser automation with Chrome DevTools MCP
- [ ] Tool calls displayed with status indicators
- [ ] User can login with hardcoded credentials
- [ ] GenUI components render via LangGraph
- [ ] UCP commerce flow works with mock data
- [ ] Server logs show MCP tool execution with timing
