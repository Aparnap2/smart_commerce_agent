import json
import uuid
from typing import Optional
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from loguru import logger
from .db import get_pool

logger.add(
    "/tmp/agent.log",
    rotation="10 MB",
    level="DEBUG",
    format="<level>{message}</level>",
    filter=lambda record: "tool_call" in record["message"].lower() or "dept_id" in record["message"].lower()
)


@tool
async def search_products(
    query: str,
    category: Optional[str] = None,
    brand: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    in_stock_only: bool = True,
    config: RunnableConfig = None,
) -> str:
    """Search for products using keyword search."""

    pool = await get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, name, price, stock, category, brand, "imageUrl", rating
            FROM "Product"
            WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')
              AND ($2::text IS NULL OR category ILIKE $2)
              AND ($3::text IS NULL OR brand ILIKE $3)
              AND ($4::int IS NULL OR price >= $4)
              AND ($5::int IS NULL OR price <= $5)
              AND ($6 = FALSE OR stock > 0)
            ORDER BY name ASC
            LIMIT 6
        """, query, category, brand, min_price, max_price, in_stock_only)

    products = [dict(r) for r in rows]

    return json.dumps({
        "products": products,
        "__ui__": {
            "name": "product-grid",
            "props": {
                "loading": False,
                "products": products,
            }
        }
    })


@tool
async def view_cart(
    config: RunnableConfig = None,
) -> str:
    """View the current user's shopping cart."""

    user_id = (config or {}).get("configurable", {}).get("user_id", "anonymous")
    pool = await get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                ci.quantity,
                p.id AS "productId",
                p.name, p.price, p.stock, p."imageUrl"
            FROM "CartItem" ci
            JOIN "Cart"    c  ON ci."cartId"    = c.id
            JOIN "Product" p  ON ci."productId" = p.id
            WHERE c."userId" = $1
        """, user_id)

    items = [dict(r) for r in rows]
    total = sum(r["price"] * r["quantity"] for r in items)

    return json.dumps({
        "items": items,
        "total": total,
        "__ui__": {
            "name": "cart-canvas",
            "props": {
                "loading": False,
                "items": items,
                "total": total,
            }
        }
    })


@tool
async def add_to_cart(
    product_id: int,
    quantity: int = 1,
    config: RunnableConfig = None,
) -> str:
    """Add a product to the user's cart."""

    user_id = (config or {}).get("configurable", {}).get("user_id", "anonymous")
    pool = await get_pool()

    async with pool.acquire() as conn:
        cart = await conn.fetchrow("""
            INSERT INTO "Cart" ("userId")
            VALUES ($1)
            ON CONFLICT ("userId") DO UPDATE
                SET "updatedAt" = NOW()
            RETURNING id
        """, user_id)

        cart_id = cart["id"]

        product = await conn.fetchrow(
            'SELECT stock FROM "Product" WHERE id = $1',
            product_id
        )

        if not product or product["stock"] < quantity:
            return json.dumps({
                "success": False,
                "error": "Insufficient stock"
            })

        await conn.execute("""
            INSERT INTO "CartItem"
                ("cartId", "productId", quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT ("cartId", "productId") DO UPDATE
                SET quantity = "CartItem".quantity + $3
        """, cart_id, product_id, quantity)

    return json.dumps({
        "success": True,
        "productId": product_id,
        "quantity": quantity,
    })


