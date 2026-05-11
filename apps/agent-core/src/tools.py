import json
import uuid
from datetime import datetime, timezone
from typing import Optional
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from loguru import logger
from .db import get_pool
from .notifications import publish_approval_event, send_slack_notification

# ─────────────────────────────────────────────────────────
# DETERMINISTIC HELPER FUNCTIONS (PRD Part 5 - Features)
# ─────────────────────────────────────────────────────────

# Threshold constants (in paise)
DEFAULT_TAX_RATE = 18  # Default 18% GST

def get_default_tax_rate() -> int:
    """Get default GST tax rate."""
    return DEFAULT_TAX_RATE


def calculate_tax_amount(line_total: int, tax_rate: int) -> int:
    """
    Calculate tax amount from line total and tax rate.
    
    Formula: taxAmount = line_total * tax_rate / 100
    Result is rounded to nearest integer (paise).
    """
    if line_total <= 0:
        return 0
    return round(line_total * tax_rate / 100)


def calculate_total_with_tax(line_total: int, tax_amount: int) -> int:
    """Calculate total with tax added."""
    return line_total + tax_amount


def get_notification_event_type(decision: str) -> str:
    """
    Get notification event type for approval decision.
    
    Returns: PR_APPROVED | PR_REJECTED
    """
    if decision == "APPROVED":
        return "PR_APPROVED"
    elif decision == "REJECTED":
        return "PR_REJECTED"
    else:
        return "PR_UNKNOWN"


def get_notification_event_for_action(action: str) -> str:
    """
    Get notification event type for PR action.
    
    Returns: PR_SUBMITTED | PR_CREATED | etc.
    """
    action_map = {
        "SUBMITTED": "PR_SUBMITTED",
        "PR_CREATED": "PR_CREATED",
        "PR_APPROVED": "PR_APPROVED",
        "PR_REJECTED": "PR_REJECTED",
    }
    return action_map.get(action, f"PR_{action}")


