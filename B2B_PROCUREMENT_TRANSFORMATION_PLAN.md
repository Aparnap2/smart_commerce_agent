# B2B Procurement Transformation Plan

## Executive Summary

This document outlines a comprehensive transformation plan to pivot the existing TechTrend B2C e-commerce platform into **ProcureAI**, a B2B internal procurement platform. The transformation follows the PRD specifications while preserving existing functionality through additive migrations.

---

## Current State Analysis

### Existing Codebase Structure

| Component | Current Technology | Location |
|-----------|-------------------|----------|
| Database | PostgreSQL + pgvector | `prisma/schema.prisma` |
| Agent Core | Python (LangGraph) | `apps/agent-core/src/` |
| Tools | 5 tools (search_products, view_cart, add_to_cart, get_orders, initiate_return) | `apps/agent-core/src/tools.py` |
| Graph | StateGraph with ToolNode | `apps/agent-core/src/graph.py` |
| Web App | Next.js 15 | `apps/web/app/` |
| GenUI | ProductGrid, CartCanvas, OrderList, ReturnCard | `apps/web/components/genui/` |
| Auth | Zustand store with hardcoded demo users | `apps/web/lib/auth/store.ts` |
| Middleware | JWT-based route protection | `apps/web/middleware.ts` |
| Mobile | Expo (React Native) | `mobile/` |

### Key Patterns Identified

1. **Tool Pattern**: All tools use `@tool` decorator, accept `RunnableConfig`, return JSON with `__ui__` key for GenUI rendering
2. **GenUI Pattern**: Components receive props from tool output, render in chat stream
3. **State Management**: Zustand for auth, chat state in separate stores
4. **API Pattern**: Web proxies requests to agent-core via SSE streaming

---

## Transformation Plan

### Phase 1: Database Schema Changes

#### 1.1 Prisma Schema Updates

**File**: `prisma/schema.prisma`

| Change Type | Model | Fields to Add |
|-------------|-------|---------------|
| MODIFY | User | `role` → rename to `EmployeeRole` enum, add `department`, `departmentId` |
| MODIFY | Order | Add `prId`, `pr` relation, `approvedById`, `approvedBy` relation |
| ADD | Department | New model with budget tracking |
| ADD | PurchaseRequest | New model for PR workflow |
| ADD | PRLineItem | Line items for PRs |
| ADD | CatalogItem | Replaces Product for B2B |
| ADD | PRApproval | Approval records |
| ADD | PRAuditEntry | Immutable audit trail |

**Migration Command**:
```bash
npx prisma migrate dev --name "b2b_procurement_v1"
npx prisma generate
```

#### 1.2 Seed Data

**File**: `prisma/seed-b2b.ts` (NEW)

Creates:
- 2 Departments (Engineering, Marketing)
- 3 Users (Employee, Manager, Finance with different roles)
- 7 Catalog Items (MacBook, Dell Monitor, GitHub Enterprise, etc.)

---

### Phase 2: Python Agent Tools

#### 2.1 Replace Tools

**File**: `apps/agent-core/src/tools.py`

| Old Tool | New Tool | Status |
|----------|----------|--------|
| search_products | search_catalog | REPLACE |
| view_cart | (removed) | DEPRECATE |
| add_to_cart | manage_purchase_request | REPLACE |
| get_orders | get_purchase_requests | REPLACE |
| initiate_return | raise_dispute | REPLACE |
| — | get_budget_status | NEW |
| — | submit_for_approval | NEW |
| — | process_approval | NEW |

#### 2.2 Graph Updates

**File**: `apps/agent-core/src/graph.py`

| Change | Description |
|--------|-------------|
| SYSTEM_PROMPT | Update to ProcureAI context |
| AgentState | Add `pending_pr_*` fields, `awaiting_approval` |
| approval_gate_node | NEW - HITL interrupt node |
| route_after_tools | NEW - Conditional edge for PR submission |
| Configurable | Add `role`, `department_id` to config |

---

### Phase 3: Web Application Updates

#### 3.1 Auth Updates

**File**: `apps/web/lib/auth/store.ts`

| Change | Description |
|--------|-------------|
| User type | Add `departmentId` field |
| Role enum | Add `EMPLOYEE`, `MANAGER`, `FINANCE`, `ADMIN` |
| Demo users | Update to B2B employees with departments |

#### 3.2 Middleware RBAC

**File**: `apps/web/middleware.ts`

