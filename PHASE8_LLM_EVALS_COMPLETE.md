# Phase 8: LLM Evaluations for Agentic AI Quality — Implementation Complete

## Overview

Implemented a comprehensive LLM evaluation system that answers: **"Does the agent make good decisions?"** (not just "does code work?").

The eval system tests three critical dimensions:
1. **Tool Selection** — Did agent call the RIGHT tool? (target: ≥90%)
2. **Parameter Quality** — Did agent extract correct arguments? (target: ≥85%)
3. **Hallucination Prevention** — Did agent fabricate data? (target: 100% prevention)

---

## Files Created

### 1. Eval Dataset: `apps/agent/src/evals/dataset.ts`
- **32 eval cases** covering all agent capabilities
- Custom matchers for flexible parameter validation (`expect_contains_any`, `expect_number_in_range`)
- Tags for categorization: `search`, `cart`, `orders`, `returns`, `no-tool`, `hallucination`, `params`, `multi-intent`

**Case breakdown:**
- Search: 6 cases (keyword, semantic, price filters, brand filters)
- Cart: 4 cases (view, add, quantity)
- Orders: 4 cases (list, tracking)
- Returns: 3 cases (initiate, inquiry)
- No-tool: 4 cases (greetings, general chat)
- Hallucination: 4 cases (specs, prices, stock, reviews)
- Parameter quality: 4 cases (price ranges, quantities)
- Multi-intent: 2 cases (complex queries)

### 2. Metrics Engine: `apps/agent/src/evals/metrics.ts`
- `scoreToolSelection()` — Checks expected/forbidden tools
- `scoreParamQuality()` — Validates extracted parameters with custom matchers
- `scoreHallucination()` — Prevents fabricated data
- `aggregateScores()` — Combines results with tag-based breakdown
- `meetsTargets()` — Validates against thresholds

### 3. Eval Runner: `apps/agent/src/evals/runner.ts`
- `runEvalCase()` — Execute single eval case
- `runEvalBatch()` — Parallel execution with concurrency control
- `runAllEvals()` — Full eval suite with summary
- `printEvalResults()` — Console output formatter

### 4. Vitest Tests
- `apps/agent/src/evals/tool-selection.eval.ts` — Tool selection accuracy tests
- `apps/agent/src/evals/hallucination.eval.ts` — Hallucination prevention tests

### 5. Report Script: `apps/agent/src/evals/report.ts`
- Standalone executable report
- Color-coded terminal output
- Pass/fail by dimension and tag
- Exit code 1 if targets not met

### 6. Quick Eval: `apps/agent/src/evals/quick-eval.ts`
- Fast feedback (10 critical cases)
- Useful for development iterations

---

## Current Results (Quick Eval - 10 Cases)

```
RESULTS:
  Total: 10
  Passed: 6
  Failed: 4
  Overall: 60.0%

  Tool Selection:   8/10 (80.0%)  ❌ (target: ≥90%)
  Param Quality:    8/10 (80.0%)  ❌ (target: ≥85%)
  Hallucination:   10/10 (100.0%) ✅ (target: 100%)
```

### Failure Analysis

| Case | Input | Error |
|------|-------|-------|
| search-05 | "Show me Sony products" | Brand param not extracted |
| search-06 | "I want to buy a smartwatch" | Query param mismatch |
| cart-01 | "What's in my cart?" | viewCart not called |
| orders-01 | "Show my recent orders" | getOrders not called |

**Root cause:** The qwen3:0.6b model has limited instruction-following capability for some edge cases. The eval system correctly identifies these gaps.

---

## Usage

### Run Full Eval Report
```bash
cd apps/agent
pnpm eval
```

### Run Quick Eval (10 cases)
```bash
cd apps/agent
npx tsx src/evals/quick-eval.ts
```

### Run Vitest Tests
```bash
cd apps/agent
pnpm test src/evals/tool-selection.eval.ts
pnpm test src/evals/hallucination.eval.ts
```

---

## Architecture

```
apps/agent/src/evals/
├── dataset.ts        # 32 eval cases + matchers
├── metrics.ts        # Scoring logic
├── runner.ts         # Execution engine
├── report.ts         # Standalone report script
├── quick-eval.ts     # Fast feedback (10 cases)
├── tool-selection.eval.ts  # Vitest tests
└── hallucination.eval.ts   # Vitest tests
```

### Eval Flow

```
┌─────────────────┐
│  Eval Dataset   │
│  (32 cases)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Eval Runner    │
│  (invoke graph) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Metrics Engine │
│  (score dims)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Report Output  │
│  (pass/fail)    │
└─────────────────┘
```

---

## Key Design Decisions

### 1. Real LLM Calls (No Mocking)
- Uses actual Ollama model (qwen3:0.6b)
- Costs ~$0.00 per run (local)
- Tests real agent behavior

### 2. Custom Parameter Matchers
```typescript
expectedArgs: {
  query: expect_contains_any(['earbuds', 'audio', 'wireless']),
  maxPrice: 15000,
  quantity: expect_number_in_range(1, 10),
}
```

### 3. Hallucination Detection
- If expected tool WAS called → data from tools (pass)
- If tool NOT called → check response for forbidden patterns
- 100% prevention = zero tolerance for fabricated data

### 4. Sequential Execution
- Concurrency: 1 (avoids rate limiting)
- Timeout: 30s per case
- Total time: ~5 minutes for 32 cases

---

## Next Steps for Improvement

### 1. Model Upgrade
- qwen3:0.6b shows 80% tool selection
- Consider larger model (qwen3:7b or better)
- Trade-off: latency vs accuracy

### 2. Prompt Engineering
- Add few-shot examples to system prompt
- Improve tool descriptions
- Add explicit parameter extraction instructions

### 3. Tool Schema Refinement
- Make brand/category params more explicit
- Add examples in tool descriptions
- Consider JSON schema validation

### 4. Expanded Eval Coverage
- Add edge cases (empty cart, invalid orders)
- Test multi-turn conversations
- Add adversarial prompts

---

## Integration with CI/CD

Add to `.github/workflows/ci.yml`:

```yaml
- name: LLM Evals
  run: |
    cd apps/agent
    pnpm eval
  env:
    LLM_BASE_URL: http://localhost:11434/v1
    LLM_API_KEY: test-key
    LLM_MODEL: qwen3:0.6b
```

---

## Summary

✅ **All 6 deliverables created:**
1. ✅ dataset.ts — 32 eval cases
2. ✅ metrics.ts — scoring engine
3. ✅ runner.ts — execution
4. ✅ tool-selection.eval.ts — tests
5. ✅ hallucination.eval.ts — tests
6. ✅ report.ts — standalone script

✅ **20+ eval cases:** 32 total cases

✅ **Hallucination prevention:** 100% (target met)

⚠️ **Tool selection:** 80% (target: ≥90%) — needs model/prompt improvement

⚠️ **Parameter quality:** 80% (target: ≥85%) — needs refinement

The eval system is **production-ready** and provides actionable insights for agent improvement.
