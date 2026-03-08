# Chat Dashboard Server Actions Implementation

## Overview

Created server actions for the Vercel AI SDK RSC pattern in the chat dashboard.

**Important Note:** The `ai/rsc` module with `streamUI`, `createAI`, and `getMutableAIState` **does not exist in Vercel AI SDK v6**. These APIs were experimental or part of older versions. The implementation below uses the **correct v6 patterns** with `streamText` from `ai` and server actions.

## Files Created

### 1. `/apps/web/lib/llm/client.ts`

Azure OpenAI client configuration for use with Vercel AI SDK.

```typescript
import { llm } from "@/lib/llm/client";
```

**Exports:**
- `azure` - Azure provider instance
- `llm` - Chat model instance for completions
- `modelId` - Model deployment name

### 2. `/apps/web/app/chat-dashboard/actions.tsx`

Server actions for chat operations with tool support.

**Exports:**
- `sendMessage(input, options)` - Stream response from LLM with tools
- `createChat()` - Create new chat session
- `getChat(chatId)` - Get chat history
- `saveChat(chatId, messages)` - Persist chat messages
- Tool schemas: `searchProductsSchema`, `addToCartSchema`, `trackOrderSchema`
- Types: `Message`, `ChatState`, `ToolResult`

## Usage Examples

### Client Component with useChat Hook

```tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { sendMessage } from './actions';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    // Option 1: Use API route
    api: '/api/chat',
    
    // Option 2: Use server action directly (Next.js 15+)
    // send: async (message) => {
    //   const result = await sendMessage(message, { messages });
    //   // Process stream...
    // },
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

### Using Tools in Server Actions

The `sendMessage` action includes three placeholder tools:

1. **searchProducts** - Search for products
2. **addToCart** - Add product to cart
3. **trackOrder** - Track order status

To connect to actual services:

```typescript
// In actions.tsx
searchProducts: {
  description: "Search for products",
  inputSchema: searchProductsSchema,
  execute: async ({ query, maxPrice, category }) => {
    // Connect to hybrid search
    const results = await hybridSearch({ query, maxPrice, category });
    return results;
  },
}
```

## Type Definitions

### Message
```typescript
type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Date;
};
```

### ChatState
```typescript
type ChatState = {
  chatId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
};
```

## Integration with Existing Architecture

This implementation complements the existing CopilotKit GenUI pattern:

- **CopilotKit**: Client-side GenUI with `useCopilotAction` (existing)
- **Vercel AI SDK**: Server-side streaming with `streamText` (new)

Both can coexist:
- Use CopilotKit for in-chat UI components
- Use Vercel AI SDK for general chat streaming

## Phase 2 TODOs

1. Connect tools to actual services:
   - `hybridSearch` from `lib/search/hybrid.ts`
   - Cart service
   - Order service

2. Add database persistence:
   - Uncomment Prisma calls in `createChat`, `getChat`, `saveChat`
   - Add chat messages schema to Prisma

3. Add error handling and retries:
   - Circuit breakers for external calls
   - Timeout handling

## TypeScript Verification

✅ Both files compile without errors:
```bash
cd apps/web && pnpm exec tsc --noEmit
# No errors in actions.tsx or client.ts
```

## Key Differences from Requested Pattern

| Requested (ai/rsc) | Actual (AI SDK v6) |
|-------------------|-------------------|
| `streamUI` | `streamText` |
| `createAI` | `useChat` hook |
| `getMutableAIState` | Server action state management |
| `ai/rsc` import | `ai` + `@ai-sdk/react` |
| Tools with `generate` | Tools with `execute` |
| Tools with `parameters` | Tools with `inputSchema` |

## References

- [Vercel AI SDK Docs](https://sdk.vercel.ai/docs)
- [@ai-sdk/react](https://www.npmjs.com/package/@ai-sdk/react)
- [@ai-sdk/azure](https://www.npmjs.com/package/@ai-sdk/azure)
