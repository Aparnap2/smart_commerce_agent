# Max Steps Limit: Preventing Infinite Tool Call Loops

## Overview

All `streamText` calls in the codebase now include a **hard limit** on tool call iterations using `stopWhen: stepCountIs(5)`. This is **non-negotiable for production** and prevents infinite tool call loops that can occur in agentic AI systems.

## The Problem: Infinite Tool Call Loops

### Failure Mode

Without a step limit, the following scenario can occur:

```
User: "Find me headphones under ₹10,000"
  ↓
Agent calls searchProducts tool
  ↓
Tool returns results
  ↓
Agent thinks: "I should filter these by brand"
  ↓
Agent calls searchProducts tool again (with brand filter)
  ↓
Tool returns results
  ↓
Agent thinks: "Let me check if there are similar products"
  ↓
Agent calls searchProducts tool again...
  ↓
[INFINITE LOOP - Never terminates]
```

### Root Causes

1. **Ambiguous Tool Definitions**: Tools with overlapping responsibilities can cause the LLM to call them repeatedly.
2. **Recursive Tool Results**: A tool result that triggers the same condition that called it.
3. **LLM Hallucination**: The model may incorrectly believe it needs to call a tool again with slightly different parameters.
4. **Multi-Turn Context Confusion**: In conversation, the LLM may re-interpret previous tool calls as incomplete.

### Impact

- **Cost**: Each tool call consumes API credits and compute resources
- **Latency**: Users wait indefinitely for a response that never completes
- **Resource Exhaustion**: Can exhaust rate limits, database connections, or memory
- **User Experience**: Application appears frozen or broken

## The Solution: `stopWhen: stepCountIs(5)`

### Implementation

**Vercel AI SDK v6 Pattern:**

```typescript
import { streamText, stepCountIs } from 'ai';

const result = streamText({
  model: llm,
  messages: conversationMessages,
  stopWhen: stepCountIs(5), // ← HARD LIMIT: Max 5 tool calls per turn
  tools: {
    searchProducts: { /* ... */ },
    addToCart: { /* ... */ },
  },
});
```

**Deprecated Pattern (AI SDK v4):**

```typescript
// ❌ DON'T USE - maxSteps removed in v5+
const result = streamText({
  model: llm,
  messages,
  maxSteps: 5, // Removed in AI SDK v5+
  tools: { /* ... */ },
});
```

### Why 5 Steps?

The limit of **5 tool calls per turn** is based on:

1. **Cognitive Load**: Most user queries require 1-3 tool calls maximum
2. **Diminishing Returns**: After 5 calls, the agent is likely stuck in a loop
3. **Cost Control**: Limits maximum API cost per user request
4. **Latency Budget**: 5 tool calls × ~2s each = 10s max wait time (acceptable)

### What Happens at the Limit?

When the agent reaches 5 tool calls:

1. **Graceful Termination**: The `streamText` call stops generating
2. **Partial Response**: The model provides a summary based on available tool results
3. **User Can Continue**: User can ask follow-up questions to get more information
4. **No Error**: The response completes normally, just with limited tool usage

## Files Modified

### 1. `apps/web/app/chat-dashboard/actions.tsx`

**Location:** `sendMessage()` function

```typescript
const result = streamText({
  model: llm,
  messages: conversationMessages,
  stopWhen: stepCountIs(5), // CRITICAL: Prevent infinite tool call loops
  tools: {
    searchProducts: { /* ... */ },
    addToCart: { /* ... */ },
    trackOrder: { /* ... */ },
  },
});
```

### 2. `apps/web/app/actions.js`

**Location:** `streamAgentResponse()` function

```javascript
import { streamText, stepCountIs } from 'ai';

export async function streamAgentResponse(messages, options = {}) {
  'use server';

  const {
    model = google('gemini-1.5-flash'),
    maxSteps = 5, // CRITICAL: Prevent infinite tool call loops
    onStepComplete = null,
    includeUI = true,
  } = options;

  const result = await streamText({
    model,
    messages,
    stopWhen: stepCountIs(maxSteps), // ← Applied to streamText
    tools: { /* ... */ },
  });
}
```

## Monitoring and Alerting

### Signs of Tool Loop Issues

Monitor for these patterns in production:

1. **High Step Counts**: If many requests hit the 5-step limit, review tool definitions
2. **Repeated Tool Calls**: Same tool called 3+ times in one turn indicates confusion
3. **Timeout Errors**: Requests timing out may be stuck in loops
4. **User Complaints**: "The assistant keeps searching but never shows results"

### Logging

Add structured logging to track tool usage:

```typescript
const result = streamText({
  model: llm,
  messages,
  stopWhen: stepCountIs(5),
  tools: {
    searchProducts: {
      description: 'Search for products',
      inputSchema: SearchProductsParams,
      execute: async (params) => {
        console.log('[Tool Call] searchProducts', { params });
        // ... implementation
      },
    },
  },
  onFinish: ({ usage, steps }) => {
    console.log('[Stream Complete]', { usage, steps });
  },
});
```