@tool
async def get_orders(
    limit: int = 5,
    config: RunnableConfig = None,
) -> str:
    """Get the user's recent orders with status and tracking."""

    user_id = (config or {}).get("configurable", {}).get("user_id", "anonymous")
    pool = await get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                id, status, total,
                "createdAt" AS "orderDate",
                "trackingNumber"
            FROM "Order"
            WHERE "userId" = $1
            ORDER BY "createdAt" DESC
            LIMIT $2
        """, user_id, limit)

    orders = [dict(r) for r in rows]

    for o in orders:
        if o.get("orderDate"):
            o["orderDate"] = o["orderDate"].isoformat()

    return json.dumps({
        "orders": orders,
        "__ui__": {
            "name": "order-list",
            "props": {
                "loading": False,
                "orders": orders,
            }
        }
    })


@tool
async def initiate_return(
    order_id: str,
    reason: str,
    config: RunnableConfig = None,
) -> str:
    """Initiate a return request. Checks 7-day eligibility."""

    user_id = (config or {}).get("configurable", {}).get("user_id", "anonymous")
    pool = await get_pool()

    async with pool.acquire() as conn:
        order = await conn.fetchrow("""
            SELECT id, status, total, "createdAt"
            FROM "Order"
            WHERE id = $1 AND "userId" = $2
        """, order_id, user_id)

    if not order:
        return json.dumps({
            "eligible": False,
            "error": "Order not found"
        })

    from datetime import datetime, timezone, timedelta
    order_date = order["createdAt"]
    if order_date.tzinfo is None:
        order_date = order_date.replace(tzinfo=timezone.utc)

    days_since = (datetime.now(timezone.utc) - order_date).days
    eligible = days_since <= 7

    options = []
    if eligible:
        options = [
            {
                "type": "refund",
                "label": "Full Refund",
                "description": "Back to original payment method",
                "amount": order["total"],
            },
            {
                "type": "exchange",
                "label": "Exchange",
                "description": "Swap for another product",
            },
            {
                "type": "store_credit",
                "label": "Store Credit",
                "description": "Use on your next purchase",
                "amount": order["total"] + 500,
            },
        ]

    return json.dumps({
        "eligible": eligible,
        "orderId": order_id,
        "reason": reason,
        "options": options,
        "__ui__": {
            "name": "return-card",
            "props": {
                "loading": False,
                "eligible": eligible,
                "options": options,
                "orderId": order_id,
            }
        }
    })


# ─────────────────────────────────────────────────────────
# B2B PROCUREMENT TOOLS (PRD Part 5)
# ─────────────────────────────────────────────────────────

from datetime import datetime

@tool
async def search_catalog(
    query: str,
    category: Optional[str] = None,
    max_unit_price: Optional[int] = None,
    config: RunnableConfig = None,
) -> str:
    """Search the approved vendor catalog by natural language.
    Returns catalog items with vendor, pricing, lead time.
    category options: HARDWARE, SOFTWARE, SERVICES, OFFICE_SUPPLIES, INFRASTRUCTURE, OTHER"""

    logger.debug(f"search_catalog called with query='{query}', category='{category}'")
    pool = await get_pool()

    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, name, description, sku,
                   "unitPrice", category, vendor,
                   "vendorCode", "leadDays",
                   "inStock", "minOrderQty"
            FROM "CatalogItem"
            WHERE "inStock" = true
              AND ($1::text IS NULL OR category::text = $1::text)
              AND ($2::int IS NULL OR "unitPrice" <= $2)
              AND (
                LOWER(sku) LIKE '%' || LOWER($3::text) || '%'
                OR LOWER("vendorCode") LIKE '%' || LOWER($3::text) || '%'
                OR LOWER(name) LIKE '%' || LOWER($3::text) || '%'
                OR LOWER(description) LIKE '%' || LOWER($3::text) || '%'
                OR LOWER("searchVector") LIKE '%' || LOWER($3::text) || '%'
              )
            ORDER BY
              CASE
                WHEN LOWER(sku) = LOWER($3::text) THEN 1
                WHEN LOWER("vendorCode") = LOWER($3::text) THEN 2
                WHEN LOWER(name) LIKE LOWER($3::text) || '%' THEN 3
                ELSE 4
              END,
              "unitPrice" ASC
            LIMIT 6
        """, category, max_unit_price, query)

    items_ui = []  # Full data for frontend
    items_llm = []  # Minimal data for LLM reasoning

    for r in rows:
        item = dict(r)
        item["unitPrice"] = int(item["unitPrice"])
        item["inStock"] = bool(item["inStock"])
        item["leadDays"] = int(item["leadDays"])
        item["minOrderQty"] = int(item["minOrderQty"])
        item["formattedPrice"] = f"₹{item['unitPrice'] // 100:,}"

        # Full data for UI rendering
        items_ui.append(item)

        # Minimal data for LLM - 80% fewer tokens
        items_llm.append({
            "id": str(item["id"]),
            "name": item["name"],
            "price": item["formattedPrice"],
            "inStock": item["inStock"],
        })

    # LLM sees minimal data, frontend sees full data
    return json.dumps({
        "items": items_llm,
        "found": len(items_llm),
        "__ui__": {
            "name": "catalog-grid",
            "props": {"items": items_ui, "loading": False}
        }
    })


