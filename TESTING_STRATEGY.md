# TDD Testing Strategy - Smart Commerce Agent

## Testing Pyramid

```
                    ┌─────────────┐
                    │    E2E     │  ← Playwright (Full flows)
                    │   Tests    │
          ┌─────────┴───────────┴─────────┐
          │      Integration Tests          │  ← API + Tool testing
          │   (Unit with mocked DB)         │
┌─────────┴────────────────────────────────┴─────────┐
│                    Unit Tests                           │  ← Pure functions
│              (Vitest + Mocked Prisma)                  │
└────────────────────────────────────────────────────────┘
```

## Test Types

| Type | Framework | Target | Evidence |
|------|-----------|--------|----------|
| **Unit** | Vitest | Pure functions, tools | Code coverage |
| **Integration** | Vitest + Mock Prisma | MCP tools | Pass/Fail |
| **E2E** | Playwright | Full flows | Screenshots/Logs |
| **LLM Eval** | Langfuse | Agent responses | Scores/Traces |

---

## Current Test Infrastructure

### 1. Unit Tests (Vitest)
```bash
npm test -- tests/unit/
```

### 2. Integration Tests
```bash
npm test -- tests/integration/
```

### 3. E2E Tests (Playwright)
```bash
npm run test:e2e
```

### 4. LLM Evaluation (Langfuse)
Already integrated in `lib/observability/`

---

## Execution Plan

### Phase 1: Unit Tests
1. Run existing unit tests
2. Add tests for new search functions
3. Add tests for cart tools

### Phase 2: Integration Tests  
1. Test MCP tool interfaces
2. Test UCP protocol
3. Test GenUI adapter

### Phase 3: E2E Tests
1. Full commerce flow
2. Checkout flow
3. Order tracking

### Phase 4: LLM Evaluation
1. Agent response quality
2. Search relevance
3. Tool accuracy

---

## Expected Evidence

Each test run will produce:
- **Pass/Fail status** - Green checkmarks
- **Coverage reports** - HTML output
- **E2E screenshots** - Visual proof
- **Langfuse traces** - LLM quality metrics

---

## Running All Tests

```bash
# Full test suite
npm test && npm run test:e2e

# With coverage
npm test -- --coverage

# Specific test file
npm test -- tests/unit/search/hybrid-fts.test.ts
```
