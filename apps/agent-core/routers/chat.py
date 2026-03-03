from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from agents.orchestrator import create_orchestrator
from auth.jwt import verify_token
import json, uuid

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    thread_id: str | None = None


@router.post("/agent/chat")
async def agent_chat(body: ChatRequest, authorization: str = Header(default="")):
    token = authorization.replace("Bearer ", "").strip()
    try:
        payload = verify_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    thread_id = body.thread_id or str(uuid.uuid4())
    graph = await create_orchestrator()

    async def event_stream():
        try:
            async for event in graph.astream_events(
                {
                    "messages": [{"role": "user", "content": body.message}],
                    "userId": payload.userId,
                    "role": payload.role,
                    "token": token,
                },
                config={"configurable": {"thread_id": thread_id}},
                version="v2",
            ):
                kind = event.get("event", "")

                if kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    text = getattr(chunk, "content", "") if chunk else ""
                    if text:
                        yield f"data: {json.dumps({'type': 'delta', 'content': text})}\n\n"

                elif kind == "on_tool_start":
                    yield f"data: {json.dumps({'type': 'tool_call', 'tool': event.get('name', '')})}\n\n"

                elif kind == "on_chain_end" and event.get("name") == "LangGraph":
                    output = event.get("data", {}).get("output", {}) or {}
                    ui = output.get("uiComponents", [])
                    if ui:
                        yield f"data: {json.dumps({'type': 'ui_actions', 'actions': ui})}\n\n"
                    yield f"data: {json.dumps({'type': 'thread_id', 'threadId': thread_id})}\n\n"
                    yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as ex:
            yield f"data: {json.dumps({'type': 'error', 'message': str(ex)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