@tool
async def get_budget_status(
    config: RunnableConfig = None,
) -> str:
    """Get the employee's department budget status:
    monthly limit, spent so far, and remaining balance."""

    dept_id = (config or {}).get("configurable", {}).get("department_id")
    if not dept_id:
        return json.dumps({"error": "No department_id in config"})
    pool = await get_pool()

    async with pool.acquire() as conn:
        dept = await conn.fetchrow("""
            SELECT name, "monthlyBudget", "spentThisMonth"
            FROM "Department" WHERE id = $1
        """, dept_id)

    budget = dept["monthlyBudget"]
    spent = dept["spentThisMonth"]
    remaining = budget - spent
    pct = round(spent / budget * 100, 1) if budget else 0

    return json.dumps({
        "department": dept["name"],
        "monthlyBudget": budget,
        "spent": spent,
        "remaining": remaining,
        "percentUsed": pct,
        "__ui__": {
            "name": "budget-gauge",
            "props": {
                "department": dept["name"],
                "monthlyBudget": budget,
                "spent": spent,
                "remaining": remaining,
                "percentUsed": pct,
            }
        }
    })


@tool
async def manage_purchase_request(
    action: str,
    justification: str = "",
    urgency: str = "NORMAL",
    pr_id: str = "",
    catalog_item_id: str = "",
    quantity: int = 1,
    config: RunnableConfig = None,
) -> str:
    """Manage purchase requests.
    action='create' → start a new PR (needs justification)
    action='add_item' → add catalog item to draft PR
    action='view' → get current draft PR with line items
    action='remove_item' → remove a line item from draft PR"""

    logger.debug(f"Full config: {config}")
    logger.debug(f"Config type: {type(config)}")
    cfg = {}
    if config:
        cfg = config.get("configurable", {}) if hasattr(config, 'get') else {}
    employee_email = cfg.get("user_id", "unknown") if cfg else "unknown"
    dept_id = cfg.get("department_id") if cfg else None
    logger.debug(f"manage_purchase_request: action={action}, user_id={employee_email}, dept_id={dept_id}")
    pool = await get_pool()

    async with pool.acquire() as conn:
        user_row = await conn.fetchrow('SELECT id FROM users WHERE email = $1', employee_email)
        if not user_row:
            return json.dumps({"error": f"User {employee_email} not found"})
        employee_id = user_row['id']

        if action == "create":
            urgency_upper = urgency.upper() if urgency else "NORMAL"
            count = await conn.fetchval('SELECT COUNT(*) FROM "PurchaseRequest"')
            pr_number = f"PR-{datetime.now().year}-{int(count)+1:04d}"
            pr_id = str(uuid.uuid4())
            pr = await conn.fetchrow("""
                INSERT INTO "PurchaseRequest"
                  (id, "prNumber","requestorId","departmentId", justification, urgency, "totalAmount", "createdAt", "updatedAt")
                VALUES ($1,$2,$3,$4,$5,$6,0,$7,$7)
                RETURNING id, "prNumber", status
            """, pr_id, pr_number, employee_id, dept_id, justification, urgency_upper, datetime.now())

            await conn.execute("""
                INSERT INTO "PRAuditEntry"
                  (id, "prId", action, actor, details)
                VALUES ($1, $2, 'PR_CREATED', $3, $4)
            """, str(uuid.uuid4()), pr["id"], employee_email, json.dumps({"justification": justification}))

            return json.dumps({
                "prId": pr["id"],
                "prNumber": pr["prNumber"],
                "status": pr["status"],
            })

        if action == "add_item":
            item = await conn.fetchrow('SELECT * FROM "CatalogItem" WHERE id=$1', catalog_item_id)
            if not item:
                return json.dumps({"error": "Catalog item not found"})

            line_total = item["unitPrice"] * quantity

            dept = await conn.fetchrow("""
                SELECT "monthlyBudget","spentThisMonth" FROM "Department" WHERE id=$1
            """, dept_id)
            remaining = dept["monthlyBudget"] - dept["spentThisMonth"]

            if line_total > remaining:
                return json.dumps({
                    "error": "budget_exceeded",
                    "__ui__": {
                        "name": "budget-alert",
                        "props": {
                            "itemName": item["name"],
                            "requested": line_total,
                            "remaining": remaining,
                        }
                    }
                })

            await conn.execute("""
                INSERT INTO "PRLineItem"
                  ("prId","catalogItemId",quantity,"unitPrice","totalPrice")
                VALUES ($1,$2,$3,$4,$5)
                ON CONFLICT ("prId","catalogItemId") DO UPDATE
                  SET quantity = EXCLUDED.quantity, "totalPrice" = EXCLUDED."totalPrice"
            """, pr_id, catalog_item_id, quantity, item["unitPrice"], line_total)

            await conn.execute("""
                UPDATE "PurchaseRequest"
                SET "totalAmount" = (
                    SELECT COALESCE(SUM("totalPrice"),0) FROM "PRLineItem" WHERE "prId"=$1
                )
                WHERE id=$1
            """, pr_id)

            await conn.execute("""
                INSERT INTO "PRAuditEntry"
                  ("prId",action,actor,details)
                VALUES ($1,'ITEM_ADDED',$2,$3)
            """, pr_id, employee_id, json.dumps({"item": item["name"], "qty": quantity, "price": line_total}))

        return json.dumps({"success": True, "itemName": item["name"], "quantity": quantity, "lineTotal": line_total})

    if action == "view":
        async with pool.acquire() as conn:
            pr = await conn.fetchrow("""
                SELECT * FROM "PurchaseRequest"
                WHERE "requestorId"=$1 AND status='DRAFT'
                ORDER BY "createdAt" DESC LIMIT 1
            """, employee_id)

            if not pr:
                return json.dumps({"pr": None, "message": "No draft PR found. Create one first."})

            items = await conn.fetch("""
                SELECT li.*, ci.name, ci.vendor, ci.imageUrl
                FROM "PRLineItem" li
                JOIN "CatalogItem" ci ON ci.id=li."catalogItemId"
                WHERE li."prId"=$1
            """, pr["id"])

        line_items = [dict(i) for i in items]

        return json.dumps({
            "pr": dict(pr),
            "lineItems": line_items,
            "__ui__": {
                "name": "pr-draft",
                "props": {
                    "prNumber": pr["prNumber"],
                    "lineItems": line_items,
                    "total": pr["totalAmount"],
                    "status": pr["status"],
                }
            }
        })

    return json.dumps({"error": f"Unknown action: {action}"})


