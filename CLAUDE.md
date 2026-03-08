# CLAUDE.md — Smart Commerce Agent

## ⚡ MANDATORY: Do This FIRST, Every Single Session

Before writing ANY code, run these commands and read their output:

```bash
# 1. What's actually running? (Sequential: one container at a time)
docker ps -a

# 2. What's the current state of the DB?
make start-postgres
docker exec smart-commerce-postgres psql -U postgres techtrend \
  -c "\dt" -c "SELECT COUNT(*) FROM \"Product\";"
make stop-postgres

# 3. Any failing tests right now?
pnpm test --passWithNoTests 2>&1 | tail -20

# 4. What's in .env.local (without secrets)?
grep -v "KEY\|SECRET\|TOKEN\|PASSWORD" .env.local

# 5. Read the definitive feature list
cat FEATURES.md
```

**Report what you find BEFORE proposing any plan.**

---

## 🗺️ Context: What This Project Is

**See @FEATURES.md for the DEFINITIVE feature list (what to build, what NOT to build).**
See @AGENTS.md for full architecture context.
See @TASKS.md for current phase, active task, and what's done.

This is a **production-grade agentic e-commerce platform**:
- Next.js 15 frontend + Vercel AI SDK RSC (`streamUI`)
- LangGraph supervisor agent with typed state
- MCP tool layer (Zod-validated, user-scoped, idempotent)
- PostgreSQL + pgvector hybrid search (FTS + HNSW rerank)
- Azure AI Foundry LLM (already configured in .env.local)
- Redis (LangGraph checkpoints + semantic cache)
- Langfuse observability (running in Docker)

**LLM is Azure AI Foundry — already set up. NEVER use Ollama or mock LLMs.**
**Database is local Docker PostgreSQL with pgvector — NEVER use Supabase or mocks.**

---

## 🔧 MCP Servers Available

Use these tools to gather context before coding:

1. **context7**: Get live docs for any library
   - Usage: `use context7` in prompts
   - Best for: LangGraph API, CopilotKit, Stripe agent toolkit, pgvector SQL, Prisma

2. **ddg-mcp** (DuckDuckGo search): Research current patterns
   - Best for: Azure AI Foundry SDK examples, Stripe MCP tools list, error debugging

3. **filesystem**: Read existing files before touching them
   - ALWAYS read a file before editing it

---

## 📋 Workflow: How to Approach Every Task

### Step 1: Understand Before Acting
1. Read @TASKS.md — find the current active task
2. Run `docker ps -a` — confirm infra state
3. Use context7 to get fresh docs for any library you'll use
4. Read the existing file(s) you'll modify — don't overwrite blindly

### Step 2: Plan Before Coding (TDD)
Write a markdown plan with:
```markdown
### Plan: [Task Name]
**Tests to write first:**
- [ ] test description 1
- [ ] test description 2

**Files to create/modify:**
- lib/x/y.ts (new) — purpose
- lib/x/z.ts (modify) — what changes

**Existing code to reuse:**
- [cite exact file:line]

**Azure services to use:**
- AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini (already in .env)
- [any other .env vars needed]
```

Show plan and wait for approval before coding.

### Step 3: TDD — Tests First
See @.cursor/rules/tdd.mdc for full TDD workflow.
Red → Green → Refactor. Always.

### Step 4: Verify With Real Infra
```bash
# Run the specific test you just wrote
pnpm test [test-file] --watch

# If it touches the DB, check real data
make start-postgres
docker exec smart-commerce-postgres psql -U postgres techtrend \
  -c "SELECT * FROM \"[Table]\" LIMIT 5;"
make stop-postgres

# If it touches Redis
make start-redis
docker exec smart-commerce-redis redis-cli keys "*"
make stop-redis

# If it touches LangGraph / LLM — use REAL Azure AI Foundry
# NEVER mock the LLM in integration tests
```

### Step 5: Update TASKS.md
After completing any task:
- Mark `[x]` on the completed item
- Add any discovered sub-tasks
- Note any architectural decisions made

---

## ❌ Never Do These

- Never use `any` TypeScript type — use proper types or `unknown`
- Never mock Azure AI Foundry in integration tests — use real `.env.local` keys
- Never hardcode credentials — all secrets from `.env.local`
- Never skip Zod validation on MCP tool inputs
- Never write tests after the code — tests come first
- Never edit a file without reading it first
- Never assume Docker containers are running — check with `docker ps -a`
- Never use Ollama — LLM is Azure AI Foundry
- Never use UCP Protocol — use Stripe MCP for payments
- Never disable LangGraph — it must be active
- **Never build features outside FEATURES.md — strict boundary**

---

## 🏗️ Patterns to Always Follow

### MCP Tool Pattern (copy this exactly):
```typescript
export const myTool: MCPTool = {
  name: "resource.action",
  description: "...",
  schema: z.object({ ... }),  // Zod first
  execute: async (args, userId: string) => {
    if (!userId) throw new MCPError("UNAUTHORIZED");
    // userId-scoped queries only
    const traced = langfuse.span({ name: `mcp.${myTool.name}`, input: args });
    try {
      const result = await prisma.[model].findMany({
        where: { customerId: userId, ...args }
      });
      traced.end({ output: result });
      return { success: true, data: result };
    } catch (e) {
      traced.end({ level: "ERROR", statusMessage: String(e) });
      throw e;
    }
  }
};
```

### Test Pattern (copy this exactly):
```typescript
describe("resource.action", () => {
  beforeEach(async () => {
    await cleanupTestDB();       // real DB, real Docker postgres
    await seedTestFixtures();    // minimal realistic data
  });

  it("should [behavior] when [condition]", async () => {
    // Arrange — real data, real DB
    // Act — call the actual function
    // Assert — specific, not snapshots
  });
});
```

### Azure AI Foundry Pattern:
```typescript
// lib/llm/client.ts — already configured
// ALWAYS import from here, never instantiate AzureOpenAI directly
import { llm } from "@/lib/llm/client";
```
