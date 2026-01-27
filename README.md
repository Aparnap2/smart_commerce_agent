# Smart Commerce Agent

A **production-ready, AI-powered e-commerce support chatbot** featuring **MCP-style tool execution**, **Generative UI (GenUI)**, **Universal Commerce Protocol (UCP)**, and **RAG-based vector search**.

## ⚠️ Important: This is NOT Vercel AI SDK

This project uses **OpenAI SDK** directly with **Ollama's OpenAI-compatible API** for local LLM inference. The repository name is historical - it no longer uses Vercel AI SDK.

---

## ✨ Features

- **Conversational AI**: Natural support for orders, products, support tickets, and refunds
- **MCP-Style Tools**: Modular tool execution with db_query, web_search (RAG), and semantic_search (vector)
- **GenUI (Generative UI)**: Dynamic product cards, tool call displays, and data visualizations
- **UCP Protocol**: Universal Commerce Protocol for standardized e-commerce interactions
- **RAG + Vector Search**: PostgreSQL with pgvector for semantic product search
- **Multi-Agent Orchestration**: LangGraph-based supervisor agent for complex workflows
- **Streaming Responses**: Real-time SSE streaming for instant UX
- **Comprehensive Testing**: E2E with Playwright, LLM evaluation with Ollama

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS, framer-motion, sonner |
| **Backend** | OpenAI SDK + Ollama (local) or Google Gemini |
| **Database** | PostgreSQL + Prisma ORM + pgvector |
| **AI Framework** | LangGraph (disabled), LangChain |
| **Protocols** | MCP-style tools, UCP, AP2 |
| **State** | Redis (checkpoints), Zustand |
| **Testing** | Playwright (E2E), Jest (unit), Ollama (LLM eval) |

---

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   ├── route.ts              # Main chat API (OpenAI SDK + MCP tools)
│   │   │   └── langgraph/route.ts    # LangGraph API (disabled)
│   │   ├── agent/route.ts            # Multi-agent supervisor
│   │   └── refunds/webhook/route.ts  # Stripe refund webhook
│   └── dashboard/                     # Admin dashboard with GenUI
├── lib/
│   ├── agents/                        # LangGraph agents
│   │   ├── supervisor.ts              # Agent orchestration
│   │   ├── refund.ts                  # Refund processing agent
│   │   ├── ui.ts                      # UI generation agent
│   │   └── state.ts                   # Agent state types
│   ├── auth/                          # Authentication
│   ├── components/                    # React components (GenUI)
│   ├── mcp/                           # MCP-style tools
│   │   ├── tools.ts                   # Tool definitions
│   │   ├── server.ts                  # Tool server
│   │   ├── adapter.ts                 # Prisma adapter
│   │   └── rag-tools.ts               # RAG-based tools
│   ├── rag/                           # RAG + Vector search
│   ├── redis/                         # Redis checkpointer
│   ├── schemas/                       # Zod validation
│   ├── stores/                        # Zustand stores
│   ├── stripe/                        # Payment processing
│   ├── ucp/                           # Universal Commerce Protocol
│   └── search/                        # Hybrid search
├── prisma/
│   └── schema.prisma                  # Database schema + pgvector
├── scripts/
│   └── llm_eval.py                    # LLM evaluation with Ollama
└── tests/
    ├── e2e/                           # Playwright E2E tests
    └── unit/                          # Jest unit tests
```

---

## 🚀 Quick Start

### 1. **Clone and install**

```bash
git clone https://github.com/Aparnap2/smart_commerce_agent.git
cd vercel-ai-sdk
pnpm install
```

### 2. **Start PostgreSQL with pgvector**

```bash
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=smart_commerce \
  -p 5432:5432 \
  pgvector/pgvector:pg17

# Initialize Prisma
npx prisma db push
npx prisma generate
```

### 3. **Start Redis (optional, for LangGraph)**

```bash
docker run -d --name redis \
  -p 6379:6379 \
  redis:alpine
```

### 4. **Configure environment**

```bash
# .env.local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smart_commerce"
REDIS_URL="redis://localhost:6379"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen2.5-coder:3b"
```

### 5. **Start Ollama**

```bash
ollama pull qwen2.5-coder:3b
ollama serve
```

### 6. **Run the app**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and try:

- "Show me my orders for john@example.com"
- "What laptops do you have?"
- "Recommend a laptop for programming"
- "What's your return policy?"

---

## 🧠 Architecture

### Chat Flow (MCP-Style Tools)

```
User Message
    ↓
Tool Detection (regex-based)
    ↓