@tool
async def submit_for_approval(
    pr_id: str,
    config: RunnableConfig = None,
) -> str:
    """Submit a draft purchase request to the department manager for approval."""

    cfg = (config or {}).get("configurable", {})
    employee_id = cfg.get("user_id", "unknown")
    dept_id = cfg.get("department_id")
    thread_id = cfg.get("thread_id", "unknown")
    pool = await get_pool()

    if not dept_id:
        return json.dumps({"error": "No department_id in config"})

    async with pool.acquire() as conn:
        pr = await conn.fetchrow('SELECT * FROM "PurchaseRequest" WHERE id=$1', pr_id)
        if not pr or pr["status"] != "DRAFT":
            return json.dumps({"error": f"PR {pr_id} is not in DRAFT status"})

        dept = await conn.fetchrow('SELECT * FROM "Department" WHERE id=$1', dept_id)

        await conn.execute("""
            INSERT INTO "PRApproval" ("prId","approverEmail",status)
            VALUES ($1,$2,'PENDING')
        """, pr_id, dept["approverEmail"])

        await conn.execute("""
            UPDATE "PurchaseRequest"
            SET status='PENDING_APPROVAL', "submittedAt"=NOW(), "approvalThreadId"=$1
            WHERE id=$2
        """, thread_id, pr_id)

        await conn.execute("""
            INSERT INTO "PRAuditEntry" ("prId",action,actor,details)
            VALUES ($1,'SUBMITTED',$2,$3)
        """, pr_id, employee_id, json.dumps({"approver": dept["approverEmail"]}))

    return json.dumps({
        "success": True,
        "__pr_submitted": True,
        "prNumber": pr["prNumber"],
        "approverEmail": dept["approverEmail"],
        "totalAmount": pr["totalAmount"],
        "__ui__": {
            "name": "pr-submitted",
            "props": {
                "prNumber": pr["prNumber"],
                "approverEmail": dept["approverEmail"],
                "totalAmount": pr["totalAmount"],
            }
        }
    })