def build_notification_payload(pr_id: str, event_type: str) -> dict:
    """Build notification event payload."""
    return {
        "pr_id": pr_id,
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

logger.add(
    "/tmp/agent.log",
    rotation="10 MB",
    level="DEBUG",
    format="<level>{message}</level>",
    filter=lambda record: "tool_call" in record["message"].lower() or "dept_id" in record["message"].lower()
)


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
    line_item_id: str = "",
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

            # B2B: Vendor compliance check
            if not item.get("vendorApproved", True):
                return json.dumps({
                    "error": "vendor_not_approved",
                    "message": f"Vendor {item['vendor']} is not on the approved vendor list",
                    "__ui__": {"name": "vendor-alert", "props": {"vendor": item["vendor"]}}
                })

            if item.get("msaExpiryDate"):
                msa_expiry = item["msaExpiryDate"]
                if msa_expiry < datetime.now(timezone.utc):
                    return json.dumps({
                        "error": "vendor_msa_expired",
                        "message": f"MSA with vendor {item['vendor']} expired on {msa_expiry.date()}",
                        "__ui__": {"name": "vendor-alert", "props": {"vendor": item["vendor"], "expiry": str(msa_expiry.date())}}
                    })

            line_total = item["unitPrice"] * quantity
            
            # ─── TAX/GST CALCULATION (PRD Part 5 - Feature 2) ───
            tax_rate = get_default_tax_rate()  # Default 18% GST
            tax_amount = calculate_tax_amount(line_total, tax_rate)
            total_with_tax = calculate_total_with_tax(line_total, tax_amount)

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
                  (id,"prId","catalogItemId",quantity,"unitPrice","totalPrice","taxRate","taxAmount","totalWithTax")
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT ("prId","catalogItemId") DO UPDATE
                  SET quantity = EXCLUDED.quantity, "totalPrice" = EXCLUDED."totalPrice",
                      "taxRate" = EXCLUDED."taxRate", "taxAmount" = EXCLUDED."taxAmount", "totalWithTax" = EXCLUDED."totalWithTax"
            """, str(uuid.uuid4()), pr_id, catalog_item_id, quantity, item["unitPrice"], line_total, tax_rate, tax_amount, total_with_tax)

            await conn.execute("""
                UPDATE "PurchaseRequest"
                SET "totalAmount" = (
                    SELECT COALESCE(SUM("totalPrice"),0) FROM "PRLineItem" WHERE "prId"=$1
                )
                WHERE id=$1
            """, pr_id)

            await conn.execute("""
                INSERT INTO "PRAuditEntry"
                  (id,"prId",action,actor,details)
                VALUES ($1,$2,'ITEM_ADDED',$3,$4)
            """, str(uuid.uuid4()), pr_id, employee_id, json.dumps({
                "item": item["name"],
                "qty": quantity,
                "price": line_total,
                "taxRate": tax_rate,
                "taxAmount": tax_amount,
                "totalWithTax": total_with_tax
            }))

            # NOTE: Budget is NOT debited here - only debited on PR approval
            # This prevents budget from being locked when items are added to draft

            return json.dumps({
                "success": True,
                "itemName": item["name"],
                "quantity": quantity,
                "lineTotal": line_total,
                "taxRate": tax_rate,
                "taxAmount": tax_amount,
                "totalWithTax": total_with_tax
            })

        if action == "view":
            pr = await conn.fetchrow("""
                SELECT * FROM "PurchaseRequest"
                WHERE "requestorId"=$1 AND status='DRAFT'
                ORDER BY "createdAt" DESC LIMIT 1
            """, employee_id)

            if not pr:
                return json.dumps({"pr": None, "message": "No draft PR found. Create one first."})

            items = await conn.fetch("""
                SELECT li.*, ci.name, ci.vendor, ci."imageUrl"
                FROM "PRLineItem" li
                JOIN "CatalogItem" ci ON ci.id=li."catalogItemId"
                WHERE li."prId"=$1
            """, pr["id"])

            line_items = [dict(i) for i in items]

            # Convert dates to ISO format for JSON serialization
            pr_dict = dict(pr)
            for key, value in pr_dict.items():
                if hasattr(value, 'isoformat'):
                    pr_dict[key] = value.isoformat()
            
            # Convert line item dates as well
            for item in line_items:
                for key, value in item.items():
                    if hasattr(value, 'isoformat'):
                        item[key] = value.isoformat()

            # Calculate totals including tax
            subtotal = sum(i.get("totalPrice", 0) for i in line_items)
            total_tax = sum(i.get("taxAmount", 0) for i in line_items)
            total_with_tax = sum(i.get("totalWithTax", 0) for i in line_items)

            return json.dumps({
                "pr": pr_dict,
                "lineItems": line_items,
                "subtotal": subtotal,
                "totalTax": total_tax,
                "totalWithTax": total_with_tax,
                "__ui__": {
                    "name": "pr-draft",
                    "props": {
                        "prNumber": pr["prNumber"],
                        "lineItems": line_items,
                        "subtotal": subtotal,
                        "totalTax": total_tax,
                        "totalWithTax": total_with_tax,
                        "status": pr["status"],
                    }
                }
            })

        if action == "remove_item":
            pr = await conn.fetchrow("""
                SELECT * FROM "PurchaseRequest"
                WHERE "requestorId"=$1 AND status='DRAFT'
                ORDER BY "createdAt" DESC LIMIT 1
            """, employee_id)

            if not pr:
                return json.dumps({"error": "No draft PR found"})

            line_item = await conn.fetchrow("""
                SELECT li.*, ci."unitPrice", ci."vendor"
                FROM "PRLineItem" li
                JOIN "CatalogItem" ci ON ci.id=li."catalogItemId"
                WHERE li.id=$1 AND li."prId"=$2
            """, line_item_id, pr["id"])

            if not line_item:
                return json.dumps({"error": "Line item not found"})

            refund_amount = line_item["totalPrice"]

            async with conn.transaction():
                dept = await conn.fetchrow("""
                    SELECT "monthlyBudget","spentThisMonth" FROM "Department" WHERE id=$1 FOR UPDATE
                """, dept_id)

                await conn.execute("""
                    UPDATE "Department" SET "spentThisMonth" = "spentThisMonth" - $1 WHERE id=$2
                """, refund_amount, dept_id)

                await conn.execute('DELETE FROM "PRLineItem" WHERE id=$1', line_item_id)

                await conn.execute("""
                    UPDATE "PurchaseRequest"
                    SET "totalAmount" = (
                        SELECT COALESCE(SUM("totalPrice"),0) FROM "PRLineItem" WHERE "prId"=$1
                    )
                    WHERE id=$1
                """, pr["id"])

            return json.dumps({"success": True, "refundAmount": refund_amount})

        return json.dumps({"error": f"Unknown action: {action}"})


@tool
async def submit_for_approval(
    pr_id: str,
    config: RunnableConfig = None,
) -> str:
    """Submit a draft purchase request to the department manager for approval.
    
    Threshold-based routing:
    - ≤ ₹50,000 → Manager (auto-approve possible)
    - ₹50,001 - ₹2,00,000 → Department Head
    - > ₹2,00,000 → Finance + Director
    """

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
        
        # ─── THRESHOLD-BASED APPROVER ROUTING ───
        total_amount = pr["totalAmount"] or 0
        approver_type = determine_approver_by_amount(total_amount)
        
        # Get approver email based on threshold
        if approver_type == "MANAGER":
            approver_email = dept["approverEmail"]
        elif approver_type == "DEPT_HEAD":
            # Use department head email from dept (if exists)
            approver_email = dept.get("headEmail", dept["approverEmail"])
        else:  # FINANCE_DIRECTOR
            # For high-value PRs, route to finance
            approver_email = dept.get("financeEmail", dept["approverEmail"])

        await conn.execute("""
            INSERT INTO "PRApproval" ("prId","approverEmail",status)
            VALUES ($1,$2,'PENDING')
        """, pr_id, approver_email)

        await conn.execute("""
            UPDATE "PurchaseRequest"
            SET status='PENDING_APPROVAL', "submittedAt"=NOW(), "approvalThreadId"=$1
            WHERE id=$2
        """, thread_id, pr_id)

        await conn.execute("""
            INSERT INTO "PRAuditEntry" (id,"prId",action,actor,details)
            VALUES ($1,$2,'SUBMITTED',$3,$4)
        """, str(uuid.uuid4()), pr_id, employee_id, json.dumps({
            "approver": approver_email,
            "approverType": approver_type,
            "totalAmount": total_amount
        }))

    # Build notification event
    notification_event = build_notification_payload(pr_id, get_notification_event_for_action("SUBMITTED"))

    return json.dumps({
        "success": True,
        "__pr_submitted": True,
        "prNumber": pr["prNumber"],
        "approverEmail": approver_email,
        "approverType": approver_type,
        "totalAmount": pr["totalAmount"],
        "__notification_event": notification_event,
        "__ui__": {
            "name": "pr-submitted",
            "props": {
                "prNumber": pr["prNumber"],
                "approverEmail": approver_email,
                "approverType": approver_type,
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
                JOIN users u ON u.id = pr."requestorId"
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
    Only callable by MANAGER or ADMIN role.
    
    Emits notification events:
    - APPROVED → PR_APPROVED
    - REJECTED → PR_REJECTED
    """

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
            SET status=$1::"PRStatus",
                "approvedAt"=CASE WHEN $1='APPROVED' THEN NOW() ELSE NULL END,
                "rejectedAt"=CASE WHEN $1='REJECTED' THEN NOW() ELSE NULL END,
                notes=$2
            WHERE id=$3
        """, decision, comments, pr_id)

        await conn.execute("""
            INSERT INTO "PRAuditEntry" (id,"prId",action,actor,details)
            VALUES ($1,$2,$3,$4,$5)
        """, str(uuid.uuid4()), pr_id, f"PR_{decision}", approver_email, json.dumps({"comments": comments}))

        pr = await conn.fetchrow('SELECT "totalAmount", "departmentId" FROM "PurchaseRequest" WHERE id=$1', pr_id)
        if pr:
            total = pr["totalAmount"]
            dept_id = pr["departmentId"]
            if decision == "APPROVED":
                await conn.execute("""
                    UPDATE "Department" SET "spentThisMonth" = "spentThisMonth" + $1 WHERE id=$2
                """, total, dept_id)
            # Note: No rollback needed on REJECTED - budget was never debited on add_item

    # Build notification event for deterministic triggers
    notification_event = build_notification_payload(pr_id, get_notification_event_type(decision))
    
    # Publish notification event to Redis for real-time updates
    try:
        await publish_approval_event(pr_id, decision, approver_email, comments)
    except Exception as e:
        logger.error(f"Failed to publish notification event: {e}")

    # Send Slack notification
    try:
        pr = await conn.fetchrow('SELECT "prNumber", "requestorId" FROM "PurchaseRequest" WHERE id=$1', pr_id)
        if pr:
            await send_slack_notification(
                channel="procurement-approvals",
                pr_number=pr["prNumber"],
                decision=decision,
                requestor="Employee",
                total_amount=total,
                approver=approver_email
            )
    except Exception as e:
        logger.error(f"Failed to send Slack notification: {e}")

    return json.dumps({
        "success": True,
        "prId": pr_id,
        "decision": decision,
        "comments": comments,
        "__notification_event": notification_event,
    })


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
            INSERT INTO "PRAuditEntry" (id,"prId",action,actor,details)
            VALUES ($1,$2,'DISPUTED',$3,$4)
        """, str(uuid.uuid4()), pr_id, employee_id, json.dumps({"reason": reason}))

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