| Route | Access |
|-------|--------|
| `/manager/*` | MANAGER, ADMIN only |
| `/finance/*` | FINANCE, ADMIN only |
| `/chat` | All authenticated users |

#### 3.3 API Stream Endpoint

**File**: `apps/web/app/api/agent/route.ts`

Add to payload:
```typescript
{
  role: session.user.role,
  department_id: session.user.departmentId
}
```

#### 3.4 GenUI Types

**File**: `apps/web/lib/genui/types.ts`

Add to UIEventMap:
- `catalog-grid`: CatalogGridProps
- `pr-draft`: PRDraftProps
- `pr-list`: PRListProps
- `budget-gauge`: BudgetGaugeProps
- `budget-alert`: BudgetAlertProps
- `pr-submitted`: PRSubmittedProps
- `approval-card`: ApprovalCardProps
- `dispute-card`: DisputeCardProps

---

### Phase 4: GenUI Components

#### 4.1 Component Mapping

| Old Component | New Component | Action |
|---------------|---------------|--------|
| ProductGrid | CatalogGrid | RENAME + modify |
| CartCanvas | PurchaseRequestDraft | RENAME + modify |
| OrderList | PRList | RENAME + modify |
| ReturnCard | DisputeCard | RENAME + modify |
| — | ApprovalCard | NEW |
| — | BudgetGauge | NEW |
| — | BudgetAlert | NEW |

#### 4.2 Component Details

**CatalogGrid** (`apps/web/components/genui/CatalogGrid.tsx`):
- Change "Product" → "Item"
- Change "Add to Cart" → "Add to Request"
- Add vendor info, lead time
- Remove star rating

**PurchaseRequestDraft** (`apps/web/components/genui/PurchaseRequestDraft.tsx`):
- Show PR number badge
- Show justification
- Button: "Submit for Manager Approval"

**ApprovalCard** (`apps/web/components/genui/ApprovalCard.tsx`):
- Manager-facing approval UI
- Approve/Reject buttons
- Comments input
- Urgency badge

**BudgetGauge** (`apps/web/components/genui/BudgetGauge.tsx`):
- Animated progress bar
- Color coding (green < 70%, amber 70-90%, red > 90%)

**BudgetAlert** (`apps/web/components/genui/BudgetAlert.tsx`):
- Warning card for budget exceeded
- Shows item, requested amount, remaining

---

### Phase 5: Mobile App Updates

#### 5.1 GenUI Components

**Files**: `mobile/src/components/genui/`

| Component | Description |
|-----------|-------------|
| CatalogGrid.tsx | Copy from web, adapt for RN |
| PurchaseRequestDraft.tsx | Copy from web, adapt for RN |
| ApprovalCard.tsx | NEW - Full implementation |
| BudgetGauge.tsx | NEW - Animated progress |
| BudgetAlert.tsx | NEW - Warning card |

#### 5.2 State Updates

**File**: `mobile/src/store/chat.store.ts`

Add B2B types to UIEventMap

---

### Phase 6: Notifications (Optional Enhancement)

#### 6.1 Upstash Redis + QStash

| File | Purpose |
|------|---------|
| `apps/web/lib/upstash.ts` | Redis + QStash clients |
| `apps/web/app/api/notifications/subscribe/route.ts` | SSE endpoint |
| `apps/web/app/api/notifications/deliver/route.ts` | QStash handler |
| `apps/web/app/api/notifications/seen/route.ts` | Mark seen |
| `apps/web/hooks/usePRNotifications.ts` | Toast + chat injection |
| `apps/agent-core/src/notifications.py` | Publish events |

#### 6.2 Approval Flow

1. Employee submits PR → `submit_for_approval` → `interrupt()`
2. Manager sees ApprovalCard → clicks Approve
3. POST `/api/procurement/approve` → resumes graph
4. Notification published → employee sees toast

---

### Phase 7: Tests

#### 7.1 Python Unit Tests

**File**: `apps/agent-core/tests/test_tools.py`

Add test classes:
- `TestSearchCatalog`
- `TestManagePurchaseRequest`
- `TestSubmitForApproval`
- `TestProcessApproval`
- `TestGetBudgetStatus`

#### 7.2 Playwright E2E

**File**: `apps/web/tests/e2e/approval-flow.spec.ts`

Test scenarios:
- Employee creates PR and submits
- Manager approves pending PR
- Budget alert fires when limit exceeded

---

### Phase 8: Copy/Label Updates

Run find/replace across UI strings:

