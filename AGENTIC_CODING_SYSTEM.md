# 🤖 AGENTIC CODING SYSTEM — COMPLETE

**Date**: 2026-02-18  
**Status**: ✅ FULLY IMPLEMENTED

---

## 📁 THE SYSTEM: 5 FILES THAT CONTROL EVERYTHING

```
smart-commerce-agent/
├── CLAUDE.md              ← Agent brain: reads this FIRST, every session
├── AGENTS.md              ← Shared rules (Cursor + Codex + Claude)
├── TASKS.md               ← Living task board: phases, todos, progress
├── Makefile               ← Updated with agent commands
└── .cursor/rules/
    ├── tdd.mdc            ← TDD workflow enforcement
    └── infra.mdc          ← Docker, Azure, environment rules
```

---

## 🚀 HOW TO START EACH SESSION

Paste this into your coding agent at the start of every session:

```
Read CLAUDE.md first.
Then run: make agent-briefing
Then read TASKS.md and tell me:
1. What containers are running
2. What the current active task is  
3. Your plan (tests first) before writing any code
use context7 for any library APIs you need
```

---

## 🎯 WHAT EACH FILE DOES

### 1. CLAUDE.md (Agent Brain)

**Purpose**: Agent reads this FIRST every single session

**Enforces**:
- Docker check before any code (`docker ps -a`)
- DB state check (`docker exec ... psql`)
- Test status check (`pnpm test`)
- TDD workflow (tests BEFORE code)
- Azure AI Foundry (NEVER Ollama)
- No UCP protocol (Stripe MCP only)
- No disabled LangGraph (must be active)

**Key Section**:
```markdown
## ⚡ MANDATORY: Do This FIRST, Every Single Session

Before writing ANY code, run these commands and read their output:

# 1. What's actually running?
docker ps -a

# 2. What's the current state of the DB?
docker exec smart-commerce-postgres-1 psql -U postgres smart_commerce \
  -c "\dt" -c "SELECT COUNT(*) FROM \"Product\";"

# 3. Any failing tests right now?
pnpm test --passWithNoTests 2>&1 | tail -20
```

### 2. AGENTS.md (Shared Context)

**Purpose**: Architecture overview for all agents (Cursor, Codex, Claude)

**Contains**:
- Tech stack table (active — no dead code)
- Key design decisions (5 rules)
- File map (critical files)
- Environment variables list
- Current phase reference

**Key Section**:
```markdown
## Key Design Decisions (Don't Revisit Without Good Reason)

1. **MCP over raw DB calls**: All agent-initiated side effects go through
   MCP tools. Tools are Zod-validated, user-scoped, and traced.

2. **Stripe MCP over raw Stripe SDK**: All payment operations use
   @stripe/agent-toolkit.

3. **FTS + pgvector over external search**: Hybrid search lives in Postgres.
   No Qdrant, no OpenSearch.

4. **LangGraph only, no LangChain**: LangGraph compiles the full graph.

5. **Real infra for all tests**: Jest integration tests use real Docker
   Postgres + Redis. No mocks.
```

### 3. TASKS.md (Living Task Board)

**Purpose**: Source of truth for what's done, active, and next

**Agent MUST**: Update this after completing ANY task

**Structure**:
```markdown
## 🔴 Phase 1: Foundation (Week 1)
- [x] Completed task
- [ ] Active task ← Agent works on this
- [ ] Next task

## ✅ Completed
- [x] List of all done items

## 🐛 Known Issues / Blockers
<!-- Agent: add issues here as you find them -->

## 📝 Architecture Decisions Log
<!-- Agent: document WHY decisions were made here -->
```

### 4. .cursor/rules/tdd.mdc (TDD Enforcement)

**Purpose**: Enforces TDD workflow on every code change

**Rules**:
- Test FIRST. Every single time. No exceptions.
- Red → Green → Refactor
- No mocks for DB/Redis in integration tests
- Real Azure AI Foundry for LLM tests
- Before marking task done: all 4 checks must pass
  - Unit tests pass
  - Feature tests pass
  - DB state correct
  - No TypeScript/lint errors

### 5. .cursor/rules/infra.mdc (Infrastructure Rules)

**Purpose**: Docker, Azure, environment variable enforcement

**Rules**:
- Always check `docker ps -a` before any task
- Expected: 4 containers healthy (app, postgres, redis, langfuse)
- Azure AI Foundry pattern: `import { llm } from "@/lib/llm/client"`
- Never hardcode credentials
- context7 usage guidelines
- ddg-mcp usage guidelines

