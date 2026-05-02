Here is the complete, production-grade PRD + coding agent instruction set. [abstractalgorithms](https://www.abstractalgorithms.dev/langgraph-human-in-the-loop)

***

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRD + CODING AGENT INSTRUCTIONS
PROCUREAI — B2B INTERNAL PROCUREMENT PLATFORM
Pivoted from: TechTrend Smart Commerce
Version: 1.0  |  Date: April 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 0 — INSTRUCTIONS FOR THE CODING AGENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are implementing a pivot of an existing, fully-working
codebase. Your operating principles are:

  1. NEVER rewrite working code. Extend or rename only.
  2. Every change must be atomic — one concern per commit.
  3. Prefer additive migrations (new columns/tables) over
     destructive changes.
  4. Keep all existing tests green. Add new tests alongside
     new features, never delete old ones until deprecated.
  5. When in doubt, add a feature flag:
       FEATURE_B2B_PROCUREMENT=true
     and gate new behaviour behind it.
  6. All new tool functions must follow the existing
     pattern: async def tool_name(..., config: RunnableConfig)
  7. All new GenUI components follow the existing pattern:
     server emits __ui__: { name, props } in tool output;
     client renders via the UIEventMap discriminated union.
  8. Do not touch: CI config, Docker setup, Langfuse
     instrumentation, Redis config, or Azure infra files.

Commit order (do not skip steps):
  Step 1 → Prisma schema + migration
  Step 2 → Seed data
  Step 3 → Python agent tools
  Step 4 → LangGraph graph update
  Step 5 → Next.js API + RBAC
  Step 6 → Web GenUI components
  Step 7 → Mobile GenUI components
  Step 8 → Test updates
  Step 9 → Copy/label pass

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT STATE
  TechTrend is an AI-driven B2C e-commerce platform.
  Employees of a fictional store search for consumer
  electronics, add to cart, and checkout via Stripe.

TARGET STATE
  ProcureAI is an agentic B2B internal procurement platform.
  Employees of any company search an approved vendor catalog,
  create purchase requests (PRs), and route them to a manager
  for approval — all via natural language chat.
  Finance teams get real-time budget visibility and a full
  immutable audit trail.

PIVOT RATIO
  Infrastructure unchanged:  100% (zero rewrites)
  Schema:                     95% reused (5 new models)
  Agent tools:                70% renamed, 30% new logic
  GenUI components:           80% reused, 20% new
  Copy / labels:              100% updated
  Estimated engineering time: 2 weekends

STRATEGIC WHY
  - B2B internal tools are a stronger enterprise AI signal
    than consumer shopping bots.
  - Aligns with YC RFS "SaaS Challengers" and
    "AI-Native Service Companies".
  - A CFO at a 50-person startup will pay for this today.
    The demo writes itself.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — TERMINOLOGY MAPPING (CANONICAL REFERENCE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every file you touch must use the RIGHT column.
Search-and-replace this table in UI copy, comments,
variable names, and test descriptions.

  B2C (old)            B2B (new)               Scope
  ──────────────────────────────────────────────────────
  Customer             Employee / Requestor     DB + UI
  Admin                Manager / Approver       DB + UI
  Store / Storefront   Approved Vendor Catalog  UI only
  Product              Catalog Item / Equipment DB + UI
  Cart                 Purchase Request (PR)    DB + UI
  Cart Item            PR Line Item             DB + UI
  Checkout             Submit for Approval      UI only
  Order                Purchase Order (PO)      DB + UI
  Order History        PR History               UI only
  Return               Dispute / Cancel         DB + UI
  Refund               Credit Note              UI only
  search_products      search_catalog           Tool name
  add_to_cart          add_to_pr                Tool name
  view_cart            view_pr                  Tool name
  get_orders           get_purchase_requests    Tool name
  initiate_return      raise_dispute            Tool name
  ProductGrid          CatalogGrid              Component
  CartCanvas           PurchaseRequestDraft     Component
  OrderList            PRList                   Component
  ReturnCard           DisputeCard              Component
  [new]                ApprovalCard             Component
  [new]                BudgetGauge              Component
  [new]                BudgetAlert              Component

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3 — PRISMA SCHEMA CHANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: prisma/schema.prisma

INSTRUCTION TO CODING AGENT:
  - Do NOT rename or drop existing models.
  - ADD new fields to User with @default so existing
    rows are not broken.
  - ADD new models at the bottom of the file.
  - Run: npx prisma migrate dev --name "b2b_procurement_v1"

── 3A. MODIFY EXISTING: User model ─────────────────────

  // ADD these fields to the existing User model:
  role         EmployeeRole @default(EMPLOYEE)
  department   String?
  departmentId String?
  dept         Department?  @relation(fields: [departmentId], references: [id])
  purchaseRequests PurchaseRequest[]

  // ADD this enum (new):
  enum EmployeeRole {
    EMPLOYEE   // can create PRs
    MANAGER    // can approve/reject PRs
    FINANCE    // read-only; sees all PRs + budget
    ADMIN      // full access (replaces old ADMIN)
  }

── 3B. MODIFY EXISTING: Order model ────────────────────

  // The existing Order model becomes the PO record
  // after approval. ADD these fields:
  prId         String?   @unique  // linked PR
  pr           PurchaseRequest? @relation(fields: [prId], references: [id])
  approvedById String?
  approvedBy   User?     @relation("OrderApprovals", fields: [approvedById], references: [id])

── 3C. ADD NEW: Department ──────────────────────────────

  model Department {
    id             String   @id @default(cuid())
    name           String   @unique   // "Engineering"
    code           String   @unique   // "ENG"
    monthlyBudget  Int      @default(0)  // paise / cents
    spentThisMonth Int      @default(0)
    approverEmail  String

    employees      User[]
    purchaseRequests PurchaseRequest[]

    createdAt      DateTime @default(now())
    updatedAt      DateTime @updatedAt
  }

── 3D. ADD NEW: PurchaseRequest ─────────────────────────

  model PurchaseRequest {
    id            String   @id @default(cuid())
    prNumber      String   @unique  // "PR-2026-0001"
    status        PRStatus @default(DRAFT)
    totalAmount   Int      @default(0)  // paise / cents
    justification String
    urgency       PRUrgency @default(NORMAL)
    notes         String?  // approver notes

    requestorId   String
    requestor     User       @relation(fields: [requestorId], references: [id])
    departmentId  String
    department    Department @relation(fields: [departmentId], references: [id])

    lineItems     PRLineItem[]
    approvals     PRApproval[]
    auditEntries  PRAuditEntry[]
    order         Order?       // set after PO raised

    submittedAt   DateTime?
    approvedAt    DateTime?
    rejectedAt    DateTime?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
  }

  enum PRStatus {
    DRAFT
    PENDING_APPROVAL
    APPROVED
    REJECTED
    ORDERED       // PO raised, vendor notified
    RECEIVED      // goods/services confirmed
    DISPUTED
    CANCELLED
  }

  enum PRUrgency {
    LOW
    NORMAL
    HIGH
    CRITICAL     // bypasses standard 48h SLA
  }

── 3E. ADD NEW: PRLineItem ──────────────────────────────

  model PRLineItem {
    id             String  @id @default(cuid())
    quantity       Int
    unitPrice      Int     // paise / cents at time of request
    totalPrice     Int

    prId           String
    pr             PurchaseRequest @relation(fields: [prId], references: [id], onDelete: Cascade)
    catalogItemId  String
    catalogItem    CatalogItem @relation(fields: [catalogItemId], references: [id])

    @@unique([prId, catalogItemId])
  }

── 3F. ADD NEW: CatalogItem ─────────────────────────────

  // Replaces Product for B2B context.
  // Keep existing Product model — just stop exposing it.

  model CatalogItem {
    id            String   @id @default(cuid())
    name          String
    description   String
    sku           String   @unique
    unitPrice     Int      // paise / cents
    category      CatalogCategory
    vendor        String
    vendorCode    String
    leadDays      Int      @default(3)
    inStock       Boolean  @default(true)
    minOrderQty   Int      @default(1)
    imageUrl      String?
    embedding     Unsupported("vector(1536)")?

    lineItems     PRLineItem[]

    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    @@index([category])
  }

  enum CatalogCategory {
    HARDWARE
    SOFTWARE
    SERVICES
    OFFICE_SUPPLIES
    INFRASTRUCTURE
    OTHER
  }

── 3G. ADD NEW: PRApproval ──────────────────────────────

  // One approval record per PR (expandable to chain).
  model PRApproval {
    id             String         @id @default(cuid())
    status         ApprovalStatus @default(PENDING)
    approverEmail  String
    approverName   String?
    comments       String?
    decidedAt      DateTime?

    prId           String
    pr             PurchaseRequest @relation(fields: [prId], references: [id])

    createdAt      DateTime @default(now())
  }

  enum ApprovalStatus {
    PENDING
    APPROVED
    REJECTED
    DELEGATED
  }

── 3H. ADD NEW: PRAuditEntry ────────────────────────────

  // Immutable append-only audit trail.
  // Never update or delete rows from this table.
  model PRAuditEntry {
    id        String   @id @default(cuid())
    action    String   // "PR_CREATED" | "SUBMITTED" | "APPROVED" | ...
    actor     String   // email or "SYSTEM"
    details   Json     @default("{}")
    prId      String
    pr        PurchaseRequest @relation(fields: [prId], references: [id])
    createdAt DateTime @default(now())
  }

── 3I. RUN MIGRATION ────────────────────────────────────

  npx prisma migrate dev --name "b2b_procurement_v1"
  npx prisma generate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4 — SEED DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: prisma/seed-b2b.ts
Run: npx tsx prisma/seed-b2b.ts

  import { PrismaClient, EmployeeRole,
           CatalogCategory } from '@prisma/client'
  import bcrypt from 'bcryptjs'
  const db = new PrismaClient()

  async function main() {

    // Departments
    const eng = await db.department.upsert({
      where: { code: 'ENG' },
      create: {
        name: 'Engineering', code: 'ENG',
        monthlyBudget: 50000_00,
        approverEmail: 'manager@acme.com',
      },
      update: {},
    })
    const mktg = await db.department.upsert({
      where: { code: 'MKTG' },
      create: {
        name: 'Marketing', code: 'MKTG',
        monthlyBudget: 25000_00,
        approverEmail: 'manager@acme.com',
      },
      update: {},
    })

    // Users
    const hash = await bcrypt.hash('password123', 10)

    await db.user.upsert({
      where: { email: 'employee@acme.com' },
      create: {
        email:        'employee@acme.com',
        name:         'Priya Sharma',
        passwordHash: hash,
        role:         EmployeeRole.EMPLOYEE,
        departmentId: eng.id,
      },
      update: {},
    })
    await db.user.upsert({
      where: { email: 'manager@acme.com' },
      create: {
        email:        'manager@acme.com',
        name:         'Rahul Mehta',
        passwordHash: hash,
        role:         EmployeeRole.MANAGER,
        departmentId: eng.id,
      },
      update: {},
    })
    await db.user.upsert({
      where: { email: 'finance@acme.com' },
      create: {
        email:        'finance@acme.com',
        name:         'Anita Gupta',
        passwordHash: hash,
        role:         EmployeeRole.FINANCE,
        departmentId: eng.id,
      },
      update: {},
    })

    // Catalog items
    const items = [
      {
        name:        'MacBook Pro M4 14"',
        description: 'Apple M4 Pro chip, 24GB RAM, 512GB SSD',
        sku:         'HW-APPLE-MBP14-M4',
        unitPrice:   199900_00,
        category:    CatalogCategory.HARDWARE,
        vendor:      'Apple India Pvt Ltd',
        vendorCode:  'Z14A-MBP-M4-24-512',
        leadDays:    7,
      },
      {
        name:        'Dell UltraSharp 27" 4K Monitor',
        description: 'U2723D, USB-C 90W, IPS Black',
        sku:         'HW-DELL-U2723D',
        unitPrice:   52000_00,
        category:    CatalogCategory.HARDWARE,
        vendor:      'Dell India Pvt Ltd',
        vendorCode:  'U2723D',
        leadDays:    5,
      },
      {
        name:        'GitHub Enterprise (per seat/year)',
        description: 'GitHub Enterprise Cloud, 1 user licence',
        sku:         'SW-GH-ENT-SEAT',
        unitPrice:   18000_00,
        category:    CatalogCategory.SOFTWARE,
        vendor:      'GitHub Inc.',
        vendorCode:  'GHE-CLOUD-SEAT',
        leadDays:    1,
      },
      {
        name:        'Figma Professional (per seat/year)',
        description: 'Figma Professional plan, 1 user',
        sku:         'SW-FIGMA-PRO-SEAT',
        unitPrice:   4500_00,
        category:    CatalogCategory.SOFTWARE,
        vendor:      'Figma Inc.',
        vendorCode:  'FIG-PRO-ANNUAL',
        leadDays:    1,
      },
      {
        name:        'AWS Business Support (per month)',
        description: 'AWS Business Support Plan, monthly',
        sku:         'SVC-AWS-BIZ-MO',
        unitPrice:   15000_00,
        category:    CatalogCategory.INFRASTRUCTURE,
        vendor:      'Amazon Web Services',
        vendorCode:  'SUPP-BIZ-MO',
        leadDays:    1,
      },
      {
        name:        'Herman Miller Aeron Chair',
        description: 'Size B, Graphite, fully adjustable',
        sku:         'OFC-HM-AERON-B',
        unitPrice:   95000_00,
        category:    CatalogCategory.OFFICE_SUPPLIES,
        vendor:      'Herman Miller India',
        vendorCode:  'AERON-B-GRP',
        leadDays:    14,
      },
      {
        name:        'Notion Team (per seat/year)',
        description: 'Notion Team plan, 1 user',
        sku:         'SW-NOTION-TEAM-SEAT',
        unitPrice:   2000_00,
        category:    CatalogCategory.SOFTWARE,
        vendor:      'Notion Labs Inc.',
        vendorCode:  'NOTION-TEAM-ANNUAL',
        leadDays:    1,
      },
    ]

    for (const item of items) {
      await db.catalogItem.upsert({
        where: { sku: item.sku },
        create: item,
        update: item,
      })
    }

    console.log('✅ B2B seed complete')
  }

  main()
    .catch(console.error)
    .finally(() => db.$disconnect())

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 5 — PYTHON AGENT TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/agent-core/src/tools.py
REPLACE all existing tool functions with these 7.
Keep ALL imports, get_pool(), embed_query() unchanged.

── TOOL 1: search_catalog ───────────────────────────────

  @tool
  async def search_catalog(
    query: str,
    category: Optional[str] = None,
    max_unit_price: Optional[int] = None,
    config: RunnableConfig = None,
  ) -> str:
    """Search the approved vendor catalog by natural language.
    Returns catalog items with vendor, pricing, lead time.
    category options: HARDWARE, SOFTWARE, SERVICES,
    OFFICE_SUPPLIES, INFRASTRUCTURE, OTHER"""

    pool = await get_pool()
    emb  = await embed_query(query)
    emb_str = f"[{','.join(map(str, emb))}]"

    async with pool.acquire() as conn:
      rows = await conn.fetch("""
        SELECT id, name, description, sku,
               "unitPrice", category, vendor,
               "vendorCode", "leadDays",
               "inStock", "minOrderQty"
        FROM "CatalogItem"
        WHERE ($2::text IS NULL OR category = $2)
          AND ($3::int  IS NULL OR "unitPrice" <= $3)
          AND "inStock" = true
        ORDER BY embedding <=> $1::vector
        LIMIT 6
      """, emb_str, category, max_unit_price)

    items = [dict(r) for r in rows]

    return json.dumps({
      "items": items,
      "__ui__": {
        "name": "catalog-grid",
        "props": { "items": items, "loading": False }
      }
    })

── TOOL 2: get_budget_status ────────────────────────────

  @tool
  async def get_budget_status(
    config: RunnableConfig = None,
  ) -> str:
    """Get the employee's department budget status:
    monthly limit, spent so far, and remaining balance.
    Always call this before adding expensive items to a PR."""

    dept_id = config["configurable"]["department_id"]
    pool = await get_pool()

    async with pool.acquire() as conn:
      dept = await conn.fetchrow("""
        SELECT name, "monthlyBudget", "spentThisMonth"
        FROM "Department" WHERE id = $1
      """, dept_id)

    budget    = dept["monthlyBudget"]
    spent     = dept["spentThisMonth"]
    remaining = budget - spent
    pct       = round(spent / budget * 100, 1) if budget else 0

    return json.dumps({
      "department":    dept["name"],
      "monthlyBudget": budget,
      "spent":         spent,
      "remaining":     remaining,
      "percentUsed":   pct,
      "__ui__": {
        "name": "budget-gauge",
        "props": {
          "department":    dept["name"],
          "monthlyBudget": budget,
          "spent":         spent,
          "remaining":     remaining,
          "percentUsed":   pct,
        }
      }
    })

── TOOL 3: manage_purchase_request ──────────────────────

  @tool
  async def manage_purchase_request(
    action: str,             # "create" | "add_item" | "view" | "remove_item"
    justification: str = "",
    urgency: str = "NORMAL",
    pr_id: str = "",
    catalog_item_id: str = "",
    quantity: int = 1,
    config: RunnableConfig = None,
  ) -> str:
    """Manage purchase requests.
    action='create'     → start a new PR (needs justification)
    action='add_item'   → add catalog item to draft PR
                          (checks budget first, returns budget-alert if exceeded)
    action='view'       → get current draft PR with line items
    action='remove_item'→ remove a line item from draft PR
    """

    employee_id = config["configurable"]["user_id"]
    dept_id     = config["configurable"]["department_id"]
    pool = await get_pool()

    # ── CREATE ──────────────────────────────────────
    if action == "create":
      async with pool.acquire() as conn:
        count = await conn.fetchval(
          'SELECT COUNT(*) FROM "PurchaseRequest"'
        )
        pr_number = (
          f"PR-{datetime.now().year}-{int(count)+1:04d}"
        )
        pr = await conn.fetchrow("""
          INSERT INTO "PurchaseRequest"
            ("prNumber","requestorId","departmentId",
             justification, urgency, "totalAmount")
          VALUES ($1,$2,$3,$4,$5,0)
          RETURNING id, "prNumber", status
        """, pr_number, employee_id, dept_id,
            justification, urgency)

        await conn.execute("""
          INSERT INTO "PRAuditEntry"
            ("prId", action, actor, details)
          VALUES ($1,'PR_CREATED',$2,$3)
        """, pr["id"], employee_id,
            json.dumps({"justification": justification}))

      return json.dumps({
        "prId":     pr["id"],
        "prNumber": pr["prNumber"],
        "status":   pr["status"],
      })

    # ── ADD ITEM ────────────────────────────────────
    if action == "add_item":
      async with pool.acquire() as conn:
        item = await conn.fetchrow(
          'SELECT * FROM "CatalogItem" WHERE id=$1',
          catalog_item_id
        )
        if not item:
          return json.dumps({"error": "Catalog item not found"})

        line_total = item["unitPrice"] * quantity

        # Budget guardrail
        dept = await conn.fetchrow("""
          SELECT "monthlyBudget","spentThisMonth"
          FROM "Department" WHERE id=$1
        """, dept_id)
        remaining = (
          dept["monthlyBudget"] - dept["spentThisMonth"]
        )

        if line_total > remaining:
          return json.dumps({
            "error": "budget_exceeded",
            "__ui__": {
              "name": "budget-alert",
              "props": {
                "itemName":  item["name"],
                "requested": line_total,
                "remaining": remaining,
              }
            }
          })

        # Upsert line item
        await conn.execute("""
          INSERT INTO "PRLineItem"
            ("prId","catalogItemId",quantity,
             "unitPrice","totalPrice")
          VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT ("prId","catalogItemId") DO UPDATE
            SET quantity = EXCLUDED.quantity,
                "totalPrice" = EXCLUDED."totalPrice"
        """, pr_id, catalog_item_id, quantity,
            item["unitPrice"], line_total)

        await conn.execute("""
          UPDATE "PurchaseRequest"
          SET "totalAmount" = (
            SELECT COALESCE(SUM("totalPrice"),0)
            FROM "PRLineItem" WHERE "prId"=$1
          )
          WHERE id=$1
        """, pr_id)

        await conn.execute("""
          INSERT INTO "PRAuditEntry"
            ("prId",action,actor,details)
          VALUES ($1,'ITEM_ADDED',$2,$3)
        """, pr_id, employee_id,
            json.dumps({
              "item":  item["name"],
              "qty":   quantity,
              "price": line_total,
            }))

      return json.dumps({
        "success":   True,
        "itemName":  item["name"],
        "quantity":  quantity,
        "lineTotal": line_total,
      })

    # ── VIEW ────────────────────────────────────────
    if action == "view":
      async with pool.acquire() as conn:
        pr = await conn.fetchrow("""
          SELECT * FROM "PurchaseRequest"
          WHERE "requestorId"=$1 AND status='DRAFT'
          ORDER BY "createdAt" DESC LIMIT 1
        """, employee_id)

        if not pr:
          return json.dumps({"pr": None,
            "message": "No draft PR found. Create one first."})

        items = await conn.fetch("""
          SELECT li.*, ci.name, ci.vendor, ci.imageUrl
          FROM "PRLineItem" li
          JOIN "CatalogItem" ci ON ci.id=li."catalogItemId"
          WHERE li."prId"=$1
        """, pr["id"])

      line_items = [dict(i) for i in items]

      return json.dumps({
        "pr":         dict(pr),
        "lineItems":  line_items,
        "__ui__": {
          "name": "pr-draft",
          "props": {
            "prNumber":  pr["prNumber"],
            "lineItems": line_items,
            "total":     pr["totalAmount"],
            "status":    pr["status"],
          }
        }
      })

    return json.dumps({"error": f"Unknown action: {action}"})

── TOOL 4: submit_for_approval ──────────────────────────

  @tool
  async def submit_for_approval(
    pr_id: str,
    config: RunnableConfig = None,
  ) -> str:
    """Submit a draft purchase request to the department
    manager for approval. This triggers the HITL workflow.
    The agent will pause and wait for the manager's decision.
    Notifies approver by email (if email service configured)."""

    employee_id = config["configurable"]["user_id"]
    dept_id     = config["configurable"]["department_id"]
    pool = await get_pool()

    async with pool.acquire() as conn:
      pr = await conn.fetchrow(
        'SELECT * FROM "PurchaseRequest" WHERE id=$1', pr_id
      )
      if not pr or pr["status"] != "DRAFT":
        return json.dumps({
          "error": f"PR {pr_id} is not in DRAFT status"
        })

      dept = await conn.fetchrow(
        'SELECT * FROM "Department" WHERE id=$1', dept_id
      )

      async with conn.transaction():
        await conn.execute("""
          INSERT INTO "PRApproval"
            ("prId","approverEmail",status)
          VALUES ($1,$2,'PENDING')
        """, pr_id, dept["approverEmail"])

        await conn.execute("""
          UPDATE "PurchaseRequest"
          SET status='PENDING_APPROVAL',
              "submittedAt"=NOW()
          WHERE id=$1
        """, pr_id)

        await conn.execute("""
          INSERT INTO "PRAuditEntry"
            ("prId",action,actor,details)
          VALUES ($1,'SUBMITTED',$2,$3)
        """, pr_id, employee_id,
            json.dumps({"approver": dept["approverEmail"]}))

    # TODO: Send email via SendGrid/SES
    # await send_approval_email(dept["approverEmail"], pr)

    return json.dumps({
      "success":       True,
      "prNumber":      pr["prNumber"],
      "approverEmail": dept["approverEmail"],
      "totalAmount":   pr["totalAmount"],
      "__ui__": {
        "name": "pr-submitted",
        "props": {
          "prNumber":      pr["prNumber"],
          "approverEmail": dept["approverEmail"],
          "totalAmount":   pr["totalAmount"],
        }
      }
    })

── TOOL 5: get_purchase_requests ────────────────────────

  @tool
  async def get_purchase_requests(
    status_filter: Optional[str] = None,
    limit: int = 5,
    config: RunnableConfig = None,
  ) -> str:
    """Get the employee's purchase request history.
    status_filter: DRAFT | PENDING_APPROVAL | APPROVED |
                   REJECTED | ORDERED | RECEIVED | CANCELLED
    Managers can see ALL department PRs (role-aware)."""

    employee_id = config["configurable"]["user_id"]
    role        = config["configurable"].get("role", "EMPLOYEE")
    dept_id     = config["configurable"]["department_id"]
    pool = await get_pool()

    async with pool.acquire() as conn:
      # Managers see all department PRs
      if role in ("MANAGER", "FINANCE", "ADMIN"):
        rows = await conn.fetch("""
          SELECT pr.id, pr."prNumber", pr.status,
                 pr."totalAmount", pr.justification,
                 pr.urgency, pr."createdAt",
                 u.name AS "requestorName",
                 COUNT(li.id) AS "itemCount"
          FROM "PurchaseRequest" pr
          JOIN "User" u ON u.id = pr."requestorId"
          LEFT JOIN "PRLineItem" li ON li."prId" = pr.id
          WHERE pr."departmentId" = $1
            AND ($2::text IS NULL OR pr.status = $2)
          GROUP BY pr.id, u.name
          ORDER BY pr."createdAt" DESC
          LIMIT $3
        """, dept_id, status_filter, limit)
      else:
        rows = await conn.fetch("""
          SELECT pr.id, pr."prNumber", pr.status,
                 pr."totalAmount", pr.justification,
                 pr.urgency, pr."createdAt",
                 COUNT(li.id) AS "itemCount"
          FROM "PurchaseRequest" pr
          LEFT JOIN "PRLineItem" li ON li."prId" = pr.id
          WHERE pr."requestorId" = $1
            AND ($2::text IS NULL OR pr.status = $2)
          GROUP BY pr.id
          ORDER BY pr."createdAt" DESC
          LIMIT $3
        """, employee_id, status_filter, limit)

    prs = []
    for r in rows:
      d = dict(r)
      d["createdAt"] = d["createdAt"].isoformat()
      prs.append(d)

    return json.dumps({
      "purchaseRequests": prs,
      "__ui__": {
        "name": "pr-list",
        "props": { "purchaseRequests": prs, "loading": False }
      }
    })

── TOOL 6: process_approval ─────────────────────────────

  @tool
  async def process_approval(
    pr_id:    str,
    decision: str,    # "APPROVED" | "REJECTED"
    comments: str = "",
    config: RunnableConfig = None,
  ) -> str:
    """Approve or reject a purchase request.
    Only callable by MANAGER or ADMIN role.
    This is the HITL resume point — it resolves the
    interrupt() that was triggered by submit_for_approval."""

    approver_email = config["configurable"]["user_email"]
    role           = config["configurable"].get("role")
    pool = await get_pool()

    if role not in ("MANAGER", "ADMIN"):
      return json.dumps({
        "error": "Only MANAGER or ADMIN can approve PRs"
      })

    if decision not in ("APPROVED", "REJECTED"):
      return json.dumps({
        "error": "decision must be APPROVED or REJECTED"
      })

    new_status = decision   # maps directly to PRStatus

    async with pool.acquire() as conn:
      approval = await conn.fetchrow("""
        SELECT a.id FROM "PRApproval" a
        WHERE a."prId"=$1
          AND a."approverEmail"=$2
          AND a.status='PENDING'
      """, pr_id, approver_email)

      if not approval:
        return json.dumps({
          "error": "No pending approval found for this PR"
        })

      async with conn.transaction():
        await conn.execute("""
          UPDATE "PRApproval"
          SET status=$1, comments=$2, "decidedAt"=NOW()
          WHERE id=$3
        """, decision, comments, approval["id"])

        await conn.execute("""
          UPDATE "PurchaseRequest"
          SET status=$1,
              "approvedAt"=CASE WHEN $1='APPROVED'
                           THEN NOW() ELSE NULL END,
              "rejectedAt"=CASE WHEN $1='REJECTED'
                           THEN NOW() ELSE NULL END,
              notes=$2
          WHERE id=$3
        """, new_status, comments, pr_id)

        await conn.execute("""
          INSERT INTO "PRAuditEntry"
            ("prId",action,actor,details)
          VALUES ($1,$2,$3,$4)
        """, pr_id, f"PR_{decision}", approver_email,
            json.dumps({"comments": comments}))

    return json.dumps({
      "success":  True,
      "prId":     pr_id,
      "decision": decision,
      "comments": comments,
    })

── TOOL 7: raise_dispute ────────────────────────────────

  @tool
  async def raise_dispute(
    pr_id:  str,
    reason: str,
    config: RunnableConfig = None,
  ) -> str:
    """Raise a dispute or cancellation on an approved or
    ordered purchase request. Escalates to Finance."""

    employee_id = config["configurable"]["user_id"]
    pool = await get_pool()

    async with pool.acquire() as conn:
      await conn.execute("""
        UPDATE "PurchaseRequest"
        SET status='DISPUTED'
        WHERE id=$1
          AND "requestorId"=$2
      """, pr_id, employee_id)

      await conn.execute("""
        INSERT INTO "PRAuditEntry"
          ("prId",action,actor,details)
        VALUES ($1,'DISPUTED',$2,$3)
      """, pr_id, employee_id,
          json.dumps({"reason": reason}))

    return json.dumps({
      "success": True,
      "message": "Dispute raised. Finance team notified.",
      "__ui__": {
        "name": "dispute-card",
        "props": { "prId": pr_id, "reason": reason }
      }
    })

── EXPORT LIST ──────────────────────────────────────────

  ALL_TOOLS = [
    search_catalog,
    get_budget_status,
    manage_purchase_request,
    submit_for_approval,
    get_purchase_requests,
    process_approval,
    raise_dispute,
  ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 6 — LANGGRAPH GRAPH UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/agent-core/src/graph.py
MODIFY (do not rewrite) the existing StateGraph.

── 6A. SYSTEM PROMPT ────────────────────────────────────

  SYSTEM_PROMPT = """You are ProcureAI — an intelligent
  internal procurement assistant.

  YOUR USERS:
  - EMPLOYEE (Requestor): can search catalog, create PRs,
    view their own PR history, raise disputes.
  - MANAGER (Approver): can do everything EMPLOYEE can,
    PLUS see all department PRs and approve/reject.
  - FINANCE: read-only access to all PRs and budgets.

  STANDARD WORKFLOW:
  1. Employee describes what they need.
  2. You call search_catalog → show CatalogGrid GenUI.
  3. Employee selects items → you call manage_purchase_request
     action='create' (if no draft PR exists), then
     action='add_item' for each item.
     ALWAYS call get_budget_status before adding items
     over ₹10,000.
  4. Employee reviews → calls manage_purchase_request
     action='view' → show PurchaseRequestDraft GenUI.
  5. Employee submits → you call submit_for_approval.
     Tell the employee: "Submitted. Your manager
     (approver@company.com) has been notified."

  MANAGER WORKFLOW:
  - Manager asks: "Show pending approvals"
    → call get_purchase_requests status_filter='PENDING_APPROVAL'
    → show PRList GenUI with Approve/Reject buttons.
  - Manager approves → call process_approval decision='APPROVED'
  - Manager rejects → call process_approval decision='REJECTED'

  RULES:
  - Format all prices as ₹X,XXX (Indian locale).
  - NEVER approve a PR for the same person who submitted it.
  - If budget would be exceeded, surface the BudgetAlert
    GenUI and suggest alternatives.
  - CRITICAL urgency PRs: note they bypass 48h SLA.
  - Keep responses concise — users are busy professionals.
  - Always confirm destructive actions before executing.
  """

── 6B. HITL APPROVAL NODE ───────────────────────────────

  # ADD this node to the existing StateGraph.
  # It uses LangGraph interrupt() — pauses the graph,
  # sends payload to caller, resumes when manager
  # calls the graph with Command(resume=decision). [web:442]

  from langgraph.types import interrupt, Command
  from typing import Literal

  def approval_gate_node(state: AgentState) -> Command[
    Literal["agent", "end"]
  ]:
    """
    Pauses the graph after submit_for_approval fires.
    Resumes when manager calls:
      graph.invoke(Command(resume="APPROVED"), config)
    or
      graph.invoke(Command(resume="REJECTED"), config)
    """
    decision = interrupt({
      "type":      "pr_approval_required",
      "prId":      state.get("pending_pr_id"),
      "prNumber":  state.get("pending_pr_number"),
      "total":     state.get("pending_pr_total"),
      "requestor": state.get("pending_pr_requestor"),
      "items":     state.get("pending_pr_items"),
      "message":   "Purchase request awaiting your approval.",
    })

    # Route based on manager's decision
    if decision == "APPROVED":
      return Command(goto="agent")   # continue to notify
    else:
      return Command(goto="end")

  # ADD to AgentState TypedDict:
  #   pending_pr_id:        Optional[str]
  #   pending_pr_number:    Optional[str]
  #   pending_pr_total:     Optional[int]
  #   pending_pr_requestor: Optional[str]
  #   pending_pr_items:     Optional[list]
  #   awaiting_approval:    bool = False

  # ADD conditional edge:
  # After tool_node, if any tool result contains
  # "__pr_submitted": True → route to approval_gate_node
  # Otherwise → route back to agent node.

  def route_after_tools(state: AgentState) -> str:
    last_tool_result = state.get("last_tool_result", {})
    if last_tool_result.get("__pr_submitted"):
      return "approval_gate"
    return "agent"

  builder.add_node("approval_gate", approval_gate_node)
  builder.add_conditional_edges("tools", route_after_tools)

── 6C. CONFIGURABLE CONTEXT ─────────────────────────────

  # Extend the configurable dict passed to graph.invoke():
  config = {
    "configurable": {
      "thread_id":     thread_id,
      "user_id":       user.id,
      "user_email":    user.email,
      "role":          user.role,          # NEW
      "department_id": user.departmentId,  # NEW
    }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 7 — NEXT.JS WEB APP UPDATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── 7A. AUTH: PASS ROLE + DEPARTMENT TO SESSION ──────────

  FILE: apps/web/lib/auth.ts  (or wherever session is built)

  // Extend the session/JWT to include role + departmentId
  // so every Server Action and API route can read them
  // without a DB call.

  // If using next-auth:
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role         = user.role
        token.departmentId = user.departmentId
        token.email        = user.email
      }
      return token
    },
    async session({ session, token }) {
      session.user.role         = token.role
      session.user.departmentId = token.departmentId
      return session
    }
  }

── 7B. RBAC MIDDLEWARE ──────────────────────────────────

  FILE: apps/web/middleware.ts  (ADD, do not replace)

  // Protect /manager/* routes — MANAGER + ADMIN only
  // Protect /finance/* routes — FINANCE + ADMIN only
  // /chat remains open to all authenticated users

  import { getToken } from 'next-auth/jwt'
  import { NextResponse } from 'next/server'
  import type { NextRequest } from 'next/server'

  export async function middleware(req: NextRequest) {
    const token = await getToken({ req })

    if (!token) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }

    const role = token.role as string
    const path = req.nextUrl.pathname

    if (path.startsWith('/manager') &&
        !['MANAGER','ADMIN'].includes(role)) {
      return NextResponse.redirect(new URL('/chat', req.url))
    }

    if (path.startsWith('/finance') &&
        !['FINANCE','ADMIN'].includes(role)) {
      return NextResponse.redirect(new URL('/chat', req.url))
    }

    return NextResponse.next()
  }

  export const config = {
    matcher: ['/manager/:path*', '/finance/:path*']
  }