Execute MCP Tools (parallel):
  - db_query → Prisma ORM
  - web_search → RAG document search
  - semantic_search → pgvector similarity
    ↓
Build System Prompt + Tool Context
    ↓
Send to LLM (Ollama/OpenAI-compatible)
    ↓
Stream SSE Response + GenUI rendering
```

### MCP Tool Reference

| Tool | Purpose | Backend |
|------|---------|---------|
| `db_query` | Query orders, products, customers, tickets | Prisma ORM |
| `web_search` | Search policies, FAQs (RAG) | PostgreSQL full-text |
| `semantic_search` | Product recommendations | pgvector |

### UCP Protocol (Universal Commerce Protocol)

Standardized commerce interactions:

```typescript
import { UCPMessage, UCPAction, UCPProduct } from '@/lib/ucp';

// UCP message structure
const ucpMessage: UCPMessage = {
  version: '1.0',
  action: UCPAction.SEARCH_PRODUCTS,
  payload: {
    query: 'laptop',
    filters: { priceRange: [500, 2000] },
  },
  timestamp: Date.now(),
};
```

### GenUI (Generative UI)

Dynamic React components rendered based on LLM responses:

- `ProductCard` - Dynamic product displays with pricing
- `ToolCallDisplay` - MCP tool execution visualization
- `DataVisualization` - Charts and graphs from data

---

## 🧪 Testing

### E2E Tests (Playwright)

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI
pnpm test:e2e --ui

# Run specific test
pnpm test:e2e --project=chromium "GenUI*"
```

**Test Coverage:**
- GenUI component rendering
- MCP tool execution
- UCP commerce flows
- Error handling & edge cases
- Mobile responsiveness

### Unit Tests (Jest)

```bash
# Run unit tests
pnpm test:unit

# Run with coverage
pnpm test:unit --coverage
```

### LLM Evaluation (Ollama)

```bash
# Run LLM evaluation suite
source .venv/bin/activate
python scripts/llm_eval.py

# Use different model
OLLAMA_MODEL="lfm2.5-thinking:1.2b" python scripts/llm_eval.py
```

**Metrics Evaluated:**
- Tool Correctness: 80%
- Answer Relevancy: 44%
- Faithfulness: 38%
- GEval Correctness: 72%

---

## 📊 Database Schema

```prisma
// PostgreSQL with pgvector for semantic search

model Customer {
  id             Int     @id @default(autoincrement())
  email          String  @unique
  name           String?
  phone          String?
  orders         Order[]
  supportTickets SupportTicket[]
  preferences    Json?
}

model Order {
  id             Int      @id @default(autoincrement())
  customerId     Int
  customer       Customer @relation(fields: [customerId], references: [id])
  productId      Int
  product        Product  @relation(fields: [productId], references: [id])
  total          Float
  status         String
  paymentStatus  String?
  trackingNumber String?
  orderDate      DateTime @default(now())
}

model Product {
  id          Int     @id @default(autoincrement())
  name        String
  description String?
  price       Float
  stock       Int
  category    String?
  // pgvector embedding for semantic search
  embedding   Unsupported("vector(384)")?
}

model SupportTicket {
  id          Int      @id @default(autoincrement())
  customerId  Int
  customer    Customer @relation(fields: [customerId], references: [id])
  issue       String
  status      String
  priority    String?
  createdAt   DateTime @default(now())
}
```

---

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | No | Redis for LangGraph checkpoints |
| `OLLAMA_BASE_URL` | Dev | Ollama server (default: http://localhost:11434) |
| `OLLAMA_MODEL` | Dev | Model name (default: qwen2.5-coder:3b) |
| `OPENAI_API_KEY` | Prod | OpenAI API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Prod | Google Gemini API key |
| `STRIPE_SECRET_KEY` | Prod | Stripe secret key |

---

## 📝 API Reference

### POST /api/chat

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Show me my orders for john@example.com" }
  ]
}
```

**Response:** Server-Sent Events (SSE)

```
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":"Here"}}]}
data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":" are"}}]}
...
data: [DONE]
```

### POST /api/agent

Multi-agent supervisor for complex workflows.

### POST /api/refunds/webhook

Stripe refund webhook handler.

---

## 🔒 Security

- All tool inputs validated with Zod schemas
- User context enforced on all database queries
- Environment variables validated at startup
- Prepared statements via Prisma (no SQL injection)
- Rate limiting on all API endpoints

---

## 📄 License

MIT

---

## 👤 Author

**Aparnap2**
[GitHub](https://github.com/Aparnap2)