---

## 🛠️ NEW MAKE COMMANDS

### Agent Commands

```bash
make context         # Print full project context for agent
make plan            # Show next active task from TASKS.md
make agent-briefing  # Full briefing to paste into agent
```

### Example: Starting a Session

```bash
# Run this and paste output into agent
make agent-briefing
```

**Output**:
```
## Agent Briefing — Wed Feb 18 13:30:00 UTC 2026

=== Docker Status ===
smart-commerce-postgres-1   Up (healthy)
smart-commerce-redis-1      Up (healthy)
smart-commerce-langfuse-1   Up

=== DB Tables ===
[Lists all tables]

=== Product Count ===
20

=== Redis Keys ===
15

=== Active Task ===
- [ ] Integrate semantic chunking into indexDocument
- [ ] Wire reranker into ragQuery

=== Recent Git Log ===
abc123 Add RAG enhancements
def456 Update docker-compose

=== Files to Read First ===
1. CLAUDE.md (agent instructions)
2. AGENTS.md (architecture context)
3. TASKS.md (current task)
4. .cursor/rules/tdd.mdc (TDD workflow)
5. .cursor/rules/infra.mdc (infra rules)
```

---

## ✅ WHAT THIS SYSTEM PREVENTS

### Hallucination Prevention
- Agent MUST check real infra state before coding
- Agent MUST read existing files before editing
- Agent MUST write tests BEFORE code
- Agent MUST use real Azure AI Foundry (not mocks)

### Context Loss Prevention
- CLAUDE.md ensures agent knows the rules every session
- AGENTS.md provides architecture context
- TASKS.md tracks what's done vs next
- .cursor/rules enforce patterns automatically

### Quality Prevention
- TDD enforced (tests first)
- Real infra for all tests (no mocks)
- Zod validation required
- Langfuse tracing mandatory
- No `any` TypeScript types

---

## 🎯 HOW AGENT WORKS NOW

### Before (Chaotic)
```
User: "Add cart feature"
Agent: Writes code → Tests fail → Debugs → More code → Tests pass
Result: Brittle code, no docs, context lost next session
```

### After (Agentic System)
```
User: "Add cart feature"
Agent:
  1. Runs `make agent-briefing`
  2. Reads CLAUDE.md (knows rules)
  3. Reads TASKS.md (finds active task)
  4. Writes plan with tests first
  5. Shows plan, waits for approval
  6. Writes failing test (RED)
  7. Writes minimum code to pass (GREEN)
  8. Refactors (CLEAN)
  9. Updates TASKS.md with [x]
  10. Documents decision in Architecture Decisions Log
Result: Tested code, updated docs, context preserved
```

---

## 📊 FILES CREATED/UPDATED

| File | Purpose | Lines |
|------|---------|-------|
| `CLAUDE.md` | Agent brain | 150 |
| `AGENTS.md` | Architecture context | 100 |
| `TASKS.md` | Living task board | 200 |
| `.cursor/rules/tdd.mdc` | TDD enforcement | 120 |
| `.cursor/rules/infra.mdc` | Infra rules | 100 |
| `Makefile` | Updated with agent commands | +50 |
| **Total** | | **720 lines** |

---

## 🚀 NEXT STEPS

1. **Test the system**:
   ```bash
   make agent-briefing
   ```

2. **Start a session with agent**:
   ```
   Read CLAUDE.md first.
   Then run: make agent-briefing
   Then read TASKS.md and tell me:
   1. What containers are running
   2. What the current active task is  
   3. Your plan (tests first) before writing any code
   ```

3. **Watch agent work**:
   - Agent reads CLAUDE.md ✅
   - Agent runs `make agent-briefing` ✅
   - Agent writes plan with tests first ✅
   - Agent writes failing test ✅
   - Agent writes code to pass ✅
   - Agent updates TASKS.md ✅

---

## 🎯 SUCCESS CRITERIA

- [ ] Agent reads CLAUDE.md every session
- [ ] Agent runs `make agent-briefing` before coding
- [ ] Agent writes tests BEFORE code
- [ ] Agent updates TASKS.md after each task
- [ ] Agent uses real Azure AI Foundry (not mocks)
- [ ] Agent checks Docker state before any task
- [ ] No `any` TypeScript types
- [ ] All tests pass before marking task done

---

**System Status**: ✅ COMPLETE  
**Ready for**: Production agentic coding  
**Next Session**: Paste the startup prompt into your agent
