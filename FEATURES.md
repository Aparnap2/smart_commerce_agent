# 🎯 TECHTREND: DEFINITIVE FEATURE LIST

**Project:** Agentic Commerce Platform (Customer & Merchant)
**Architecture:** Vercel AI SDK RSC (`streamUI`), Next.js 15, PostgreSQL, Upstash Redis.
**Rule:** Build ONLY these features. Do not hallucinate or invent additional standard e-commerce features (e.g., reviews, wishlists with sharing, complex user profiles).

---

## 1. 🛍️ CUSTOMER AGENT FEATURES (Path: `/chat-dashboard`)

### 1.1 Natural Language Search & Discovery
- **Feature:** Conversational product search with hybrid matching (BM25 + pgvector).
- **Capabilities:**
  - Understands pricing constraints ("under ₹10000").
  - Understands category and brand constraints.
  - Multi-turn context: User can say "actually, only the Sony ones" after an initial search, and the agent applies the new filter to the previous context.
- **UI Output:** `<ProductGrid />` (Max 6 items, shows Name, Price, Category Emoji, Stock Status, "Add to Cart" button).

### 1.2 Agentic Cart Management
- **Feature:** Manage cart entirely via conversation.
- **Capabilities:**
  - Add to cart, remove from cart, update quantity via natural language.
  - Safely handles "add the first one to my cart" by resolving context.
  - Rejects additions if `stockCount` is 0.
- **UI Output:** `<CartCanvas />` (Shows items, quantities, subtotal, inline edit/remove controls, "Checkout" button).

### 1.3 Conversational Checkout
- **Feature:** 2-click checkout inside the chat stream.
- **Capabilities:**
  - Never navigates to a separate checkout page.
  - Requires explicit user confirmation before processing.
- **UI Output:** `<ActionConfirm />` (Shows order total, shipping address summary, [Confirm Purchase] / [Cancel] buttons).

### 1.4 Post-Purchase & Order Intelligence
- **Feature:** View order history and status conversationally.
- **Capabilities:**
  - Query "where is my order" or "what did I buy last month".
  - One-click "Reorder" from past purchases.
- **UI Output:** `<OrderCard />` (Shows Order ID, Status Badge, Date, Total, Tracking Number if shipped).

### 1.5 Agentic Return / Refund Flow
- **Feature:** Fully conversational returns (zero forms).
- **Capabilities:**
  - Validates return window (e.g., < 7 days).
  - Evaluates policy dynamically and presents exactly 3 options: [Replacement], [Refund to Original], [Store Credit + ₹500 Bonus].
  - Executes Stripe test refund upon confirmation.
- **UI Output:** `<ReturnCard />` (Shows policy options) → `<ActionConfirm danger={true} />` → Success message.

---

## 2. 📊 MERCHANT AGENT FEATURES (Path: `/admin/chat`)

### 2.1 Proactive Daily Briefing
- **Feature:** Zero-query analytics on load.
- **Capabilities:**
  - When the merchant opens the chat, the agent automatically runs background queries and greets them with actionable insights.
- **UI Output:** `<MerchantBriefingCard />` (Shows Revenue delta vs yesterday, Low stock count, Abandoned cart spike alerts).

### 2.2 Conversational Inventory Management
- **Feature:** Query and restock inventory via chat.
- **Capabilities:**
  - "What's running low?" → Agent fetches products where `stockCount < 5`.
  - Execute restock (updates `stockCount` in DB).
- **UI Output:** `<InventoryAlert />` (Lists low stock items with 1-click [Reorder] buttons) → `<ActionConfirm />`.

### 2.3 Bulk Operations & Resolution
- **Feature:** Perform multi-record updates safely.
- **Capabilities:**
  - Example: "Refund all orders containing product X from yesterday."
  - MUST show affected scope before executing.
- **UI Output:** `<BulkActionConfirm danger={true} />` (Shows "This will refund 12 orders. Proceed?").

---

## 3. 🧠 AGENTIC "MAGIC" (The Differentiators)

### 3.1 Proactive Cart Recovery (Event-Driven)
- **Feature:** Agent initiates conversation, not just responds.
- **Capabilities:**
  - Triggered by Azure Function polling the `commerce_events` table.
  - If a cart is untouched for 2 hours, agent pushes a message to the active chat session: "Still thinking about those headphones? Only 3 left."
  - Rate limited to max 1 proactive message per 4 hours.

### 3.2 Idempotent Writes (Fail-Safe)
- **Feature:** Protection against double-execution.
- **Capabilities:**
  - Every write tool (addToCart, checkout, return) generates an idempotency key in Redis based on `userId + action + entityId`.
  - Locks execution for 30 seconds. Prevents network retries from double-charging or double-adding to cart.

### 3.3 Context Window Poisoning Prevention
- **Feature:** AI state compression.
- **Capabilities:**
  - Raw tool results (e.g., an array of 20 products) are NEVER saved to the LLM message history.
  - Tool results are summarized ("Found 5 products, top match is Sony at ₹12000") before being appended to `AIState`.

---

## 4. 🖥️ UI / UX CORE (The Shell)

### 4.1 Chat Canvas
- **Empty State:** Greeting message + 4 dynamic Suggested Action Chips.
- **Streaming:** `<AgentThinking />` indicator (3 animated dots) while waiting for tool execution.
- **Scroll Management:** TanStack Virtual for message list; auto-scrolls to bottom on new message unless user scrolled up.
- **InputBar:** Disables while streaming. Auto-refocuses when stream finishes. No scrollbar. Mobile responsive.

### 4.2 Accessibility & Theming
- **Dark Mode:** Perfect dark mode support. AI messages use dark cards, User messages use purple bubbles. Text is explicitly styled to avoid white-on-white/black-on-black errors.
- **A11y:** Full keyboard navigation. `aria-live` regions for streaming updates.

---

## 🚫 5. ANTI-FEATURES (DO NOT BUILD THESE)

To keep the scope strictly on "Agentic Commerce" within the Azure Free Tier, the following features are **STRICTLY OUT OF SCOPE**. If prompted to build them, politely decline and reference this file.

1. **NO Product Images:** Do not implement Azure Blob Storage or S3. Product cards use text and category emojis (🎧, 💻, 📱) only.
2. **NO Voice Input/Output:** Do not implement Web Speech API or Azure Speech. Text only.
3. **NO Traditional UI Pages:** No `/products/[id]`, no `/cart` page, no `/checkout` page. The ENTIRE experience lives inside `/chat-dashboard`.
4. **NO Complex Auth:** Use NextAuth.js with standard Credentials and GitHub. Do not implement Azure AD / Entra ID or phone OTPs.
5. **NO Reviews/Ratings System:** Do not create database tables for user reviews.
6. **NO CopilotKit / LangChain:** Use pure `ai/rsc` (`streamUI`) and LangGraph (for backend orchestration if needed), nothing else.
