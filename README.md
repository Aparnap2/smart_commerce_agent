# Vercel AI SDK E-commerce Chatbot with MCP

A **production-ready, AI-powered e-commerce support chatbot** featuring **Model Context Protocol (MCP)** integration with type-safe PostgreSQL access.

## ✨ Features

- **Conversational AI**: Natural support for orders, products, support tickets, and refunds
- **MCP Tool Protocol**: Modular tool execution with db_query, web_search, and semantic_search
- **Prisma ORM**: Type-safe database access to PostgreSQL
- **Streaming LLM**: Real-time responses via OpenAI SDK with Ollama (local) or Google Gemini (production)
- **SSE Streaming**: Server-Sent Events for instant UI updates
- **Comprehensive Logging**: Debug logs with emoji prefixes for tool execution, Prisma queries, and LLM calls

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS, framer-motion |
| **Backend** | OpenAI SDK + Ollama (local) or Google Gemini (production) |
| **Database** | PostgreSQL with Prisma ORM |
| **Protocol** | MCP (Model Context Protocol) for tool execution |
| **Validation** | Zod schemas |
| **AI Tools** | db_query, web_search, semantic_search |

---

## 🚀 Quick Start

### 1. **Clone and install**

```bash
git clone https://github.com/Aparnap2/vercel-ai-sdk.git
cd vercel-ai-sdk
pnpm install
```

### 2. **Set up PostgreSQL**

```bash
# Start PostgreSQL container
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=vercel_ai \
  -p 5432:5432 postgres:latest

# Initialize Prisma
npx prisma db push
npx prisma generate
```

### 3. **Configure environment**

```bash
# .env.local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vercel_ai"
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen2.5-coder:3b"
```

### 4. **Start Ollama (local LLM)**

```bash
# Pull the model
ollama pull qwen2.5-coder:3b

# Start Ollama server
ollama serve
```

### 5. **Run the app**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and try queries like:

- "Show me my orders for john@example.com"
- "What products do you have?"
- "Show my support tickets"

---

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts          # MCP + Prisma chat API (main)
│   │       ├── route-ollama/     # Legacy Ollama routes
│   │       └── system-prompt.js  # LLM system prompt
│   └── page.tsx                  # Chat UI
├── lib/
│   ├── env.js                    # Environment validation
│   └── mcp/                      # MCP Infrastructure
│       ├── adapter.ts            # Tool adapters (Prisma integration)
│       ├── server.ts             # ECatalogMCPServer class
│       ├── tools.ts              # Secure tool factory
│       └── types.ts              # Type definitions
├── prisma/
│   └── schema.prisma             # Database schema
└── tests/
    └── e2e/                      # E2E tests with Chrome MCP
```

---

## 🧠 MCP Tool Architecture

### Tool Categories

| Tool | Purpose | User ID Required |
|------|---------|------------------|
| `db_query` | Query orders, products, customers, tickets | Yes |
| `web_search` | Search policies, FAQs, general info | No |
| `semantic_search` | Personalized recommendations | Yes |

### Tool Execution Flow

```
User Message
    ↓
Tool Detection (regex-based)
    ↓
Execute MCP Tools (Prisma queries)
    ↓
Build System Prompt + Tool Context
    ↓
Send to LLM (Ollama/Gemini)
    ↓
Stream SSE Response
```

### Example: Order Query

```typescript
// app/api/chat/route.ts
async function executeDbQueryTool(queryType, userEmail) {
  const orders = await prisma.order.findMany({
    where: { customer: { email: userEmail } },
    include: { customer: true, product: true },
    orderBy: { orderDate: 'desc' },
    take: 10,
  });
  return { success: true, data: orders };
}
```

---

## 📊 Database Schema

```prisma
model Customer {
  id            Int    @id @default(autoincrement())
  name          String?
  email         String @unique
  phone         String?
  orders        Order[]
  supportTickets SupportTicket[]
}

model Order {
  id              Int      @id @default(autoincrement())
  customerId      Int
  customer        Customer @relation(fields: [customerId], references: [id])
  productId       Int
  product         Product  @relation(fields: [productId], references: [id])
  total           Float
  status          String
  paymentStatus   String?
  trackingNumber  String?
}

model Product {
  id          Int     @id @default(autoincrement())
  name        String
  price       Float
  stock       Int
  category    String?
}

model SupportTicket {
  id          Int      @id @default(autoincrement())
  customerId  Int
  customer    Customer @relation(fields: [customerId], references: [id])
  issue       String
  status      String
  priority    String?
}
```

---

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OLLAMA_BASE_URL` | Dev | Ollama server URL (default: http://localhost:11434) |
| `OLLAMA_MODEL` | Dev | Model name (default: qwen2.5-coder:3b) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Prod | Google Gemini API key |

---

## 🧪 Testing

### E2E Tests with Chrome MCP

```bash
# Run E2E tests
pnpm test:e2e
```

Tests include:
- Database integration (PostgreSQL via Prisma)
- Chat interactions
- Error handling
- Performance benchmarks

### Manual Testing with curl

```bash
# Test order query
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"content": "Show me my orders for john@example.com"}]}'
```

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

**Debug Logs:**
```
[MCP_TOOL] 🔧 Executing db_query: orders for john@example.com
prisma:query SELECT "public"."Order"."id"... FROM "public"."Order"...
[MCP_TOOL] ✅ Success: 📦 Found 1 order(s) (76ms)
[CHAT_API] 📤 Sending to Ollama: qwen2.5-coder:3b
[CHAT_API] 📡 Streaming response...
```

---

## 🔒 Security

- All tool inputs validated with Zod
- User context enforced on all queries
- Environment variables validated at startup
- Prepared statements via Prisma (no SQL injection)

---

## 📄 License

MIT

---

## 👤 Author

**Aparnap2**
[GitHub](https://github.com/Aparnap2)
