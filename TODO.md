# ProcureAI B2B Pivot — Master TODO

**PRD:** `PRD.md` (single source of truth)  
**Branch:** `feat/b2b-procurement`  
**TDD Protocol:** RED → GREEN → REFACTOR (strict)  
**Test Strategy:** Real PostgreSQL + Redis via Docker (no mocks for infra)  
**Exec Order:** Sequential phases, atomic commits  

---

## 🔴 Phase 0 — Pre-Flight (COMPLETE ✅)

- [x] Start Docker containers: `docker start smart-commerce-postgres smart-commerce-redis`
- [x] Verify pgvector: `SELECT extname FROM pg_extension WHERE extname='vector';`
- [x] Create test DB: `CREATE DATABASE procureai_test;`
- [x] Enable pgvector on test DB
- [x] Verify Python 3.12+, uv, pnpm
- [x] Confirm Phase 1 gate passed

---

## 🗄️ Phase 1 — Database Schema (TDD)

**Gate:** Migrations clean, seed completes, integration tests green  
**PRD Ref:** Part 3 + Part 4

### 1A. Schema Modifications

**File:** `prisma/schema.prisma` (MODIFY existing)

**Tasks:**
- [ ] Add to existing `User` model:
  ```prisma
  role         EmployeeRole @default(EMPLOYEE)
  department   String?
  departmentId String?
  dept         Department? @relation(fields: [departmentId], references: [id])
  purchaseRequests PurchaseRequest[]
  ```
- [ ] Add enum:
  ```prisma
  enum EmployeeRole {
    EMPLOYEE
    MANAGER
    FINANCE
    ADMIN
  }
  ```
- [ ] Modify existing `Order` model — add:
  ```prisma
  prId         String?   @unique
  pr           PurchaseRequest? @relation(fields: [prId], references: [id])
  approvedById String?
  approvedBy   User?     @relation("OrderApprovals", fields: [approvedById], references: [id])
  ```
- [ ] ADD NEW models at bottom of file:
  - [ ] `Department` (PRD Part 3C)
  - [ ] `PurchaseRequest` (PRD Part 3D)
  - [ ] `PRLineItem` (PRD Part 3E)
  - [ ] `CatalogItem` (PRD Part 3F)
  - [ ] `PRApproval` (PRD Part 3G)
  - [ ] `PRAuditEntry` (PRD Part 3H)

**PRD Ref:** Part 3A through 3H

### 1B. Run Migration

```bash
npx prisma migrate dev --name "b2b_procurement_v1"
npx prisma generate
```

- [ ] Verify migration runs clean (no errors)
- [ ] Verify Prisma Studio shows 6 new tables

### 1C. Seed Data

**File:** `prisma/seed-b2b.ts` (NEW — PRD Part 4)

- [ ] Create seed file with PRD code
- [ ] Seed 3 departments (Engineering, Marketing)
- [ ] Seed 3 users (employee@acme.com, manager@acme.com, finance@acme.com)
- [ ] Seed 7 catalog items (MacBook, Dell Monitor, GitHub, Figma, AWS, Herman Miller, Notion)
- [ ] Run: `npx tsx prisma/seed-b2b.ts`
- [ ] Verify: `✅ B2B seed complete`

### 1D. Integration Tests (TDD — RED → GREEN)

**File:** `apps/web/tests/integration/schema.test.ts` (NEW)

**Test Strategy:** Real PostgreSQL via Docker

**Tests:**
- [ ] `test_department_model_crud` — create, read, update, delete
- [ ] `test_user_with_employee_role` — verify role enum works
- [ ] `test_catalog_item_search` — verify FTS + vector fields
- [ ] `test_purchase_request_create` — create PR, verify status=DRAFT
- [ ] `test_pr_line_item_total` — add line item, verify totalAmount updates
- [ ] `test_pr_approval_flow` — create approval record, verify status
- [ ] `test_pr_audit_entry` — create PR, verify audit entry exists
- [ ] `test_order_links_to_pr` — set prId on Order, verify relation
- [ ] `test_department_budget_fields` — verify monthlyBudget, spentThisMonth
- [ ] `test_catalog_category_enum` — verify HARDWARE, SOFTWARE, etc.
- [ ] `test_pr_status_enum` — verify all PRStatus values