| Old | New |
|-----|-----|
| Add to Cart | Add to Request |
| Your Cart | Purchase Request |
| Checkout | Submit for Approval |
| Order History | PR History |
| Order # | PR # |
| customer | employee |
| store | catalog |
| product | item |
| TechTrend | ProcureAI |
| Shop | Catalog |
| Orders | My Requests |

---

## File-Level Implementation Map

### Database
- [ ] `prisma/schema.prisma` - Add B2B models
- [ ] `prisma/seed-b2b.ts` - NEW seed file

### Agent Core (Python)
- [ ] `apps/agent-core/src/tools.py` - Replace with 7 procurement tools
- [ ] `apps/agent-core/src/graph.py` - Add approval_gate node
- [ ] `apps/agent-core/src/main.py` - Add /procurement/approve endpoint
- [ ] `apps/agent-core/src/notifications.py` - NEW (optional)

### Web App
- [ ] `apps/web/lib/auth/store.ts` - Add department + B2B roles
- [ ] `apps/web/middleware.ts` - Add RBAC for /manager, /finance
- [ ] `apps/web/app/api/agent/route.ts` - Pass role + department_id
- [ ] `apps/web/lib/genui/types.ts` - Add B2B UIEventMap types
- [ ] `apps/web/components/genui/CatalogGrid.tsx` - NEW (from ProductGrid)
- [ ] `apps/web/components/genui/PurchaseRequestDraft.tsx` - NEW (from CartCanvas)
- [ ] `apps/web/components/genui/PRList.tsx` - NEW (from OrderList)
- [ ] `apps/web/components/genui/DisputeCard.tsx` - NEW (from ReturnCard)
- [ ] `apps/web/components/genui/ApprovalCard.tsx` - NEW
- [ ] `apps/web/components/genui/BudgetGauge.tsx` - NEW
- [ ] `apps/web/components/genui/BudgetAlert.tsx` - NEW
- [ ] `apps/web/components/genui/index.ts` - Export new components
- [ ] `apps/web/app/api/procurement/approve/route.ts` - NEW

### Mobile
- [ ] `mobile/src/components/genui/CatalogGrid.tsx` - NEW
- [ ] `mobile/src/components/genui/PurchaseRequestDraft.tsx` - NEW
- [ ] `mobile/src/components/genui/ApprovalCard.tsx` - NEW
- [ ] `mobile/src/components/genui/BudgetGauge.tsx` - NEW
- [ ] `mobile/src/components/genui/BudgetAlert.tsx` - NEW
- [ ] `mobile/src/store/chat.store.ts` - Add B2B types
- [ ] `mobile/src/hooks/useApprovalDecision.ts` - NEW

### Tests
- [ ] `apps/agent-core/tests/test_tools.py` - Add B2B tests
- [ ] `apps/web/tests/e2e/approval-flow.spec.ts` - NEW

---

## Commit Sequence

Following PRD order:

1. `feat(schema): add B2B procurement models`
2. `feat(seed): add departments, employees, catalog`
3. `feat(agent): replace tools with 7 procurement tools`
4. `feat(graph): add approval_gate HITL node`
5. `feat(web): pass role+deptId in session+stream`
6. `feat(web): add RBAC middleware for /manager`
7. `feat(genui): add ApprovalCard, BudgetGauge, BudgetAlert`
8. `feat(genui): rename ProductGrid→CatalogGrid, Cart→PRDraft`
9. `feat(mobile): B2B genui components + role-aware chips`
10. `test(e2e): add approval-flow Playwright + Maestro tests`
11. `chore(copy): B2B terminology pass (customer→employee etc)`

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing tests | Keep old tests, add new ones alongside |
| Data migration | Use additive migrations only |
| Downtime | Feature flags for gradual rollout |
| Auth breaking | Maintain backward compatibility during transition |

---

## Estimated Impact

| Metric | Value |
|--------|-------|
| Files changed | ~25 |
| New files | ~15 |
| LOC changed | ~800 |
| LOC unchanged | ~14,000 |
| Estimated time | 2 weekends |

---

## Approval Required

This transformation plan is ready for implementation. Please review and approve to begin Phase 1 (Database Schema Changes).

**Key Principles**:
- ✅ Never rewrite working code - extend/rename only
- ✅ Atomic commits - one concern per commit
- ✅ Additive migrations over destructive changes
- ✅ Keep existing tests green
- ✅ Feature flags for gradual rollout