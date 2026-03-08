from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from auth.jwt import verify_token
import json, uuid

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    thread_id: str | None = None


# Mock responses for E2E testing
MOCK_RESPONSES = {
    "headphone": {
        "text": "I found some great wireless headphones for you!",
        "ui": [{
            "component": "ProductGrid",
            "props": {
                "products": [
                    {"id": "p1", "name": "Sony WF-1000XM5", "price": 7999, "description": "Premium wireless earbuds", "stock": 15},
                    {"id": "p2", "name": "JBL Tune 230NC", "price": 6999, "description": "Noise cancelling earbuds", "stock": 25},
                    {"id": "p3", "name": "Realme Buds Air 3", "price": 4999, "description": "ANC earbuds", "stock": 20},
                    {"id": "p4", "name": "OnePlus Buds Z2", "price": 4999, "description": "Premium bass earbuds", "stock": 18}
                ]
            }
        }]
    },
    "cart": {
        "text": "I've added the Sony WF-1000XM5 to your cart!",
        "ui": [{
            "component": "CartDrawer",
            "props": {
                "cart": {
                    "id": "cart-1",
                    "total": 7999,
                    "items": [{"productId": "p1", "name": "Sony WF-1000XM5", "price": 7999, "quantity": 1}]
                }
            }
        }]
    }
}


@router.post("/agent/chat")
async def agent_chat(body: ChatRequest, authorization: str = Header(default="")):
    token = authorization.replace("Bearer ", "").strip()
    try:
        payload = verify_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    thread_id = body.thread_id or str(uuid.uuid4())
    message_lower = body.message.lower()

    async def event_stream():
        try:
            # Yield thread ID first
            yield f"data: {json.dumps({'type': 'thread_id', 'threadId': thread_id})}\n\n"
            
            # Select mock response based on keywords
            response = None
            for keyword, mock_resp in MOCK_RESPONSES.items():
                if keyword in message_lower:
                    response = mock_resp
                    break
            
            if not response:
                response = {"text": "How can I help you today?", "ui": []}
            
            # Emit UI components
            if response.get("ui"):
                yield f"data: {json.dumps({'type': 'ui_actions', 'actions': response['ui']})}\n\n"
            
            # Emit text response
            if response.get("text"):
                yield f"data: {json.dumps({'type': 'delta', 'content': response['text']})}\n\n"
            
            # Signal completion
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as ex:
            yield f"data: {json.dumps({'type': 'error', 'message': str(ex)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