── 7C. STREAM ENDPOINT — PASS ROLE TO AGENT ─────────────

  FILE: apps/web/app/api/chat/stream/route.ts
  MODIFY the existing POST handler:

  // Extract role + departmentId from session and forward
  // to the Python agent as configurable context.

  const session = await getServerSession(authOptions)

  const agentPayload = {
    messages:      body.messages,
    user_id:       session.user.id,
    user_email:    session.user.email,
    thread_id:     body.thread_id,
    role:          session.user.role,         // NEW
    department_id: session.user.departmentId, // NEW
  }

── 7D. GENUI — UIEventMap ADDITIONS ─────────────────────

  FILE: apps/web/lib/ui-event-types.ts (or equivalent)

  export type UIEventMap = {
    // Existing (renamed):
    'catalog-grid':    CatalogGridProps
    'pr-draft':        PRDraftProps
    'pr-list':         PRListProps
    'dispute-card':    DisputeCardProps
    // New:
    'budget-gauge':    BudgetGaugeProps
    'budget-alert':    BudgetAlertProps
    'pr-submitted':    PRSubmittedProps
    'approval-card':   ApprovalCardProps
  }

  export type CatalogGridProps = {
    items:   CatalogItem[]
    loading: boolean
  }
  export type PRDraftProps = {
    prNumber:  string
    lineItems: PRLineItem[]
    total:     number
    status:    string
  }
  export type PRListProps = {
    purchaseRequests: PR[]
    loading:          boolean
  }
  export type BudgetGaugeProps = {
    department:    string
    monthlyBudget: number
    spent:         number
    remaining:     number
    percentUsed:   number
  }
  export type BudgetAlertProps = {
    itemName:  string
    requested: number
    remaining: number
  }
  export type PRSubmittedProps = {
    prNumber:      string
    approverEmail: string
    totalAmount:   number
  }
  export type ApprovalCardProps = {
    prId:          string
    prNumber:      string
    requestorName: string
    totalAmount:   number
    lineItems:     PRLineItem[]
    justification: string
    urgency:       string
  }
  export type DisputeCardProps = {
    prId:   string
    reason: string
  }