**Run:** `cd apps/web && npx vitest run tests/integration/schema.test.ts`  
**Expected:** RED first (tables don't exist), then GREEN after migration

### 1E. Commit

```bash
git add prisma/schema.prisma prisma/seed-b2b.ts apps/web/tests/integration/schema.test.ts
git commit -m "feat(schema): B2B procurement models + seed + integration tests (11 tests)"
```

---

## 🤖 Phase 2 — Python Agent Tools (TDD)

**Gate:** 20+ unit tests pass, tools return `__ui__` events  
**PRD Ref:** Part 5  
**Test Infra:** Real PostgreSQL + Redis (Docker), zero mocks for DB

### 2A. Test Infrastructure (RED)

**File:** `apps/agent-core/tests/conftest.py` (REPLACE existing)

**Tasks:**
- [ ] Import `asyncpg`, `redis.asyncio`, `os`, `pytest`, `asyncio`
- [ ] Set env vars: `DATABASE_URL`, `REDIS_URL` to test instances
- [ ] `event_loop` fixture (session scope)
- [ ] `db_pool` fixture (session scope, asyncpg pool, real DB)
- [ ] `clean_db` fixture (autouse, TRUNCATE all B2B tables)
- [ ] `redis_client` fixture (session scope, aioredis)
- [ ] `clean_redis` fixture (autouse, flushdb)
- [ ] `dept` fixture — INSERT Department, return dict
- [ ] `employee` fixture — INSERT User (EMPLOYEE role)
- [ ] `manager` fixture — INSERT User (MANAGER role)
- [ ] `catalog_item` fixture — INSERT CatalogItem
- [ ] `draft_pr` fixture — INSERT PurchaseRequest (DRAFT status)
- [ ] `pending_pr` fixture — UPDATE to PENDING_APPROVAL + PRApproval
- [ ] `make_config()` helper — builds RunnableConfig with user_id, email, role, dept_id, thread_id

**Run:** `cd apps/agent-core && python -m pytest tests/test_tools.py -v`  
**Expected:** RED — ImportError (new tool names don't exist yet)

### 2B. Tool Tests (RED → GREEN)

**File:** `apps/agent-core/tests/test_tools.py` (REPLACE existing)

**PRD Ref:** Part 5 — Tools 1-7

#### TestSearchCatalog (4 tests)
- [ ] `test_returns_catalog_grid_ui_event` — asserts `__ui__.name == "catalog-grid"`
- [ ] `test_seeded_item_appears` — search "MacBook" finds seeded item
- [ ] `test_category_filter` — HARDWARE only, excludes SOFTWARE
- [ ] `test_price_filter` — max_unit_price excludes expensive items

#### TestGetBudgetStatus (3 tests)
- [ ] `test_returns_budget_gauge_ui_event` — `__ui__.name == "budget-gauge"`
- [ ] `test_calculates_remaining` — budget 50k, spent 20k → remaining 30k
- [ ] `test_100_percent_used` — spent == budget → pct 100

#### TestManagePurchaseRequest (6 tests)
- [ ] `test_create_generates_pr_number` — format: `PR-{year}-{NNNN}`
- [ ] `test_create_writes_audit_entry` — PRAuditEntry action='PR_CREATED'
- [ ] `test_add_item_blocked_over_budget` — budget 0 → error, NO line item
- [ ] `test_add_item_succeeds_within_budget` — line item created, total updated
- [ ] `test_view_returns_pr_draft_ui` — `__ui__.name == "pr-draft"`
- [ ] `test_view_returns_none_no_draft` — no DRAFT → `pr: null`

#### TestSubmitForApproval (4 tests)
- [ ] `test_changes_status_to_pending` — DRAFT → PENDING_APPROVAL
- [ ] `test_sets_pr_submitted_flag` — response has `__pr_submitted: true`
- [ ] `test_creates_approval_record` — PRApproval row exists
- [ ] `test_rejects_non_draft_pr` — already PENDING → error

#### TestProcessApproval (5 tests)
- [ ] `test_manager_can_approve` — MANAGER role → APPROVED
- [ ] `test_manager_can_reject` — MANAGER role → REJECTED
- [ ] `test_employee_cannot_approve` — EMPLOYEE → error
- [ ] `test_writes_audit_on_approval` — PRAuditEntry action='PR_APPROVED'
- [ ] `test_invalid_decision_rejected` — not APPROVED/REJECTED → error

#### TestGetPurchaseRequests (4 tests)
- [ ] `test_employee_sees_own_only` — filters by requestorId
- [ ] `test_manager_sees_all_dept` — no requestor filter for MANAGER
- [ ] `test_status_filter_applied` — status_filter works
- [ ] `test_pending_includes_thread_id` — approvalThreadId in response

#### TestRaiseDispute (1 test)
- [ ] `test_returns_dispute_card_ui` — status → DISPUTED, `__ui__.name == "dispute-card"`

**Total:** 27 tests

**Run:** `python -m pytest tests/test_tools.py -v --tb=short`  
**Expected:** RED (tools not implemented), then GREEN

### 2C. Implement Tools (GREEN)

**File:** `apps/agent-core/src/tools.py` (REPLACE — PRD Part 5)

**Strategy:** Comment out old B2C tools, add 7 new B2B tools

**Tools to implement:**
- [ ] `search_catalog` (Tool 1 — PRD Part 5)
- [ ] `get_budget_status` (Tool 2)
- [ ] `manage_purchase_request` (Tool 3)
- [ ] `submit_for_approval` (Tool 4)
- [ ] `get_purchase_requests` (Tool 5)
- [ ] `process_approval` (Tool 6)
- [ ] `raise_dispute` (Tool 7)

**Export:** `ALL_TOOLS = [search_catalog, get_budget_status, ...]` (PRD Part 5 — EXPORT LIST)

**Run:** `python -m pytest tests/test_tools.py -v`  
**Expected:** GREEN — all 27 tests pass

### 2D. Commit

```bash
git add apps/agent-core/src/tools.py apps/agent-core/tests/test_tools.py apps/agent-core/tests/conftest.py
git commit -m "feat(agent): 7 B2B tools (search_catalog, get_budget_status, manage_purchase_request, submit_for_approval, get_purchase_requests, process_approval, raise_dispute) + 27 tests"
```

---

## 🔄 Phase 3 — LangGraph Graph Update (TDD)

**Gate:** `interrupt()` fires on submit, `Command(resume=)` unfreezes  
**PRD Ref:** Part 6

### 3A. Graph Tests (RED)

**File:** `apps/agent-core/tests/test_graph.py` (NEW)

**Tests:**
- [ ] `test_graph_interrupts_after_submit` — interrupt payload type="pr_approval_required"
- [ ] `test_graph_resumes_on_approved` — `Command(resume="APPROVED")` → agent message
- [ ] `test_graph_resumes_on_rejected` — `Command(resume="REJECTED")` → agent message
- [ ] `test_route_after_tools_returns_approval_gate` — `__pr_submitted: True` → "approval_gate"
- [ ] `test_route_after_tools_returns_agent` — normal result → "agent"

**Run:** `python -m pytest tests/test_graph.py -v`  
**Expected:** RED — `approval_gate_node` doesn't exist

### 3B. Graph Implementation (GREEN)

**File:** `apps/agent-core/src/graph.py` (MODIFY — PRD Part 6B)

**Changes:**
- [ ] Import: `from langgraph.types import interrupt, Command`
- [ ] Extend `AgentState` with B2B fields (pending_pr_id, pending_pr_number, etc.)
- [ ] Add `approval_gate_node` (PRD Part 6B)
- [ ] Add `route_after_tools` function
- [ ] Add `approval_gate` node to builder
- [ ] Replace `builder.add_edge("tools", "agent")` with conditional edge
- [ ] Update SYSTEM_PROMPT to ProcureAI (PRD Part 6A)
- [ ] Extend configurable context with role + department_id (PRD Part 6C)

**Run:** `python -m pytest tests/test_graph.py -v`  
**Expected:** GREEN

### 3C. Commit

```bash
git add apps/agent-core/src/graph.py apps/agent-core/tests/test_graph.py
git commit -m "feat(graph): HITL approval gate + conditional routing + ProcureAI system prompt"
```

---

## 🌐 Phase 4 — Web Auth + API (TDD)

**Gate:** Role+deptId forwarded, RBAC blocks unauthorized  
**PRD Ref:** Part 7

### 4A. Auth Tests (RED)

**File:** `apps/web/__tests__/auth.test.tsx` (NEW)

**Tests:**
- [ ] `test_jwt_callback_includes_role` — role in JWT token
- [ ] `test_session_callback_includes_role` — role in session.user
- [ ] `test_rbac_blocks_employee_from_manager_route` — redirect to /chat
- [ ] `test_rbac_allows_manager_to_manager_route` — NextResponse.next()
- [ ] `test_stream_route_forwards_role_and_deptId` — verify payload

**Run:** `cd apps/web && npx vitest run __tests__/auth.test.tsx`  
**Expected:** RED — middleware/file doesn't exist

### 4B. Auth Implementation (GREEN)

**File:** `apps/web/lib/auth-options.ts` (MODIFY — PRD Part 7A)

**Changes:**
- [ ] Extend jwt callback: add `role`, `departmentId` to token
- [ ] Extend session callback: copy role, departmentId to session.user

**File:** `apps/web/middleware.ts` (NEW — PRD Part 7B)

**Changes:**
- [ ] Create middleware with RBAC for /manager/* and /finance/* routes
- [ ] Use `getToken` from next-auth/jwt
- [ ] Redirect unauthorized users to /chat

**File:** `apps/web/app/api/chat/stream/route.ts` (MODIFY — PRD Part 7C)

**Changes:**
- [ ] Forward `role` and `department_id` to agent payload

**Run:** `npx vitest run __tests__/auth.test.tsx`  
**Expected:** GREEN

### 4C. Commit

```bash
git add apps/web/lib/auth-options.ts apps/web/middleware.ts apps/web/app/api/chat/stream/route.ts apps/web/__tests__/auth.test.tsx
git commit -m "feat(web): RBAC middleware + role/deptId in session + stream route"
```

---

## 🎨 Phase 5 — Web GenUI Components (TDD)

**Gate:** All 7 UI events render correctly  
**PRD Ref:** Part 7E through 7I

### 5A. Type Definitions

**File:** `apps/web/lib/ui-event-types.ts` (MODIFY)

**Tasks:**
- [ ] Rename types: ProductGridProps → CatalogGridProps, etc.
- [ ] Add new types: BudgetGaugeProps, BudgetAlertProps, PRSubmittedProps, ApprovalCardProps
- [ ] Update UIEventMap with 7 B2B events

### 5B. Rename + Modify Components

**Components to RENAME (copy + modify):**
- [ ] `ProductGrid.tsx` → `CatalogGrid.tsx` (PRD Part 7E)
  - Tests: `ProductGrid.test.tsx` → `CatalogGrid.test.tsx`
- [ ] `CartCanvas.tsx` → `PurchaseRequestDraft.tsx` (PRD Part 7F)
  - Tests: `CartCanvas.test.tsx` → `PurchaseRequestDraft.test.tsx`
- [ ] `OrderList.tsx` → `PRList.tsx`
  - Tests: `OrderList.test.tsx` → `PRList.test.tsx`
- [ ] `ReturnCard.tsx` → `DisputeCard.tsx`
  - Tests: `ReturnCard.test.tsx` → `DisputeCard.test.tsx`

### 5C. New Components

**Files to CREATE:**
- [ ] `ApprovalCard.tsx` (PRD Part 7G — 220 lines)
  - Tests: `ApprovalCard.test.tsx`
- [ ] `BudgetGauge.tsx` (PRD Part 7H)
  - Tests: `BudgetGauge.test.tsx`
- [ ] `BudgetAlert.tsx` (PRD Part 7I)
  - Tests: `BudgetAlert.test.tsx`

### 5D. Chat Screen Integration

**File:** `apps/web/app/(chat)/page.tsx` (MODIFY)

- [ ] Add cases for 7 B2B UI events in render switch
- [ ] Ensure PRSubmittedCard component exists

### 5E. Suggested Actions

**File:** `apps/web/components/SuggestedActions.tsx` (MODIFY — PRD Part 8)

- [ ] Add EMPLOYEE_CHIPS and MANAGER_CHIPS arrays
- [ ] Role-aware rendering based on user.role

### 5F. Commit (multiple atomic commits)

```bash
git commit -m "feat(genui): CatalogGrid (renamed from ProductGrid) with vendor + lead time"
git commit -m "feat(genui): PurchaseRequestDraft (renamed from CartCanvas) with approval CTA"
git commit -m "feat(genui): PRList + DisputeCard renamed, ApprovalCard/BudgetGauge/BudgetAlert new"
git commit -m "feat(web): integrate 7 B2B GenUI events into chat screen"
git commit -m "feat(web): role-aware suggested action chips"
```

---

## 📱 Phase 6 — Mobile GenUI (TDD, Parallel with Phase 5)

**Gate:** Same 7 events render in Expo emulator  
**PRD Ref:** (Mobile equivalent of Phase 5)

### 6A-6K. Mobile Components

**Tasks:** Same as Phase 5 but in `apps/mobile/src/components/genui/`

- [ ] CatalogGrid (rename + modify)
- [ ] PurchaseRequestDraft (rename + modify)
- [ ] PRList (rename)
- [ ] DisputeCard (rename)
- [ ] ApprovalCard (NEW)
- [ ] BudgetGauge (NEW)
- [ ] BudgetAlert (NEW)
- [ ] useApprovalDecision hook (NEW)
- [ ] Chat store update (UIEventMap)
- [ ] Suggested Actions chips
- [ ] Expo push token registration

### 6L. Commit

```bash
git commit -m "feat(mobile): B2B GenUI components + hooks + push token registration"
```

---

## 📢 Phase 7 — Notifications (TDD)

**Gate:** Toast <500ms (tab open), email/push (tab closed)  
**PRD Ref:** (Implicit in submit_for_approval + process_approval)

### 7A. Environment Setup

- [ ] Add Upstash + QStash + Resend env vars
- [ ] Start ngrok for NEXT_PUBLIC_APP_URL

### 7B-7G. Notification Components

- [ ] Upstash client (`apps/web/lib/upstash.ts`)
- [ ] Email service (`apps/web/lib/email.ts`)
- [ ] Expo push service (`apps/web/lib/expo-push.ts`)
- [ ] SSE subscribe endpoint (`apps/web/app/api/notifications/subscribe/route.ts`)
- [ ] QStash deliver endpoint (`apps/web/app/api/notifications/deliver/route.ts`)
- [ ] Seen mark endpoint (`apps/web/app/api/notifications/seen/route.ts`)
- [ ] usePRNotifications hook (`apps/web/hooks/usePRNotifications.ts`)

### 7H. Commit

```bash
git commit -m "feat(notifications): Upstash + QStash + Resend + Expo push + SSE + hooks"
```

---

## 🧪 Phase 8 — Tests + Copy Pass (TDD)

**Gate:** CI green, Playwright passes, Maestro passes  
**PRD Ref:** Part 9 + copy pass instructions

### 8A. Python Unit Tests

- [ ] Run: `cd apps/agent-core && python -m pytest tests/ -v`
- [ ] Verify 27+ tests pass

### 8B. Playwright E2E

**File:** `apps/web/cypress/e2e/approval-flow.cy.ts` (NEW)

**Scenarios:**
- [ ] Employee creates PR and submits
- [ ] Manager approves pending PR
- [ ] Budget alert fires when limit exceeded

**Run:** `npx playwright test tests/e2e/approval-flow.spec.ts`

### 8C. Maestro Mobile E2E

**File:** `apps/mobile/.maestro/09-approval-flow.yaml` (NEW)

**Run:** `cd apps/mobile && npx maestro test .maestro/09-approval-flow.yaml`

### 8D. Copy/Label Pass (LAST)

**Global find-replace in `apps/web/src` and `apps/mobile/src`:**
- [ ] "Add to Cart" → "Add to Request"
- [ ] "Your Cart" → "Purchase Request"
- [ ] "Checkout" → "Submit for Approval"
- [ ] "Order History" → "PR History"
- [ ] "Order #" → "PR #"
- [ ] "customer" → "employee"
- [ ] "store" → "catalog"
- [ ] "product" → "item"
- [ ] "TechTrend" → "ProcureAI"
- [ ] Tab labels: "Shop" → "Catalog", "Orders" → "My Requests"

### 8E. Full CI Run

- [ ] Push branch: `git push origin feat/b2b-procurement`
- [ ] Watch GitHub Actions — all jobs green

### 8F. Commit

```bash
git commit -m "test(e2e): Playwright + Maestro approval flows"
git commit -m "chore(copy): B2B terminology pass (customer→employee, cart→PR, etc.)"
```

---

## 📊 Final Verification Checklist

- [ ] Phase 1: 11/11 integration tests pass, seed completes
- [ ] Phase 2: 27+ Python tool tests pass (real DB), tools return `__ui__` events
- [ ] Phase 3: HITL interrupt/resume works manually
- [ ] Phase 4: RBAC blocks unauthorized, role+deptId forwarded
- [ ] Phase 5: All 7 GenUI events render in web browser
- [ ] Phase 6: All 7 GenUI events render in Expo emulator
- [ ] Phase 7: Toast <500ms (tab open), email/push (tab closed)
- [ ] Phase 8: Playwright 3/3 pass, Maestro passes, CI green, copy pass complete
- [ ] Langfuse: `department_id` + `role` metadata on every span
- [ ] Demo script runs end-to-end in <3 minutes

---

## 🚨 Stop Conditions

**STOP and report if:**
- [ ] Any Prisma migration fails
- [ ] Any existing test turns RED
- [ ] `/stream` stops returning `__ui__` events
- [ ] `interrupt()` fires but `Command(resume=)` doesn't unfreeze
- [ ] Upstash PUBLISH returns non-200
- [ ] SSE connection drops repeatedly

**Do NOT skip ahead.** Report: phase + file + exact error + stack trace.

---

## 📝 Commit Sequence (Exact Order)

```bash
# Phase 1
git commit -m "feat(schema): B2B procurement models + seed + integration tests (11 tests)"

# Phase 2
git commit -m "feat(agent): 7 B2B tools + 27 tests (real DB, zero mocks)"

# Phase 3
git commit -m "feat(graph): HITL approval gate + conditional routing + ProcureAI prompt"

# Phase 4
git commit -m "feat(web): RBAC middleware + role/deptId in session + stream route"

# Phase 5
git commit -m "feat(genui): 7 B2B GenUI components + chat integration"

# Phase 6
git commit -m "feat(mobile): B2B GenUI components + hooks + push tokens"

# Phase 7
git commit -m "feat(notifications): Upstash + QStash + Resend + Expo + SSE"

# Phase 8
git commit -m "test(e2e): Playwright + Maestro approval flows + copy pass"
```

---

**Last updated:** 2026-04-30  
**Owner:** Aparna (Staff+ Full-Stack Architect)  
**Status:** Phase 1 READY — start with schema migration + tests
