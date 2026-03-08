"""
Mock GraphQL Server for E2E Testing
Returns sample data for shopping agent queries
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI()

# Sample product data
PRODUCTS = [
    {"id": "p1", "name": "Sony WF-1000XM5", "price": 7999, "stock": 15, "description": "Premium wireless earbuds"},
    {"id": "p2", "name": "JBL Tune 230NC", "price": 6999, "stock": 25, "description": "Noise cancelling earbuds"},
    {"id": "p3", "name": "Boat Airdopes 141", "price": 1299, "stock": 50, "description": "Budget wireless earbuds"},
    {"id": "p4", "name": "Noise Buds VS104", "price": 1499, "stock": 30, "description": "Sports earbuds"},
    {"id": "p5", "name": "Realme Buds Air 3", "price": 4999, "stock": 20, "description": "ANC earbuds"},
    {"id": "p6", "name": "OnePlus Buds Z2", "price": 4999, "stock": 18, "description": "Premium bass earbuds"},
]

# Sample cart data
CART = {
    "id": "cart-1",
    "total": 0,
    "discount": 0,
    "couponCode": None,
    "items": []
}

# Sample orders
ORDERS = []

@app.post("/graphql")
async def graphql_handler(request: Request):
    body = await request.json()
    query = body.get("query", "")
    variables = body.get("variables", {})
    
    # Handle userContext query
    if "userContext" in query:
        return JSONResponse({
            "data": {
                "userContext": {
                    "cart": CART,
                    "recentOrders": ORDERS,
                    "pendingNotifications": []
                }
            }
        })
    
    # Handle products query
    if "products" in query and "items" in query:
        return JSONResponse({
            "data": {
                "products": {
                    "items": PRODUCTS[:5]
                }
            }
        })
    
    # Handle hybridSearch query
    if "hybridSearch" in query or "hybridsearch" in query.lower():
        # Filter products based on query
        search_term = variables.get("q", "").lower() if variables else ""
        results = [p for p in PRODUCTS if search_term in p["name"].lower() or search_term in p["description"].lower()]
        if not results:
            results = PRODUCTS[:6]  # Return all if no match
        return JSONResponse({
            "data": {
                "hybridSearch": {
                    "results": results
                }
            }
        })
    
    # Handle addToCart mutation
    if "addToCart" in query:
        product_id = variables.get("productId", "") if variables else ""
        quantity = variables.get("quantity", 1) if variables else 1
        product = next((p for p in PRODUCTS if p["id"] == product_id), None)
        
        if product:
            existing = next((item for item in CART["items"] if item["productId"] == product_id), None)
            if existing:
                existing["quantity"] = quantity
            else:
                CART["items"].append({
                    "id": f"item-{len(CART['items'])+1}",
                    "productId": product_id,
                    "quantity": quantity,
                    "priceAt": product["price"],
                    "priceChanged": False,
                    "product": product
                })
            CART["total"] = sum(item["quantity"] * item["priceAt"] for item in CART["items"])
        
        return JSONResponse({
            "data": {
                "addToCart": {
                    "cart": CART
                }
            }
        })
    
    # Handle createOrder mutation
    if "createOrder" in query:
        order = {
            "id": f"order-{len(ORDERS)+1}",
            "status": "PENDING",
            "total": CART["total"],
            "createdAt": "2026-03-07T10:00:00Z",
            "items": CART["items"].copy()
        }
        ORDERS.append(order)
        CART["items"] = []
        CART["total"] = 0
        
        return JSONResponse({
            "data": {
                "createOrder": order
            }
        })
    
    # Handle cancelOrder mutation
    if "cancelOrder" in query:
        order_id = variables.get("orderId", "") if variables else ""
        for order in ORDERS:
            if order["id"] == order_id:
                order["status"] = "CANCELLED"
                return JSONResponse({
                    "data": {
                        "cancelOrder": order
                    }
                })
        
        return JSONResponse({
            "errors": [{"message": "Order not found"}]
        })
    
    # Default empty response
    return JSONResponse({"data": {}})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3001)