── 7E. GENUI COMPONENT: CatalogGrid ─────────────────────

  // COPY ProductGrid.tsx → CatalogGrid.tsx
  // CHANGE:
  //   "Product"    → "Item"
  //   "Add to Cart"→ "Add to Request"
  //   Add: <Text>Vendor: {item.vendor}</Text>
  //   Add: <Text>Lead time: {item.leadDays}d</Text>
  //   Remove: star rating (add lead time badge instead)

── 7F. GENUI COMPONENT: PurchaseRequestDraft ────────────

  // COPY CartCanvas.tsx → PurchaseRequestDraft.tsx
  // CHANGE:
  //   Title: "Purchase Request Draft"
  //   Show: PR number badge (e.g. "PR-2026-0042")
  //   Show: Justification text field (editable)
  //   Button: "Proceed to Checkout" →
  //           "Submit for Manager Approval"
  //   Button color: primary (same teal)
  //   Add below button:
  //     <Text style={s.hint}>
  //       Your manager will be notified immediately.
  //       Typical approval time: 24–48 hours.
  //     </Text>

── 7G. GENUI COMPONENT: ApprovalCard (NEW) ──────────────

  // FILE: apps/web/components/genui/ApprovalCard.tsx
  // This is the manager-facing approval component.
  // Rendered when manager asks "show pending approvals"
  // and agent returns 'approval-card' UI event.

  export function ApprovalCard({
    prId, prNumber, requestorName,
    totalAmount, lineItems, justification, urgency
  }: ApprovalCardProps) {

    const [decision, setDecision] = useState<
      'APPROVED' | 'REJECTED' | null
    >(null)
    const [comments, setComments] = useState('')
    const [loading,  setLoading]  = useState(false)

    // urgency badge color
    const urgencyColor = {
      LOW:      colors.textMuted,
      NORMAL:   colors.text,
      HIGH:     colors.warning,
      CRITICAL: colors.error,
    }[urgency] ?? colors.text

    const handleDecide = async (d: 'APPROVED'|'REJECTED') => {
      setLoading(true)
      // Submit via chat: agent receives as a message
      // so the HITL interrupt is resumed.
      // The host ChatInput handler intercepts this.
      onSubmitMessage(
        `${d} — ${comments || 'No comments.'}`
      )
      setDecision(d)
      setLoading(false)
    }

    if (decision) {
      return (
        <View style={s.decided}>
          <Text style={s.decidedIcon}>
            {decision === 'APPROVED' ? '✅' : '❌'}
          </Text>
          <Text style={s.decidedText}>
            {prNumber} {decision.toLowerCase()}
          </Text>
        </View>
      )
    }

    return (
      <View style={s.card}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.prNumber}>{prNumber}</Text>
            <Text style={s.requestor}>
              from {requestorName}
            </Text>
          </View>
          <View style={[s.urgencyBadge,
            { borderColor: urgencyColor }]}>
            <Text style={[s.urgencyText,
              { color: urgencyColor }]}>
              {urgency}
            </Text>
          </View>
        </View>

        {/* Justification */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Justification</Text>
          <Text style={s.justification}>
            {justification}
          </Text>
        </View>

        {/* Line items */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>
            Items ({lineItems.length})
          </Text>
          {lineItems.map((item, i) => (
            <View key={i} style={s.lineItem}>
              <Text style={s.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={s.itemPrice}>
                ₹{(item.totalPrice).toLocaleString('en-IN')}
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalAmount}>
            ₹{totalAmount.toLocaleString('en-IN')}
          </Text>
        </View>

        {/* Comments */}
        <TextInput
          style={s.commentsInput}
          placeholder="Add a comment (optional)"
          value={comments}
          onChangeText={setComments}
          multiline
          accessibilityLabel="Approval comments"
        />

        {/* Decision buttons */}
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.btn, s.rejectBtn]}
            onPress={() => handleDecide('REJECTED')}
            disabled={loading}
            testID="reject-pr-btn"
          >
            <Text style={s.rejectBtnText}>✕ Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, s.approveBtn]}
            onPress={() => handleDecide('APPROVED')}
            disabled={loading}
            testID="approve-pr-btn"
          >
            <Text style={s.approveBtnText}>✓ Approve</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

── 7H. GENUI COMPONENT: BudgetGauge (NEW) ───────────────

  // Animated horizontal progress bar.
  // Colors: green < 70%, amber 70-90%, red > 90%
  // Uses Reanimated withTiming for smooth fill.
  // See Part 2 of the B2B architecture document
  // for the full implementation.
  // Key prop: percentUsed drives the bar width.

── 7I. GENUI COMPONENT: BudgetAlert (NEW) ───────────────

  // Warning card shown when add_item budget check fails.
  // Shows: item name, requested amount, remaining budget.
  // CTA: "Request budget increase" → submits chat message.
  // Background: colors.warningBg, border: colors.warning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 8 — SUGGESTED CHIPS UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Replace in SuggestedActions.tsx + web equivalent

  // EMPLOYEE chips:
  const EMPLOYEE_CHIPS = [
    '💻 I need a developer laptop',
    '📊 Check my department budget',
    '📋 My purchase requests',
    '🔑 Software licences',
    '🖥️ Office equipment',
    '❓ What can I order?',
  ]

  // MANAGER chips (show when role === 'MANAGER'):
  const MANAGER_CHIPS = [
    '✅ Pending approvals',
    '📊 Department budget',
    '📋 All team requests',
    '💰 Monthly spend report',
  ]

  // Show correct set based on role from auth store:
  const role  = useAuthStore(s => s.user?.role)
  const CHIPS = role === 'MANAGER' || role === 'ADMIN'
    ? MANAGER_CHIPS
    : EMPLOYEE_CHIPS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 9 — LANGFUSE OBSERVABILITY UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // In graph.py, pass these as Langfuse metadata
  // so cost-per-department is visible in traces.
  // This is the "Backend Flex" moment in the demo.

  langfuse_handler = CallbackHandler(
    user_id    = config["configurable"]["user_id"],
    session_id = config["configurable"]["thread_id"],
    metadata   = {
      "department_id": config["configurable"]["department_id"],
      "role":          config["configurable"]["role"],
      "app":           "procureai",
      "version":       "1.0.0",
    }
  )

  # Result: Langfuse shows LLM cost broken down
  # by department_id — exactly what a CFO wants to see.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 10 — TEST UPDATES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

── 10A. PYTHON UNIT TESTS ───────────────────────────────

  FILE: apps/agent-core/tests/test_tools.py
  ADD these test classes (keep all existing tests):

  class TestSearchCatalog:
    async def test_returns_catalog_items_json(self): ...
    async def test_ui_event_structure(self): ...
    async def test_category_filter(self): ...
    async def test_price_filter(self): ...

  class TestManagePurchaseRequest:
    async def test_create_generates_pr_number(self): ...
    async def test_add_item_checks_budget(self): ...
    async def test_add_item_blocked_when_over_budget(self): ...
    async def test_view_returns_draft_pr(self): ...

  class TestSubmitForApproval:
    async def test_changes_status_to_pending(self): ...
    async def test_creates_approval_record(self): ...
    async def test_creates_audit_entry(self): ...
    async def test_rejects_non_draft_pr(self): ...

  class TestProcessApproval:
    async def test_manager_can_approve(self): ...
    async def test_manager_can_reject(self): ...
    async def test_employee_cannot_approve(self): ...
    async def test_approves_correct_pr(self): ...

  class TestGetBudgetStatus:
    async def test_returns_gauge_ui_event(self): ...
    async def test_calculates_remaining_correctly(self): ...

  # Target: 20 tests, 100% passing before merge

── 10B. PLAYWRIGHT E2E: APPROVAL FLOW ───────────────────

  FILE: apps/web/tests/e2e/approval-flow.spec.ts
  REPLACE checkout-flow.spec.ts with this.

  test.describe('B2B Approval Flow', () => {

    test('Employee creates PR and submits for approval', async
      ({ page }) => {

      // 1. Sign in as employee
      await page.goto('/sign-in')
      await page.fill('[data-testid=email]', 'employee@acme.com')
      await page.fill('[data-testid=password]', 'password123')
      await page.click('[data-testid=signin-btn]')
      await page.waitForURL('/chat')

      // 2. Search catalog
      await page.fill('[data-testid=chat-input]',
        'I need a laptop for a new hire')
      await page.click('[data-testid=send-btn]')
      await page.waitForSelector('[data-testid=catalog-grid]',
        { timeout: 15000 })

      // 3. Add item to PR
      await page.click('[data-testid^=add-to-request-]')
      await page.waitForSelector('[data-testid=pr-draft]',
        { timeout: 10000 })

      // 4. Submit for approval
      await page.click('[data-testid=submit-for-approval-btn]')
      await page.waitForSelector('[data-testid=pr-submitted]',
        { timeout: 10000 })
      await expect(
        page.getByText('manager@acme.com')
      ).toBeVisible()
    })

    test('Manager approves pending PR', async ({ page }) => {

      // 1. Sign in as manager
      await page.goto('/sign-in')
      await page.fill('[data-testid=email]', 'manager@acme.com')
      await page.fill('[data-testid=password]', 'password123')
      await page.click('[data-testid=signin-btn]')
      await page.waitForURL('/chat')

      // 2. Ask for pending approvals
      await page.fill('[data-testid=chat-input]',
        'Show me pending approvals')
      await page.click('[data-testid=send-btn]')
      await page.waitForSelector('[data-testid=approval-card]',
        { timeout: 15000 })

      // 3. Approve
      await page.click('[data-testid=approve-pr-btn]')
      await page.waitForSelector(
        '[data-testid=approval-card]:has-text("approved")',
        { timeout: 10000 }
      )
    })

    test('Budget alert fires when limit exceeded', async
      ({ page }) => {

      // Sign in, add expensive item, assert budget-alert shown
      ...
      await page.waitForSelector('[data-testid=budget-alert]',
        { timeout: 10000 })
      await expect(
        page.getByText('budget exceeded')
      ).toBeVisible()
    })
  })

── 10C. MAESTRO E2E: APPROVAL FLOW ──────────────────────

  FILE: apps/mobile/.maestro/09-approval-flow.yaml

  appId: com.techtrend.app
  name: "09 — B2B Approval Flow"
  tags: [smoke, approval, b2b]
  ---
  - launchApp:
      clearState: true

  # Employee creates PR
  - runFlow: _setup/login-employee.yaml
  - tapOn:
      id: "chip-💻-i-need-a-developer-laptop"
  - assertNotVisible:
      id: "agent-thinking"
      timeout: 25000
  - assertVisible:
      id: "catalog-grid"
      timeout: 5000
  - tapOn:
      id: "add-to-request-1"
  - assertNotVisible:
      id: "agent-thinking"
      timeout: 15000
  - tapOn:
      id: "submit-for-approval-btn"
  - assertVisible:
      id: "pr-submitted"
      timeout: 10000

  # Manager approves
  - runFlow: _setup/login-manager.yaml
  - tapOn:
      id: "chip-✅-pending-approvals"
  - assertVisible:
      id: "approval-card"
      timeout: 15000
  - tapOn:
      id: "approve-pr-btn"
  - assertVisible: "approved"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 11 — COPY / LABEL PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run these find-and-replace operations across
apps/web/src and apps/mobile/src LAST (after all
functional changes are tested and green).

  find/replace pairs (case-insensitive in UI strings only,
  not in variable names already renamed above):

  "Add to Cart"        → "Add to Request"
  "Your Cart"          → "Purchase Request"
  "Checkout"           → "Submit for Approval"
  "Order History"      → "PR History"
  "Order #"            → "PR #"
  "order"              → "purchase request"   (UI copy)
  "customer"           → "employee"            (UI copy)
  "store"              → "catalog"             (UI copy)
  "product"            → "item"                (UI copy)
  "Hi {name}!"         → "Hi {name}!"          (unchanged)
  app name             → "ProcureAI"

  Tab labels:
  "Shop"    → "Catalog"
  "Orders"  → "My Requests"
  "Profile" → "Profile"     (unchanged)

  Sign-in screen tagline:
  "AI-powered electronics store"
  → "Agentic procurement for modern teams"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 12 — COMMIT SEQUENCE (DO THIS IN ORDER)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  git commit -m "feat(schema): add B2B procurement models"
  git commit -m "feat(seed): add departments, employees, catalog"
  git commit -m "feat(agent): replace tools with 7 procurement tools"
  git commit -m "feat(graph): add approval_gate HITL node"
  git commit -m "feat(web): pass role+deptId in session+stream"
  git commit -m "feat(web): add RBAC middleware for /manager"
  git commit -m "feat(genui): add ApprovalCard, BudgetGauge, BudgetAlert"
  git commit -m "feat(genui): rename ProductGrid→CatalogGrid, Cart→PRDraft"
  git commit -m "feat(mobile): B2B genui components + role-aware chips"
  git commit -m "test(e2e): add approval-flow Playwright + Maestro tests"
  git commit -m "chore(copy): B2B terminology pass (customer→employee etc)"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 13 — 3-MINUTE DEMO SCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  0:00–0:30  THE HOOK
  ───────────────────
  Show: A Slack message thread with 11 replies trying
  to get a laptop approved.
  Say: "B2B procurement is broken. Employees wait weeks
  because of email chains. ProcureAI fixes this with
  agentic AI built on LangGraph, Next.js 15, and pgvector."

  0:30–1:30  EMPLOYEE FLOW
  ────────────────────────
  Log in as: employee@acme.com
  Type: "We need a standard developer setup for 3 new
  hires starting Monday."
  Show: CatalogGrid renders — MacBook, monitor, GitHub seats.
  Click: "+ Add to Request" on each.
  Show: BudgetGauge — Engineering has ₹24,000 remaining.
  Click: "Submit for Manager Approval"
  Show: PRSubmitted card — "Rahul Mehta has been notified."

  1:30–2:30  MANAGER FLOW
  ────────────────────────
  Switch tab or log in as: manager@acme.com
  Type: "What needs my approval today?"
  Show: ApprovalCard — PR-2026-0042, ₹6,45,900, 3 items.
  Point out: justification, urgency badge, line items.
  Click: "✓ Approve"
  Show: Card flips to "✅ PR-2026-0042 approved"

  2:30–3:00  THE BACKEND FLEX
  ────────────────────────────
  Open Langfuse dashboard.
  Show: Trace for the approval flow.
  Point out:
    - department_id metadata on every span
    - Tool calls: search_catalog → manage_purchase_request
      → submit_for_approval → approval_gate [INTERRUPT]
      → process_approval [RESUME]
    - Total latency: <4s per turn
  Say: "Full audit trail. Finance sees every decision,
  timestamped and attributed. SOC 2 ready."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT DOES NOT CHANGE — COMPLETE LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Infrastructure:
  ✅ Next.js 15 App Router        ✅ Hono GraphQL API
  ✅ FastAPI SSE endpoint         ✅ PostgreSQL + pgvector
  ✅ Redis session + cache        ✅ Azure Container Apps
  ✅ Langfuse tracing             ✅ Docker compose
  ✅ GitHub Actions CI            ✅ Expo SDK 55 mobile app

  Architecture:
  ✅ LangGraph StateGraph         ✅ Supervisor routing
  ✅ 14-intent routing logic      ✅ SSE streaming protocol
  ✅ useAgentStream.ts hook       ✅ UIEventMap dispatch
  ✅ Zustand store shape          ✅ FlashList + Reanimated
  ✅ @gorhom bottom sheet         ✅ Expo Router auth flow
  ✅ Clerk / next-auth setup      ✅ asyncpg pool
  ✅ embed_query() function       ✅ All 126 Cypress tests*
  ✅ All 53 Maestro assertions*

  *fixture data + label updates only, not test logic

  Estimated total LOC changed: ~800
  Estimated total LOC unchanged: ~14,000
```

***

## Why This PRD is Implementable in 2 Weekends

The entire pivot rests on three architectural facts already true in your codebase:

**1. The HITL interrupt() is already wired.**  Your LangGraph graph already has a checkpointer and interrupt-capable nodes. Adding `approval_gate_node` is literally 15 lines — it calls `interrupt()`, returns a `Command(goto=...)`, and your existing SSE layer already knows how to surface the `__interrupt__` payload to the frontend. [docs.langchain](https://docs.langchain.com/oss/python/langgraph/interrupts)

**2. The GenUI discriminated union is already typed.** Adding `'approval-card'`, `'budget-gauge'`, and `'budget-alert'` to `UIEventMap` is 3 new keys. The existing dispatch switch in your chat screen renders them for free.

**3. Role is just a field.**  Passing `role` and `department_id` through the session → stream endpoint → `config["configurable"]` takes 10 minutes. Every tool already reads from `config["configurable"]` — they just get two new keys. [clerk](https://clerk.com/blog/nextjs-role-based-access-control)

The button approach. Here's the complete pattern — thread storage, resume endpoint, and the ApprovalCard wiring.

***

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APPROVAL BUTTON — FROZEN THREAD RESUME PATTERN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The full data flow:

  Employee submits PR
        ↓
  submit_for_approval tool fires
        ↓
  LangGraph hits approval_gate_node → interrupt()
  Graph is NOW FROZEN at this node
  Thread ID saved to PurchaseRequest.approvalThreadId
        ↓
  Manager logs in → asks "show pending approvals"
        ↓
  get_purchase_requests returns ApprovalCard props
  INCLUDING the frozen thread_id
        ↓
  Manager clicks ✓ Approve on the card
        ↓
  Frontend POSTs to /api/procurement/approve
  with { prId, decision, threadId, comments }
        ↓
  Server calls graph.invoke(
    Command(resume=decision), { thread_id: threadId }
  )
        ↓
  LangGraph RESUMES from approval_gate_node
  Routes to agent node → sends confirmation message
  Streams back to manager's chat via SSE
        ↓
  PR status → APPROVED in DB
  Audit entry written
  Manager sees: "✅ PR-2026-0042 approved" in chat

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — ADD threadId TO PurchaseRequest SCHEMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: prisma/schema.prisma
ADD one field to PurchaseRequest:

  model PurchaseRequest {
    ...
    approvalThreadId  String?   // frozen LangGraph thread
    approvalThreadTs  DateTime? // when it was frozen
    ...
  }

RUN:
  npx prisma migrate dev --name "add_approval_thread_id"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — FREEZE THE THREAD IN submit_for_approval
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/agent-core/src/tools.py
MODIFY submit_for_approval — save the thread_id:

  @tool
  async def submit_for_approval(
    pr_id: str,
    config: RunnableConfig = None,
  ) -> str:

    employee_id = config["configurable"]["user_id"]
    dept_id     = config["configurable"]["department_id"]
    thread_id   = config["configurable"]["thread_id"]  # ← key
    pool = await get_pool()

    async with pool.acquire() as conn:
      pr = await conn.fetchrow(
        'SELECT * FROM "PurchaseRequest" WHERE id=$1', pr_id
      )
      if not pr or pr["status"] != "DRAFT":
        return json.dumps({"error": "PR not in DRAFT status"})

      dept = await conn.fetchrow(
        'SELECT * FROM "Department" WHERE id=$1', dept_id
      )

      async with conn.transaction():
        await conn.execute("""
          INSERT INTO "PRApproval"
            ("prId","approverEmail",status)
          VALUES ($1,$2,'PENDING')
        """, pr_id, dept["approverEmail"])

        # ── Save the frozen thread ID ──────────────
        await conn.execute("""
          UPDATE "PurchaseRequest"
          SET status              = 'PENDING_APPROVAL',
              "submittedAt"       = NOW(),
              "approvalThreadId"  = $1,
              "approvalThreadTs"  = NOW()
          WHERE id = $2
        """, thread_id, pr_id)  # ← stored here

        await conn.execute("""
          INSERT INTO "PRAuditEntry"
            ("prId",action,actor,details)
          VALUES ($1,'SUBMITTED',$2,$3)
        """, pr_id, employee_id,
            json.dumps({
              "approver":  dept["approverEmail"],
              "threadId":  thread_id,   # ← in audit too
            }))

    return json.dumps({
      "success":       True,
      "__pr_submitted": True,         # ← triggers HITL gate
      "prNumber":      pr["prNumber"],
      "approverEmail": dept["approverEmail"],
      "totalAmount":   pr["totalAmount"],
      "__ui__": {
        "name": "pr-submitted",
        "props": {
          "prNumber":      pr["prNumber"],
          "approverEmail": dept["approverEmail"],
          "totalAmount":   pr["totalAmount"],
        }
      }
    })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — HITL GATE NODE (approval_gate_node)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/agent-core/src/graph.py

  from langgraph.types import interrupt, Command
  from typing import Literal

  def approval_gate_node(
    state: AgentState,
  ) -> Command[Literal["agent", "__end__"]]:
    """
    Graph pauses here after submit_for_approval.
    Resumes when /api/procurement/approve sends:
      graph.invoke(Command(resume="APPROVED"), config)
    or
      graph.invoke(Command(resume="REJECTED"), config)

    The interrupt() payload is surfaced to the SSE
    caller as an event type "__interrupt__".
    The frontend does NOT need to render this —
    the ApprovalCard is rendered via get_purchase_requests.
    The interrupt is purely the pause mechanism.
    """
    decision = interrupt({
      "type":    "awaiting_manager_approval",
      "message": "Purchase request submitted. "
                 "Waiting for manager decision.",
    })

    if decision == "APPROVED":
      # Inject confirmation message into state
      # so agent can tell employee "your PR was approved"
      return Command(
        goto="agent",
        update={
          "messages": state["messages"] + [{
            "role":    "tool",
            "content": json.dumps({
              "approval_decision": "APPROVED",
              "message": "The manager has APPROVED the PR."
            })
          }]
        }
      )

    # REJECTED
    return Command(
      goto="agent",
      update={
        "messages": state["messages"] + [{
          "role":    "tool",
          "content": json.dumps({
            "approval_decision": "REJECTED",
            "message": "The manager has REJECTED the PR."
          })
        }]
      }
    )

  # ── Wire into StateGraph ──────────────────────────

  builder.add_node("approval_gate", approval_gate_node)

  # Route from tools node:
  def route_after_tools(state: AgentState) -> str:
    """Check if last tool result requested HITL pause."""
    msgs = state.get("messages", [])
    for msg in reversed(msgs):
      if hasattr(msg, "content"):
        try:
          data = json.loads(msg.content)
          if data.get("__pr_submitted"):
            return "approval_gate"
        except (json.JSONDecodeError, AttributeError):
          pass
    return "agent"

  # Replace the existing tools→agent edge with:
  builder.add_conditional_edges(
    "tools",
    route_after_tools,
    {
      "approval_gate": "approval_gate",
      "agent":         "agent",
    }
  )

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — get_purchase_requests RETURNS threadId
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/agent-core/src/tools.py
MODIFY get_purchase_requests — include approvalThreadId
in the ApprovalCard props so the frontend has it:

  # In the manager branch of get_purchase_requests:
  rows = await conn.fetch("""
    SELECT
      pr.id, pr."prNumber", pr.status,
      pr."totalAmount", pr.justification,
      pr.urgency, pr."createdAt",
      pr."approvalThreadId",          ← ADD THIS
      u.name  AS "requestorName",
      u.email AS "requestorEmail",
      COUNT(li.id) AS "itemCount"
    FROM "PurchaseRequest" pr
    JOIN "User" u ON u.id = pr."requestorId"
    LEFT JOIN "PRLineItem" li ON li."prId" = pr.id
    WHERE pr."departmentId" = $1
      AND ($2::text IS NULL OR pr.status = $2)
    GROUP BY pr.id, u.name, u.email
    ORDER BY pr."createdAt" DESC
    LIMIT $3
  """, dept_id, status_filter, limit)

  # The __ui__ approval-card props now include threadId:
  return json.dumps({
    "purchaseRequests": prs,
    "__ui__": {
      "name": "pr-list",
      "props": {
        "loading": False,
        "purchaseRequests": prs,
        # For PENDING_APPROVAL PRs, also emit individual
        # approval-card events so each card is actionable:
        "approvalCards": [
          {
            "prId":          r["id"],
            "prNumber":      r["prNumber"],
            "requestorName": r["requestorName"],
            "totalAmount":   r["totalAmount"],
            "justification": r["justification"],
            "urgency":       r["urgency"],
            "threadId":      r["approvalThreadId"],  # ← KEY
          }
          for r in prs
          if r["status"] == "PENDING_APPROVAL"
             and r["approvalThreadId"]
        ]
      }
    }
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — PYTHON APPROVE ENDPOINT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/agent-core/src/main.py
ADD this endpoint alongside /stream:

  from langgraph.types import Command

  class ApprovalRequest(BaseModel):
    pr_id:     str
    thread_id: str
    decision:  Literal["APPROVED", "REJECTED"]
    comments:  str = ""

  @app.post("/procurement/approve")
  async def approve_pr(
    body:    ApprovalRequest,
    request: Request,
  ):
    """
    Called by the frontend ApprovalCard button.
    Resumes the frozen LangGraph thread with the
    manager's decision, then streams the response
    back as SSE so the manager sees confirmation.
    """
    # Auth: extract manager identity from JWT
    token   = request.headers.get("Authorization","").lstrip("Bearer ")
    manager = await decode_jwt(token)

    if manager["role"] not in ("MANAGER", "ADMIN"):
      raise HTTPException(403, "Manager role required")

    config = {
      "configurable": {
        "thread_id":     body.thread_id,  # ← resume this
        "user_id":       manager["id"],
        "user_email":    manager["email"],
        "role":          manager["role"],
        "department_id": manager["department_id"],
      }
    }

    async def stream_resume():
      try:
        # Resume the frozen graph with the decision
        # Command(resume=...) is the LangGraph HITL
        # resume primitive
        async for event in graph.astream(
          Command(resume=body.decision),
          config=config,
          stream_mode=["messages", "custom"],
        ):
          async for chunk in graph_to_sse(event):
            yield chunk
        yield "event: end\ndata: {}\n\n"

      except Exception as e:
        err = json.dumps({"error": str(e)})
        yield f"event: error\ndata: {err}\n\n"

    return StreamingResponse(
      stream_resume(),
      media_type="text/event-stream",
      headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      }
    )

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — NEXT.JS APPROVE ROUTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/web/app/api/procurement/approve/route.ts
NEW FILE — thin proxy to Python agent:

  import { getServerSession } from 'next-auth'
  import { authOptions }      from '@/lib/auth'
  import { NextRequest }      from 'next/server'

  const AGENT = process.env.AGENT_INTERNAL_URL!
  // e.g. http://localhost:8000 (dev)
  //      http://agent-core.internal (prod)

  export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const role = session.user.role
    if (!['MANAGER', 'ADMIN'].includes(role)) {
      return new Response('Forbidden', { status: 403 })
    }

    const body = await req.json()

    // Validate required fields
    if (!body.prId || !body.threadId || !body.decision) {
      return new Response('Missing required fields',
        { status: 400 })
    }
    if (!['APPROVED','REJECTED'].includes(body.decision)) {
      return new Response('Invalid decision', { status: 400 })
    }

    // Forward to Python agent — proxy the SSE stream
    const upstream = await fetch(
      `${AGENT}/procurement/approve`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          pr_id:     body.prId,
          thread_id: body.threadId,
          decision:  body.decision,
          comments:  body.comments ?? '',
        }),
      }
    )

    if (!upstream.ok) {
      const err = await upstream.text()
      return new Response(err, { status: upstream.status })
    }

    // Stream the SSE response back to the browser
    return new Response(upstream.body, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    })
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — useApprovalDecision HOOK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/web/hooks/useApprovalDecision.ts  (web)
FILE: apps/mobile/src/hooks/useApprovalDecision.ts

  // This hook handles the button click →
  // POST /api/procurement/approve →
  // SSE stream → chat messages appear in real-time.
  //
  // The manager sees the agent's confirmation
  // streaming into their chat, just like a normal reply.

  import { useCallback, useRef } from 'react'
  import { useChatStore }        from '../store/chat.store'

  type Decision = 'APPROVED' | 'REJECTED'

  export function useApprovalDecision() {
    const upsertMessage = useChatStore(s => s.upsertMessage)
    const setStreaming   = useChatStore(s => s.setStreaming)
    const setError       = useChatStore(s => s.setError)
    const esRef          = useRef<EventSource | null>(null)

    const decide = useCallback(async (
      prId:     string,
      threadId: string,
      decision: Decision,
      comments: string = '',
    ) => {
      setStreaming(true)
      setError(null)

      // Close stale connections
      esRef.current?.close()

      const res = await fetch('/api/procurement/approve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prId, threadId, decision, comments
        }),
      })

      if (!res.ok) {
        const msg = await res.text()
        setError(msg || 'Approval failed')
        setStreaming(false)
        return
      }

      // Read SSE stream from response body
      // (same pattern as useAgentStream)
      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      const aiMsgId = `ai-approval-${Date.now()}`

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text   = decoder.decode(value)
        const lines  = text.split('\n')

        for (const line of lines) {
          if (line.startsWith('event: end')) {
            setStreaming(false)
            return
          }
          if (line.startsWith('event: error')) {
            setError('Approval stream error')
            setStreaming(false)
            return
          }
          if (line.startsWith('data: ') &&
              !line.includes('event: end')) {
            try {
              const msgs = JSON.parse(line.slice(6))
              for (const msg of Array.isArray(msgs)
                ? msgs : [msgs]
              ) {
                if (msg.type === 'ai' && msg.content) {
                  upsertMessage(aiMsgId, msg.content)
                }
              }
            } catch { /* malformed chunk */ }
          }
        }
      }

      setStreaming(false)
    }, [upsertMessage, setStreaming, setError])

    return { decide }
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — ApprovalCard COMPONENT (COMPLETE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/mobile/src/components/genui/ApprovalCard.tsx
FILE: apps/web/components/genui/ApprovalCard.tsx  (adapt)

  // The threadId prop is what makes the button work.
  // Without it the button is disabled.

  import { useState, memo, useCallback } from 'react'
  import {
    View, Text, TextInput,
    TouchableOpacity, StyleSheet,
    ActivityIndicator,
  } from 'react-native'
  import Animated, { FadeInDown } from 'react-native-reanimated'
  import * as Haptics from 'expo-haptics'
  import { useApprovalDecision }
    from '../../hooks/useApprovalDecision'
  import { colors, font, spacing, radius, shadow }
    from '../../lib/theme'

  type LineItem = {
    name:       string
    quantity:   number
    unitPrice:  number
    totalPrice: number
  }

  type Props = {
    prId:          string
    prNumber:      string
    requestorName: string
    totalAmount:   number
    lineItems:     LineItem[]
    justification: string
    urgency:       'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
    threadId:      string | null    // null = not actionable yet
  }

  const URGENCY_COLOR = {
    LOW:      colors.textMuted,
    NORMAL:   colors.text,
    HIGH:     colors.warning,
    CRITICAL: colors.error,
  }

  export const ApprovalCard = memo(function ApprovalCard({
    prId, prNumber, requestorName, totalAmount,
    lineItems, justification, urgency, threadId,
  }: Props) {

    const { decide }         = useApprovalDecision()
    const [comments, setComments]   = useState('')
    const [loading,  setLoading]    = useState(false)
    const [decided,  setDecided]    =
      useState<'APPROVED' | 'REJECTED' | null>(null)

    const urgencyColor = URGENCY_COLOR[urgency]

    const handleDecide = useCallback(
      async (decision: 'APPROVED' | 'REJECTED') => {
        if (!threadId || loading) return

        setLoading(true)
        await Haptics.notificationAsync(
          decision === 'APPROVED'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        )

        await decide(prId, threadId, decision, comments)

        setDecided(decision)
        setLoading(false)
      },
      [threadId, loading, prId, comments, decide]
    )

    // ── Already decided state ──────────────────────
    if (decided) {
      return (
        <Animated.View
          style={[
            s.card,
            decided === 'APPROVED' ? s.cardApproved : s.cardRejected
          ]}
          entering={FadeInDown.springify()}
        >
          <Text style={s.decidedIcon}>
            {decided === 'APPROVED' ? '✅' : '❌'}
          </Text>
          <Text style={s.decidedTitle}>
            {prNumber} {decided.toLowerCase()}
          </Text>
          {comments ? (
            <Text style={s.decidedComments}>
              "{comments}"
            </Text>
          ) : null}
        </Animated.View>
      )
    }

    // ── Actionable state ───────────────────────────
    return (
      <Animated.View
        style={s.card}
        entering={FadeInDown.springify()}
        testID="approval-card"
      >

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.prNumber}>{prNumber}</Text>
            <Text style={s.requestor}>
              from {requestorName}
            </Text>
          </View>
          <View style={[s.urgencyBadge,
            { borderColor: urgencyColor }
          ]}>
            <Text style={[s.urgencyText,
              { color: urgencyColor }
            ]}>
              {urgency}
            </Text>
          </View>
        </View>

        {/* Justification */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>
            Justification
          </Text>
          <Text style={s.justification}>
            {justification}
          </Text>
        </View>

        {/* Line items */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>
            Items ({lineItems.length})
          </Text>
          {lineItems.map((item, i) => (
            <View key={i} style={s.lineItem}>
              <Text style={s.itemName} numberOfLines={1}>
                {item.quantity}× {item.name}
              </Text>
              <Text style={s.itemPrice}>
                ₹{item.totalPrice.toLocaleString('en-IN')}
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalAmount}>
            ₹{totalAmount.toLocaleString('en-IN')}
          </Text>
        </View>

        {/* Comments input */}
        <TextInput
          style={s.commentsInput}
          placeholder="Add a comment (optional)"
          placeholderTextColor={colors.textFaint}
          value={comments}
          onChangeText={setComments}
          multiline
          editable={!loading}
          testID="approval-comments-input"
        />

        {/* Not yet actionable — thread not frozen yet */}
        {!threadId && (
          <View style={s.pendingNote}>
            <Text style={s.pendingNoteText}>
              ⏳ Waiting for employee to submit…
            </Text>
          </View>
        )}

        {/* Decision buttons */}
        {threadId && (
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.btn, s.rejectBtn,
                loading && s.btnDisabled]}
              onPress={() => handleDecide('REJECTED')}
              disabled={loading}
              activeOpacity={0.85}
              testID="reject-pr-btn"
            >
              {loading
                ? <ActivityIndicator
                    color={colors.error} size="small" />
                : <Text style={s.rejectText}>✕ Reject</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btn, s.approveBtn,
                loading && s.btnDisabled]}
              onPress={() => handleDecide('APPROVED')}
              disabled={loading}
              activeOpacity={0.85}
              testID="approve-pr-btn"
            >
              {loading
                ? <ActivityIndicator
                    color="#fff" size="small" />
                : <Text style={s.approveText}>✓ Approve</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    )
  })

  const s = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius:    radius.xl,
      padding:         spacing[5],
      gap:             spacing[4],
      ...shadow.md,
    },
    cardApproved: {
      backgroundColor: colors.successBg,
      borderWidth: 1,
      borderColor: colors.success,
    },
    cardRejected: {
      backgroundColor: colors.errorBg,
      borderWidth: 1,
      borderColor: colors.error,
    },
    decidedIcon: {
      fontSize: 36, textAlign: 'center',
    },
    decidedTitle: {
      textAlign: 'center',
      fontSize:  font.size.lg,
      fontWeight:'700',
      color:     colors.text,
      fontFamily:font.family,
    },
    decidedComments: {
      textAlign: 'center',
      fontSize:  font.size.sm,
      color:     colors.textMuted,
      fontFamily:font.family,
      fontStyle: 'italic',
    },
    header: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'flex-start',
    },
    headerLeft: { gap: spacing [abstractalgorithms](https://www.abstractalgorithms.dev/langgraph-human-in-the-loop) },
    prNumber: {
      fontSize:  font.size.xl,
      fontWeight:'700',
      color:     colors.text,
      fontFamily:font.family,
    },
    requestor: {
      fontSize:  font.size.sm,
      color:     colors.textMuted,
      fontFamily:font.family,
    },
    urgencyBadge: {
      borderWidth:   1.5,
      borderRadius:  radius.full,
      paddingHorizontal: spacing[3],
      paddingVertical:   spacing [abstractalgorithms](https://www.abstractalgorithms.dev/langgraph-human-in-the-loop),
    },
    urgencyText: {
      fontSize:  font.size.xs,
      fontWeight:'700',
      fontFamily:font.family,
    },
    section: { gap: spacing[2] },
    sectionLabel: {
      fontSize:  font.size.xs,
      fontWeight:'700',
      color:     colors.textMuted,
      fontFamily:font.family,
      textTransform: 'uppercase',
      letterSpacing:  0.8,
    },
    justification: {
      fontSize:  font.size.sm,
      color:     colors.text,
      fontFamily:font.family,
      lineHeight: font.size.sm * 1.6,
    },
    lineItem: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      paddingVertical: spacing[2],
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    itemName: {
      flex: 1,
      fontSize:  font.size.sm,
      color:     colors.text,
      fontFamily:font.family,
      marginRight: spacing[2],
    },
    itemPrice: {
      fontSize:  font.size.sm,
      fontWeight:'600',
      color:     colors.text,
      fontFamily:font.family,
    },
    totalRow: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'center',
      paddingTop:     spacing[2],
    },
    totalLabel: {
      fontSize:  font.size.base,
      fontWeight:'600',
      color:     colors.text,
      fontFamily:font.family,
    },
    totalAmount: {
      fontSize:  font.size.xl,
      fontWeight:'700',
      color:     colors.primary,
      fontFamily:font.family,
    },
    commentsInput: {
      backgroundColor: colors.bg,
      borderRadius:    radius.md,
      borderWidth:     1,
      borderColor:     colors.border,
      paddingHorizontal: spacing[4],
      paddingVertical:   spacing[3],
      fontSize:        font.size.sm,
      color:           colors.text,
      fontFamily:      font.family,
      minHeight:       72,
    },
    pendingNote: {
      backgroundColor: colors.surfaceOffset,
      borderRadius:    radius.md,
      padding:         spacing[3],
      alignItems:      'center',
    },
    pendingNoteText: {
      fontSize:  font.size.sm,
      color:     colors.textMuted,
      fontFamily:font.family,
    },
    actions: {
      flexDirection: 'row',
      gap:           spacing[3],
    },
    btn: {
      flex:           1,
      height:         48,
      borderRadius:   radius.lg,
      alignItems:     'center',
      justifyContent: 'center',
      ...shadow.sm,
    },
    btnDisabled: { opacity: 0.6 },
    rejectBtn: {
      backgroundColor: colors.surface,
      borderWidth:     1.5,
      borderColor:     colors.error,
    },
    approveBtn: {
      backgroundColor: colors.primary,
    },
    rejectText: {
      color:     colors.error,
      fontWeight:'700',
      fontSize:  font.size.base,
      fontFamily:font.family,
    },
    approveText: {
      color:     '#fff',
      fontWeight:'700',
      fontSize:  font.size.base,
      fontFamily:font.family,
    },
  })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 9 — WIRE ApprovalCard INTO CHAT SCREEN renderItem
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/mobile/src/app/(app)/index.tsx
ADD to the renderItem switch:

  case 'ui': {
    const { name, props } = item.data

    // ... existing cases ...

    if (name === 'pr-list') {
      return (
        <View style={s.genUiWrap}>
          {/* PR list summary */}
          <PRList
            purchaseRequests={props.purchaseRequests}
          />
          {/* Inline ApprovalCards for PENDING ones */}
          {(props.approvalCards ?? []).map(
            (ac: ApprovalCardProps) => (
              <ApprovalCard
                key={ac.prId}
                {...ac}
                // threadId comes from props — enables button
              />
            )
          )}
        </View>
      )
    }

    // ... rest of cases ...
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 10 — UIEventMap UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/mobile/src/store/chat.store.ts

  export type ApprovalCardProps = {
    prId:          string
    prNumber:      string
    requestorName: string
    totalAmount:   number
    lineItems:     PRLineItem[]
    justification: string
    urgency:       'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'
    threadId:      string | null   // ← the key field
  }

  export type UIEventMap = {
    'catalog-grid':    CatalogGridProps
    'pr-draft':        PRDraftProps
    'pr-list':         PRListProps & {
      approvalCards?: ApprovalCardProps[]  // ← nested
    }
    'dispute-card':    DisputeCardProps
    'budget-gauge':    BudgetGaugeProps
    'budget-alert':    BudgetAlertProps
    'pr-submitted':    PRSubmittedProps
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLETE FLOW TRACE (what Langfuse will show)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  EMPLOYEE THREAD (thread-abc-123):
  ├── agent_node          [LLM call]
  ├── tools               [submit_for_approval]
  │     └── DB write: PR status=PENDING_APPROVAL
  │         DB write: approvalThreadId='thread-abc-123'
  │         Audit: SUBMITTED
  └── approval_gate_node  [INTERRUPTED ⏸]
      └── interrupt payload: { type: 'awaiting_approval' }
      └── Graph is FROZEN here, thread saved in checkpointer

  ── time passes ──

  MANAGER CLICK → POST /api/procurement/approve
  ├── Validates JWT role=MANAGER
  ├── Forwards to Python /procurement/approve
  └── RESUME thread-abc-123 with Command(resume='APPROVED')

  EMPLOYEE THREAD RESUMES (thread-abc-123):
  ├── approval_gate_node  [RESUMED ▶]
  │     └── decision='APPROVED'
  │         update state with approval confirmation
  └── agent_node          [LLM call]
        └── "Great news! PR-2026-0042 has been approved
             by Rahul Mehta. The procurement team will
             now raise a PO with the vendor."
        └── Streams back to MANAGER's SSE connection
```

***

## The One Subtlety to Understand

The frozen graph lives in the **employee's thread** (`thread-abc-123`). When the manager clicks Approve, you resume *that same thread* — not the manager's thread. The confirmation message streams back to whoever called `/procurement/approve` (the manager's browser), but the graph state is the employee's conversation. [abstractalgorithms](https://www.abstractalgorithms.dev/langgraph-human-in-the-loop)

This means in the demo you'll want to **show both perspectives**: employee's chat shows "Submitted — waiting for Rahul" → manager clicks approve → manager sees "PR-2026-0042 approved" streaming in real time → if employee refreshes, they also see the approval confirmation via `get_purchase_requests`.

Here's the complete Upstash Redis pub/sub + QStash wiring. Two different jobs, used together. [mintlify](https://www.mintlify.com/upstash/redis-js/advanced/pub-sub)

***

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UPSTASH REDIS PUB/SUB + QSTASH
WHAT EACH ONE DOES IN THIS SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Upstash Redis pub/sub → REAL-TIME push
  ────────────────────────────────────────
  When manager clicks Approve, the employee's open
  browser tab receives the notification instantly
  via SSE over HTTP (no WebSocket). [web:457]
  Channel name: "pr:approval:{employeeId}"
  Used for: live "your PR was approved" banner

  QStash → DURABLE delivery
  ────────────────────────────────────────
  Guarantees the notification is delivered even if:
    - employee's tab is closed
    - server restarts mid-approval
    - network blip during publish
  QStash calls your /api/notifications/deliver
  endpoint with retries until 200. [web:466]
  Used for: email fallback + mobile push fallback

  Together:
  ─────────────────────────────────────────────────
  Manager approves
    ├── Upstash PUBLISH → employee's open tab
    │   gets instant SSE banner (if tab is open)
    └── QStash PUBLISH → /api/notifications/deliver
        (fires 5s later, guaranteed, with retries)
        checks if employee already saw it via Redis
        if not seen → sends email / Expo push

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL PACKAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # In apps/web:
  pnpm add @upstash/redis @upstash/qstash

  # In apps/agent-core:
  pip install upstash-redis qstash

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — ENV VARS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # .env.local (web) + apps/agent-core/.env

  # Upstash Redis — get from console.upstash.com
  UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
  UPSTASH_REDIS_REST_TOKEN=AXxx...

  # QStash — get from console.upstash.com → QStash tab
  QSTASH_URL=https://qstash.upstash.io
  QSTASH_TOKEN=eyJ...
  QSTASH_CURRENT_SIGNING_KEY=sig_xxx
  QSTASH_NEXT_SIGNING_KEY=sig_yyy

  # Your app's public URL (QStash needs to reach it)
  NEXT_PUBLIC_APP_URL=https://procureai.yourdomain.com
  # Dev: use ngrok → ngrok http 3000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — UPSTASH CLIENTS (shared lib)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/web/lib/upstash.ts

  import { Redis }  from '@upstash/redis'
  import { Client } from '@upstash/qstash'

  // Redis client — singleton
  export const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  // QStash client — singleton
  export const qstash = new Client({
    token: process.env.QSTASH_TOKEN!,
  })

  // Channel naming convention
  export const prChannel = (employeeId: string) =>
    `pr:approval:${employeeId}`

  // Seen-key: prevent duplicate email after tab catches it
  export const prSeenKey = (prId: string) =>
    `pr:seen:${prId}`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — PUBLISH FROM PYTHON AGENT
         (fires after process_approval tool)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/agent-core/src/notifications.py  (NEW FILE)

  import os, json, httpx
  from datetime import datetime

  REDIS_URL   = os.environ["UPSTASH_REDIS_REST_URL"]
  REDIS_TOKEN = os.environ["UPSTASH_REDIS_REST_TOKEN"]
  QSTASH_URL  = os.environ["QSTASH_URL"]
  QSTASH_TOKEN = os.environ["QSTASH_TOKEN"]
  APP_URL     = os.environ["NEXT_PUBLIC_APP_URL"]

  async def publish_approval_event(
    employee_id: str,
    pr_id:       str,
    pr_number:   str,
    decision:    str,   # "APPROVED" | "REJECTED"
    comments:    str,
    approver_name: str,
    total_amount:  int,
  ):
    """
    1. Upstash Redis PUBLISH → employee's open SSE tab
    2. QStash PUBLISH → durable fallback (5s delay)
    Both fire in parallel.
    """
    payload = {
      "type":         "pr_decision",
      "prId":         pr_id,
      "prNumber":     pr_number,
      "decision":     decision,
      "comments":     comments,
      "approverName": approver_name,
      "totalAmount":  total_amount,
      "timestamp":    datetime.utcnow().isoformat(),
    }
    payload_json = json.dumps(payload)
    channel      = f"pr:approval:{employee_id}"

    async with httpx.AsyncClient() as client:
      # ── 1. Upstash Redis PUBLISH (fire and forget) ──
      # Uses REST API — works from any environment [web:457]
      redis_task = client.post(
        f"{REDIS_URL}/publish/{channel}",
        headers={
          "Authorization": f"Bearer {REDIS_TOKEN}",
          "Content-Type":  "application/json",
        },
        content=payload_json,
      )

      # ── 2. QStash PUBLISH (guaranteed delivery) ─────
      # Calls /api/notifications/deliver on your web app
      # with a 5s delay — gives Redis pub/sub time to fire
      # first. If employee already saw it, handler no-ops. [web:466]
      qstash_task = client.post(
        f"{QSTASH_URL}/v2/publish/"
        f"{APP_URL}/api/notifications/deliver",
        headers={
          "Authorization":  f"Bearer {QSTASH_TOKEN}",
          "Content-Type":   "application/json",
          "Upstash-Delay":  "5s",       # give pub/sub priority
          "Upstash-Retries": "3",       # retry 3× on failure
          "Upstash-Retry-Delay": "30s", # 30s between retries
        },
        content=json.dumps({
          **payload,
          "employeeId": employee_id,
        }),
      )

      # Fire both in parallel
      await asyncio.gather(
        redis_task, qstash_task,
        return_exceptions=True   # don't crash if one fails
      )

FILE: apps/agent-core/src/tools.py
MODIFY process_approval — call publish at the end:

  from notifications import publish_approval_event
  import asyncio

  @tool
  async def process_approval(
    pr_id:    str,
    decision: str,
    comments: str = "",
    config: RunnableConfig = None,
  ) -> str:
    # ... existing approval logic (DB writes) ...

    # After DB transaction committed:
    asyncio.create_task(
      publish_approval_event(
        employee_id   = pr["requestorId"],
        pr_id         = pr_id,
        pr_number     = pr["prNumber"],
        decision      = decision,
        comments      = comments,
        approver_name = config["configurable"]["user_email"],
        total_amount  = pr["totalAmount"],
      )
    )

    return json.dumps({ "success": True, ... })

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — EMPLOYEE SSE SUBSCRIPTION ENDPOINT
         (Next.js — long-lived GET)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/web/app/api/notifications/subscribe/route.ts

  // Employee's browser opens this SSE connection
  // on page load. Stays open. Receives push events
  // the moment manager clicks Approve. [web:456][web:459]

  import { getServerSession } from 'next-auth'
  import { authOptions }      from '@/lib/auth'
  import { redis, prChannel } from '@/lib/upstash'

  export const dynamic    = 'force-dynamic'
  export const maxDuration = 300  // 5 min max on serverless

  export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const employeeId = session.user.id
    const channel    = prChannel(employeeId)

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        // Send heartbeat every 25s to keep connection alive
        // (Vercel / Azure kill idle SSE after 30s)
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(
              encoder.encode(': heartbeat\n\n')
            )
          } catch {
            clearInterval(heartbeat)
          }
        }, 25_000)

        // Subscribe to Upstash Redis channel via HTTP SSE
        // The Subscriber class uses Upstash's SSE endpoint
        // internally — no persistent TCP connection needed [web:457]
        const subscriber = await redis.subscribe(channel)

        // Send connection confirmation
        controller.enqueue(
          encoder.encode(
            `event: connected\n` +
            `data: ${JSON.stringify({
              channel, employeeId
            })}\n\n`
          )
        )

        // Forward every published message to browser
        subscriber.on('message', (data: string) => {
          try {
            controller.enqueue(
              encoder.encode(
                `event: pr-decision\n` +
                `data: ${data}\n\n`
              )
            )
          } catch {
            // Client disconnected
            subscriber.unsubscribe()
            clearInterval(heartbeat)
          }
        })

        // Clean up when client disconnects
        return () => {
          subscriber.unsubscribe()
          clearInterval(heartbeat)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — QSTASH DELIVERY ENDPOINT
         (durable fallback — called by QStash)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/web/app/api/notifications/deliver/route.ts

  // QStash calls this 5s after approval.
  // If employee's tab already received the pub/sub event,
  // it marks a seen-key in Redis and this is a no-op.
  // If not seen → send email + mobile push. [web:469]

  import { verifySignatureAppRouter }
    from '@upstash/qstash/nextjs'
  import { redis, prSeenKey } from '@/lib/upstash'
  import { sendApprovalEmail }  from '@/lib/email'
  import { sendExpoPush }       from '@/lib/expo-push'
  import { db }                 from '@/lib/db'

  async function handler(req: Request) {
    const body = await req.json() as {
      type:         string
      prId:         string
      prNumber:     string
      decision:     string
      comments:     string
      approverName: string
      totalAmount:  number
      employeeId:   string
      timestamp:    string
    }

    // Check if employee's open tab already received it
    const seenKey  = prSeenKey(body.prId)
    const alreadySeen = await redis.get(seenKey)

    if (alreadySeen) {
      // Tab was open — pub/sub delivered it already.
      // Nothing to do. Return 200 so QStash stops retrying.
      console.log(
        `[notifications] PR ${body.prId} already seen — skip`
      )
      return new Response('ok', { status: 200 })
    }

    // Tab was closed — deliver via email + push
    const employee = await db.user.findUnique({
      where: { id: body.employeeId },
      select: { email: true, name: true, expoPushToken: true }
    })

    if (!employee) {
      return new Response('Employee not found', { status: 404 })
    }

    // ── Email ───────────────────────────────────────
    await sendApprovalEmail({
      to:           employee.email,
      name:         employee.name ?? 'there',
      prNumber:     body.prNumber,
      decision:     body.decision as 'APPROVED' | 'REJECTED',
      comments:     body.comments,
      approverName: body.approverName,
      totalAmount:  body.totalAmount,
    })

    // ── Expo Push (if token exists) ─────────────────
    if (employee.expoPushToken) {
      await sendExpoPush({
        token:   employee.expoPushToken,
        title:   body.decision === 'APPROVED'
                   ? `✅ PR Approved — ${body.prNumber}`
                   : `❌ PR Rejected — ${body.prNumber}`,
        body:    body.decision === 'APPROVED'
                   ? `Your purchase request for ₹${
                       body.totalAmount.toLocaleString('en-IN')
                     } was approved by ${body.approverName}`
                   : `${body.approverName}: "${body.comments}"`,
        data: {
          type:     'pr_decision',
          prId:     body.prId,
          prNumber: body.prNumber,
          decision: body.decision,
        }
      })
    }

    return new Response('ok', { status: 200 })
  }

  // verifySignatureAppRouter validates the QStash
  // HMAC signature — prevents spoofed requests [web:469]
  export const POST = verifySignatureAppRouter(handler)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — MARK-SEEN ENDPOINT
         (called by browser when banner is shown)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/web/app/api/notifications/seen/route.ts

  // Browser calls this immediately after rendering
  // the approval banner. Sets the seen-key in Redis
  // with 1h TTL. QStash delivery endpoint checks this
  // and skips email if key exists.

  import { getServerSession } from 'next-auth'
  import { authOptions }      from '@/lib/auth'
  import { redis, prSeenKey } from '@/lib/upstash'

  export async function POST(req: Request) {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { prId } = await req.json()
    if (!prId) {
      return new Response('Missing prId', { status: 400 })
    }

    // TTL: 1 hour — enough for QStash to check
    await redis.set(prSeenKey(prId), '1', { ex: 3600 })

    return new Response('ok', { status: 200 })
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8 — usePRNotifications HOOK (Web)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/web/hooks/usePRNotifications.ts

  // Opens the SSE subscription on mount.
  // Shows a toast/banner when decision arrives.
  // Marks seen immediately so QStash skips email.

  import { useEffect, useRef, useCallback } from 'react'
  import { useChatStore } from '@/store/chat.store'
  import { toast }        from 'sonner'   // or your toast lib

  type PRDecisionEvent = {
    type:         'pr_decision'
    prId:         string
    prNumber:     string
    decision:     'APPROVED' | 'REJECTED'
    comments:     string
    approverName: string
    totalAmount:  number
  }

  export function usePRNotifications() {
    const esRef     = useRef<EventSource | null>(null)
    const addMessage = useChatStore(s => s.addMessage)

    const markSeen = useCallback(async (prId: string) => {
      await fetch('/api/notifications/seen', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prId }),
      })
    }, [])

    useEffect(() => {
      // Open SSE subscription to Upstash Redis channel
      const es = new EventSource(
        '/api/notifications/subscribe'
      )

      es.addEventListener('pr-decision', async (e) => {
        const data: PRDecisionEvent = JSON.parse(e.data)

        // 1. Mark seen immediately → stops QStash email
        await markSeen(data.prId)

        // 2. Show toast notification
        const approved = data.decision === 'APPROVED'
        toast[approved ? 'success' : 'error'](
          `${data.prNumber} ${approved
            ? 'approved ✅'
            : 'rejected ❌'}`,
          {
            description: approved
              ? `₹${data.totalAmount.toLocaleString('en-IN')} approved by ${data.approverName}`
              : data.comments || `Rejected by ${data.approverName}`,
            duration: 8000,
            action: {
              label:   'View',
              onClick: () => {
                // Navigate to PR history tab
                window.location.href = '/chat?tab=requests'
              }
            }
          }
        )

        // 3. Inject into chat history as a system message
        //    so employee sees it in their chat thread too
        addMessage({
          id:        `notif-${data.prId}`,
          role:      'ai',
          content:   approved
            ? `🎉 Great news! **${data.prNumber}** has been approved by ${data.approverName}. The procurement team will now raise a PO with the vendor.`
            : `❌ **${data.prNumber}** was rejected by ${data.approverName}. ${data.comments ? `Reason: "${data.comments}"` : ''}`,
          timestamp: Date.now(),
        })
      })

      es.addEventListener('connected', () => {
        console.log('[notifications] SSE connected')
      })

      es.onerror = () => {
        // EventSource auto-reconnects — no manual handling
        console.warn('[notifications] SSE error — reconnecting')
      }

      esRef.current = es

      return () => {
        es.close()
        esRef.current = null
      }
    }, [addMessage, markSeen])
  }

  // Mount in root layout — once per session:
  // apps/web/app/(app)/layout.tsx
  //   'use client'
  //   import { usePRNotifications } from '@/hooks/usePRNotifications'
  //   export default function AppLayout({ children }) {
  //     usePRNotifications()
  //     return <>{children}</>
  //   }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 9 — EXPO PUSH (Mobile)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/web/lib/expo-push.ts

  // QStash delivery endpoint calls this when employee
  // tab was closed. Uses Expo Push API directly —
  // no extra service needed.

  type PushPayload = {
    token:   string
    title:   string
    body:    string
    data?:   Record<string, unknown>
  }

  export async function sendExpoPush({
    token, title, body, data = {}
  }: PushPayload) {
    const res = await fetch(
      'https://exp.host/--/api/v2/push/send',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:    token,
          title,
          body,
          data,
          sound: 'default',
          priority: 'high',
        }),
      }
    )

    const json = await res.json()
    if (json.data?.status === 'error') {
      console.error('[expo-push] error:', json.data.message)
    }
    return json
  }

