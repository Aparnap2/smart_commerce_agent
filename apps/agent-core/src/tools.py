import json
from typing import Optional
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from .db import get_pool
from .embeddings import embed_query


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
    """Search for products using hybrid semantic + keyword search."""

    pool = await get_pool()
    embedding = await embed_query(query)
    embedding_str = f"[{','.join(map(str, embedding))}]"

    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT
                id, name, price, stock, category, brand,
                "imageUrl", rating,
                (embedding <=> $1::vector) AS semantic_dist
            FROM "Product"
            WHERE
                ($2::text IS NULL OR category ILIKE $2)
                AND ($3::text IS NULL OR brand ILIKE $3)
                AND ($4::int  IS NULL OR price >= $4)
                AND ($5::int  IS NULL OR price <= $5)
                AND ($6 = FALSE OR stock > 0)
            ORDER BY embedding <=> $1::vector
            LIMIT 6
        """,
            embedding_str, category, brand,
            min_price, max_price, in_stock_only,
        )

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


ALL_TOOLS = [
    search_products,
    view_cart,
    add_to_cart,
    get_orders,
    initiate_return,
]