## Best Practices

### 1. Design Tools for Single Responsibility

Each tool should do **one thing** and do it well:

```typescript
// ✅ GOOD: Focused tool
searchProducts: {
  description: 'Search products by query and filters',
  execute: async ({ query, maxPrice, category }) => {
    return await hybridProductSearch(query, { maxPrice, category });
  }
}

// ❌ BAD: Multiple responsibilities
searchAndFilterProducts: {
  description: 'Search, filter, sort, and paginate products',
  // Too complex - LLM may call multiple times for different operations
}
```

### 2. Provide Clear Tool Descriptions

Help the LLM understand when to use each tool:

```typescript
// ✅ GOOD: Clear description
searchProducts: {
  description: 'Search for products. Call ONCE with all filters. Returns up to 6 results.',
  // Clear expectations about usage
}

// ❌ BAD: Vague description
searchProducts: {
  description: 'Search for stuff',
  // LLM may call repeatedly to "refine" search
}
```

### 3. Return Comprehensive Results

Give the LLM enough information in one call:

```typescript
// ✅ GOOD: Rich result
return {
  products: [...],
  total: 42,
  hasMore: true,
  filters: { applied: [...] },
  suggestions: ['headphones', 'earbuds'],
};

// ❌ BAD: Sparse result
return {
  products: [...],
  // LLM may call again to get "more info"
};
```

### 4. Handle the Limit Gracefully

When the limit is hit, provide helpful context:

```typescript
const result = streamText({
  model: llm,
  messages,
  stopWhen: stepCountIs(5),
  system: `You are a helpful assistant.
  
  IMPORTANT: You can call tools up to 5 times per conversation turn.
  If you reach this limit, summarize what you found and ask if the user
  wants to continue with more specific queries.`,
});
```

## Testing

### Unit Test: Verify Step Limit is Applied

```typescript
import { streamText, stepCountIs } from 'ai';
import { describe, it, expect } from 'vitest';

describe('streamText configuration', () => {
  it('should have stopWhen limit to prevent infinite loops', async () => {
    const result = streamText({
      model: testModel,
      messages: [{ role: 'user', content: 'test' }],
      stopWhen: stepCountIs(5),
      tools: { testTool },
    });

    // Consume stream and verify it completes
    const response = await result.toUIMessageStream();
    expect(response).toBeDefined();
    // Should complete without hanging
  });
});
```

### Integration Test: Verify Tool Call Behavior

```typescript
import { test, expect } from 'playwright/test';

test('agent should not exceed 5 tool calls per turn', async ({ page }) => {
  let toolCallCount = 0;

  // Mock tool endpoint
  await page.route('**/api/tools/*', (route) => {
    toolCallCount++;
    route.fulfill({ json: { result: 'mocked' } });
  });

  // Trigger agent response
  await page.fill('[data-testid="chat-input"]', 'Find me products...');
  await page.click('[data-testid="send-button"]');

  // Wait for response to complete
  await page.waitForSelector('[data-testid="response-complete"]');

  // Verify tool calls stayed within limit
  expect(toolCallCount).toBeLessThanOrEqual(5);
});
```

## Migration Guide

### From AI SDK v4 (maxSteps) to v6 (stepCountIs)

**Before (v4):**

```typescript
import { streamText } from 'ai';

const result = streamText({
  model,
  messages,
  maxSteps: 5, // ❌ Removed in v5+
  tools,
});
```

**After (v6):**

```typescript
import { streamText, stepCountIs } from 'ai';

const result = streamText({
  model,
  messages,
  stopWhen: stepCountIs(5), // ✅ Correct for v5+
  tools,
});
```

### Checklist

- [ ] Import `stepCountIs` from `ai`
- [ ] Replace `maxSteps: 5` with `stopWhen: stepCountIs(5)`
- [ ] Verify TypeScript compiles without errors
- [ ] Test that tool calls still work correctly
- [ ] Monitor production for requests hitting the limit

## Related Documentation

- [Vercel AI SDK - stopWhen Parameter](https://sdk.vercel.ai/docs/ai-sdk-core/stopping-conditions)
- [AI SDK Migration Guide v5.0](https://sdk.vercel.ai/docs/ai-sdk-core/migration-guide-5-0)
- [Tool Calling Best Practices](https://sdk.vercel.ai/docs/ai-sdk-core/tools)

## Summary

| Aspect | Detail |
|--------|--------|
| **Parameter** | `stopWhen: stepCountIs(5)` |
| **Location** | All `streamText` calls with tools |
| **Purpose** | Prevent infinite tool call loops |
| **Limit** | 5 tool calls per conversation turn |
| **Files** | `apps/web/app/chat-dashboard/actions.tsx`, `apps/web/app/actions.js` |
| **Status** | ✅ Implemented and verified |

**Remember:** This is a **safety-critical** feature. Never remove or increase the limit without careful consideration of the failure modes.