FILE: apps/mobile/src/app/_layout.tsx
ADD Expo push token registration on login:

  import * as Notifications from 'expo-notifications'
  import * as Device        from 'expo-device'

  // Call this once after successful sign-in:
  async function registerPushToken(authToken: string) {
    if (!Device.isDevice) return  // skip in simulator

    const { status: existing } =
      await Notifications.getPermissionsAsync()
    let finalStatus = existing

    if (existing !== 'granted') {
      const { status } =
        await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') return

    const { data: expoPushToken } =
      await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      })

    // Save token to your backend
    await fetch(
      `${process.env.EXPO_PUBLIC_AGENT_URL}/me/push-token`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          expoPushToken
        }),
      }
    )
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 10 — SAVE PUSH TOKEN TO DB (Python endpoint)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/agent-core/src/main.py  ADD:

  class PushTokenRequest(BaseModel):
    expoPushToken: str

  @app.post("/me/push-token")
  async def save_push_token(
    body:    PushTokenRequest,
    request: Request,
  ):
    token   = request.headers.get("Authorization",""
      ).lstrip("Bearer ")
    user    = await decode_jwt(token)
    pool    = await get_pool()

    async with pool.acquire() as conn:
      await conn.execute("""
        UPDATE "User"
        SET "expoPushToken" = $1
        WHERE id = $2
      """, body.expoPushToken, user["id"])

    return {"ok": True}

  # Add expoPushToken String? to User in Prisma schema:
  # expoPushToken  String?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLETE EVENT SEQUENCE (annotated)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  T+0ms   Manager clicks ✓ Approve
          → POST /api/procurement/approve

  T+10ms  Python process_approval tool:
          → DB: PR status = APPROVED
          → DB: AuditEntry written
          → asyncio.create_task(publish_approval_event)

  T+20ms  publish_approval_event fires TWO calls in parallel:

          A) Upstash Redis REST PUBLISH
             channel: "pr:approval:{employeeId}"
             → Upstash fans out to all subscribers

          B) QStash PUBLISH
             to: {APP_URL}/api/notifications/deliver
             delay: 5s
             retries: 3

  T+25ms  Employee's browser SSE connection receives:
             event: pr-decision
             data: { prId, prNumber, decision: "APPROVED", ... }

  T+30ms  usePRNotifications handler fires:
          → fetch POST /api/notifications/seen
             Redis SET pr:seen:{prId} = "1" (TTL 1h)
          → toast.success("PR-2026-0042 approved ✅")
          → chat message injected: "🎉 Great news!..."

  T+5000ms QStash calls /api/notifications/deliver:
          → redis.get(pr:seen:{prId}) → "1"  ← already seen
          → return 200, skip email, skip push
          QStash marks delivered ✓

  ── Tab was CLOSED scenario: ──────────────────────────

  T+0ms   Same as above through T+20ms

  T+25ms  No SSE subscriber → Redis PUBLISH is a no-op
          (no error — just no receivers)

  T+5000ms QStash calls /api/notifications/deliver:
          → redis.get(pr:seen:{prId}) → null  ← NOT seen
          → sendApprovalEmail(employee.email, ...)
          → sendExpoPush(employee.expoPushToken, ...)
          → return 200

  T+5030ms Employee's phone: push notification arrives
          → "✅ PR Approved — PR-2026-0042"
          → tap → opens app → navigates to PR history

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 11 — EMAIL TEMPLATE (sendApprovalEmail)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FILE: apps/web/lib/email.ts

  // Use Resend (1 line setup) or SendGrid.
  // Resend recommended — works with Next.js/Edge natively.

  import { Resend } from 'resend'
  const resend = new Resend(process.env.RESEND_API_KEY)

  type ApprovalEmailProps = {
    to:           string
    name:         string
    prNumber:     string
    decision:     'APPROVED' | 'REJECTED'
    comments:     string
    approverName: string
    totalAmount:  number
  }

  export async function sendApprovalEmail(
    props: ApprovalEmailProps
  ) {
    const approved = props.decision === 'APPROVED'
    const subject  = approved
      ? `✅ ${props.prNumber} approved — action required`
      : `❌ ${props.prNumber} rejected`

    await resend.emails.send({
      from:    'ProcureAI <no-reply@procureai.com>',
      to:      props.to,
      subject,
      html: `
        <p>Hi ${props.name},</p>
        <p>
          Your purchase request <strong>${props.prNumber}</strong>
          for <strong>₹${props.totalAmount.toLocaleString('en-IN')}</strong>
          has been <strong>${props.decision}</strong>
          by ${props.approverName}.
        </p>
        ${props.comments
          ? `<p>Comment: <em>"${props.comments}"</em></p>`
          : ''
        }
        ${approved
          ? `<p>The procurement team will now raise a
             Purchase Order with the vendor. Expect
             delivery within the lead time stated
             on each item.</p>`
          : `<p>Please sign in to ProcureAI to revise
             your request or contact your manager for
             more information.</p>`
        }
        <p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/chat">
            View in ProcureAI →
          </a>
        </p>
      `
    })
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ENV CHECKLIST (everything needed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  # Upstash — from console.upstash.com
  UPSTASH_REDIS_REST_URL=
  UPSTASH_REDIS_REST_TOKEN=

  # QStash — from console.upstash.com → QStash
  QSTASH_TOKEN=
  QSTASH_CURRENT_SIGNING_KEY=
  QSTASH_NEXT_SIGNING_KEY=

  # Your public URL (QStash webhook target)
  NEXT_PUBLIC_APP_URL=https://procureai.yourdomain.com

  # Resend (email)
  RESEND_API_KEY=re_xxx

  # Dev only — expose localhost to QStash
  # ngrok http 3000 → copy https URL to NEXT_PUBLIC_APP_URL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GIT COMMITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  git commit -m "feat(schema): add expoPushToken to User"
  git commit -m "feat(notifications): Upstash pub/sub + QStash wiring"
  git commit -m "feat(api): /notifications/subscribe SSE endpoint"
  git commit -m "feat(api): /notifications/deliver QStash handler"
  git commit -m "feat(api): /notifications/seen mark-read endpoint"
  git commit -m "feat(web): usePRNotifications hook + toast"
  git commit -m "feat(mobile): Expo push token registration"
  git commit -m "feat(email): sendApprovalEmail via Resend"
```

***

## Why This Stack Combination Is Correct

**Upstash Redis pub/sub** uses HTTP-streaming SSE under the hood — not a persistent TCP socket — which means it works in serverless Next.js, Vercel Edge, and Azure Container Apps without any infra changes.  The `Subscriber` class handles reconnection automatically. [mintlify](https://www.mintlify.com/upstash/redis-js/advanced/pub-sub)

**QStash is not a real-time tool** — it's a durable message queue with HTTP delivery and retries.  It fills the gap pub/sub can't: if the employee's tab is closed, Redis PUBLISH is a no-op and the notification would be lost forever. QStash's 5-second delay + 3 retries guarantees it always reaches *something* (email or push). [upstash](https://upstash.com/docs/qstash/features/delay)

**The `pr:seen:{prId}` key** is the coordination mechanism between the two systems. The Redis pub/sub path sets it; the QStash path checks it. This means you never send a duplicate notification — the employee never gets both a toast *and* an email for the same event.