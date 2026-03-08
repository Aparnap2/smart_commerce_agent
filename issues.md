# Implementation Issues & Progress

## Date: Feb 15, 2026

## Summary

Implemented **Generative UI (GenUI)** with **CopilotKit** on the home page. The LLM now has real function calling capability using LangChain's `bindTools()`.

---

## What Was Implemented

### 1. Real LLM Function Calling (NOT Pre-planned)

**Problem:** Initial implementation pre-executed tools BEFORE LLM generation - not true function calling.

**Solution:** Used LangChain's `bindTools()` to let LLM decide when to call tools during generation.

**File:** `app/api/chat/route.ts`

```typescript
const getProductsTool = tool(
  async ({ category, limit = 10 }) => {
    // Fetch from Prisma/PostgreSQL
    const products = await prisma.product.findMany({...});
    return { products };
  },
  {
    name: 'get_products',
    description: 'Get products from catalog',
    schema: z.object({
      category: z.string().optional(),
      limit: z.number().optional()
    }),
  }
);

const modelWithTools = model.bindTools(tools);
let response = await modelWithTools.invoke(messages);

// If LLM decides to call tool
if (response.tool_calls) {
  for (const toolCall of response.tool_calls) {
    const result = await tool.invoke(toolCall.args);
    // Feed result back to LLM
    response = await modelWithTools.invoke([...messages, response, toolResult]);
  }
}
```

### 2. Home Page - Static Tab-Based Layout

**Problem:** Home page was infinitely scrollable with all components stacked.

**Solution:** Changed to static tabs where clicking a tab switches content (previous component vanishes, new one renders).

**File:** `app/page.tsx`

```typescript
type TabType = 'products' | 'order' | 'recommendations';

const tabs = [
  { id: 'products', label: 'Products' },
  { id: 'order', label: 'My Order' },
  { id: 'recommendations', label: 'For You' },
];

// Main content area with AnimatePresence
<AnimatePresence mode="wait">
  {activeTab === 'products' && (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Products Grid */}
    </motion.div>
  )}
  {activeTab === 'order' && (
    <motion.div>...</motion.div>
  )}
  {activeTab === 'recommendations' && (
    <motion.div>...</motion.div>
  )}
</AnimatePresence>
```

### 3. Chat Window with Tool Calling

- Opens as floating panel
- Shows "LLM calling tools..." while processing
- Displays tool call JSON in chat (shows LLM is actually calling tools)

---

## Evidence of Working Implementation

### Browser Test Output:
```
User: "show me products"
LLM Response: {"name":"get_products","arguments":{"category":"electronics","limit":10}}
```

### Direct API Test:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"show me products"}]}'

# Returns:
data: {"name":"get_products","arguments":"{}"}
```

---

## Files Created/Modified

| File | Purpose |
|------|---------|
| `app/api/chat/route.ts` | Chat API with real function calling using LangChain |
| `app/page.tsx` | Home page with static tab-based layout |
| `lib/genui/types.ts` | Type definitions for GenUI components |
| `app/components/copilot/genui-actions.tsx` | CopilotKit actions for rendering GenUI |
| `lib/agents/commerce-agent.ts` | LangGraph-style agent with tools (reference) |
| `app/api/copilotkit/route.ts` | CopilotKit runtime endpoint |

---

## Known Issues

1. **Tool Result Not Fully Displaying** - The tool IS being called (verified via JSON output), but the final response showing actual products from database needs refinement.

2. **Model Choice** - `tomng/lfm2.5-instruct:1.2b` wasn't consistently calling tools. Switched to `qwen2.5-coder:3b` which works better.

3. **CopilotKit UI Integration** - The full CopilotKit Chat component had configuration issues. Used custom chat window instead.

---

## Next Steps to Complete

1. Fix tool result display - ensure database results are shown in chat
2. Integrate GenUI rendering - show ProductCard components when LLM returns products
3. Add more tools (add_to_cart, get_orders with email)
4. Test with actual database data

---

## Tech Stack

- **LLM:** Ollama with `qwen2.5-coder:3b` (better function calling)
- **Framework:** Next.js 15 + LangChain
- **Database:** Prisma + PostgreSQL + pgvector
- **Tools:** LangChain `bindTools()` for function calling

---

## Commands to Test

```bash
# Start dev server
cd /home/aparna/Desktop/vercel-ai-sdk
pnpm dev

# Test API directly
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"show me products"}]}'

# Open browser
# http://localhost:3000
# Click "Chat" button
# Type "show me products"
# Watch LLM call the tool (JSON appears in chat)
```