@tool
async def get_purchase_requests(
    status_filter: Optional[str] = None,
    limit: int = 5,
    config: RunnableConfig = None,
) -> str:
    """Get the employee's purchase request history.
    Managers can see ALL department PRs."""

    cfg = (config or {}).get("configurable", {})
    employee_email = cfg.get("user_id", "unknown")
    role = cfg.get("role", "EMPLOYEE")
    dept_id = cfg.get("department_id")
    pool = await get_pool()

    if not dept_id:
        return json.dumps({"error": "No department_id in config"})

    async with pool.acquire() as conn:
        user_row = await conn.fetchrow('SELECT id FROM users WHERE email = $1', employee_email)
        if not user_row:
            return json.dumps({"purchaseRequests": [], "__ui__": {"name": "pr-list", "props": {"purchaseRequests": [], "loading": False}}})
        employee_id = user_row['id']

        if role in ("MANAGER", "FINANCE", "ADMIN"):
            rows = await conn.fetch("""
                SELECT pr.id, pr."prNumber", pr.status::text AS status,
                       pr."totalAmount", pr.justification,
                       pr.urgency, pr."createdAt",
                       u.name AS "requestorName",
                       COUNT(li.id) AS "itemCount"
                FROM "PurchaseRequest" pr
                JOIN "User" u ON u.id = pr."requestorId"
                LEFT JOIN "PRLineItem" li ON li."prId" = pr.id
                WHERE pr."departmentId" = $1
                  AND ($2::text IS NULL OR pr.status::text = $2)
                GROUP BY pr.id, u.name
                ORDER BY pr."createdAt" DESC
                LIMIT $3
            """, dept_id, status_filter, limit)
        else:
            rows = await conn.fetch("""
                SELECT pr.id, pr."prNumber", pr.status::text AS status,
                       pr."totalAmount", pr.justification,
                       pr.urgency, pr."createdAt",
                       COUNT(li.id) AS "itemCount"
                FROM "PurchaseRequest" pr
                LEFT JOIN "PRLineItem" li ON li."prId" = pr.id
                WHERE pr."requestorId" = $1
                  AND ($2::text IS NULL OR pr.status::text = $2)
                GROUP BY pr.id
                ORDER BY pr."createdAt" DESC
                LIMIT $3
            """, employee_id, status_filter, limit)

    prs = []
    for r in rows:
        d = dict(r)
        d["createdAt"] = d["createdAt"].isoformat() if d.get("createdAt") else None
        prs.append(d)

    return json.dumps({
        "purchaseRequests": prs,
        "__ui__": {
            "name": "pr-list",
            "props": {"purchaseRequests": prs, "loading": False}
        }
    })


@tool
async def process_approval(
    pr_id: str,
    decision: str,
    comments: str = "",
    config: RunnableConfig = None,
) -> str:
    """Approve or reject a purchase request.
    Only callable by MANAGER or ADMIN role."""

    cfg = (config or {}).get("configurable", {})
    approver_email = cfg.get("user_email", "unknown")
    role = cfg.get("role")
    pool = await get_pool()

    if role not in ("MANAGER", "ADMIN"):
        return json.dumps({"error": "Only MANAGER or ADMIN can approve PRs"})

    if decision not in ("APPROVED", "REJECTED"):
        return json.dumps({"error": "decision must be APPROVED or REJECTED"})

    async with pool.acquire() as conn:
        approval = await conn.fetchrow("""
            SELECT a.id FROM "PRApproval" a
            WHERE a."prId"=$1 AND a."approverEmail"=$2 AND a.status='PENDING'
        """, pr_id, approver_email)

        if not approval:
            return json.dumps({"error": "No pending approval found for this PR"})

        await conn.execute("""
            UPDATE "PRApproval" SET status=$1, comments=$2, "decidedAt"=NOW()
            WHERE id=$3
        """, decision, comments, approval["id"])

        await conn.execute("""
            UPDATE "PurchaseRequest"
            SET status=$1,
                "approvedAt"=CASE WHEN $1='APPROVED' THEN NOW() ELSE NULL END,
                "rejectedAt"=CASE WHEN $1='REJECTED' THEN NOW() ELSE NULL END,
                notes=$2
            WHERE id=$3
        """, decision, comments, pr_id)

        await conn.execute("""
            INSERT INTO "PRAuditEntry" ("prId",action,actor,details)
            VALUES ($1,$2,$3,$4)
        """, pr_id, f"PR_{decision}", approver_email, json.dumps({"comments": comments}))

    return json.dumps({"success": True, "prId": pr_id, "decision": decision, "comments": comments})


@tool
async def raise_dispute(
    pr_id: str,
    reason: str,
    config: RunnableConfig = None,
) -> str:
    """Raise a dispute or cancellation on an approved or ordered purchase request."""

    cfg = (config or {}).get("configurable", {})
    employee_id = cfg.get("user_id", "unknown")
    pool = await get_pool()

    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE "PurchaseRequest" SET status='DISPUTED'
            WHERE id=$1 AND "requestorId"=$2
        """, pr_id, employee_id)

        await conn.execute("""
            INSERT INTO "PRAuditEntry" ("prId",action,actor,details)
            VALUES ($1,'DISPUTED',$2,$3)
        """, pr_id, employee_id, json.dumps({"reason": reason}))

    return json.dumps({
        "success": True,
        "message": "Dispute raised. Finance team notified.",
        "__ui__": {
            "name": "dispute-card",
            "props": {"prId": pr_id, "reason": reason}
        }
    })


ALL_TOOLS = [
    search_catalog,
    get_budget_status,
    manage_purchase_request,
    submit_for_approval,
    get_purchase_requests,
    process_approval,
    raise_dispute,
]
