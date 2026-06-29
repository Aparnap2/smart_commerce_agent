"""
Chat Router - POST /agent/chat (SSE streaming)
Based on AGENT_CORE_RUNNING.md documentation
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import asyncio

from src.graph import graph
from src.dependencies import get_llm
from loguru import logger

router = APIRouter(prefix="/agent", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class StreamRequest(BaseModel):
    messages: List[ChatMessage]
    user_id: str
    user_role: Optional[str] = None
    thread_id: Optional[str] = None
    configurable: Optional[dict] = None


@router.post("/chat")
async def chat(request: Request, body: StreamRequest):
    """
    Chat with agent - returns SSE stream
    
    Auth: JWT required (validated by middleware)
    Returns: text/event-stream with:
    - messages/partial: AI text chunks (data: [{content, type}])
    - custom: GenUI __ui__ payloads (data: {type: "ui", name, props})
    - thread_id: conversation ID
    - end: stream complete
    - error: error message
    """
    # Check auth header (allow test mode without auth)
    test_mode = request.headers.get("x-test-mode") == "true" or request.headers.get("x-user-id") == "test-user-id"
    if not test_mode:
        auth = request.headers.get("authorization")
        if not auth:
            raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        # Convert messages to LangChain format
        from langchain_core.messages import HumanMessage, AIMessage
        
        langchain_messages = []
        for msg in body.messages:
            if msg.role == "user":
                langchain_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                langchain_messages.append(AIMessage(content=msg.content))
        
        # Build initial state — user_role can come from body.user_role
        # or configurable.role (in order of precedence)
        effective_role = (
            body.user_role
            or (body.configurable.get("role") if body.configurable else None)
            or "EMPLOYEE"
        )
        initial_state = {
            "messages": langchain_messages,
            "user_id": body.user_id,
            "user_role": effective_role,
            "step_count": 0,
        }
        
        # Stream the graph execution
        async def event_generator():
            try:
                async for event in graph.astream(initial_state, stream_mode="values"):
                    # Check for messages
                    if "messages" in event:
                        last_msg = event["messages"][-1]
                        if hasattr(last_msg, "content") and last_msg.content:
                            raw_content = last_msg.content
                            ui_payload = None
                            display_content = None

                            # Parse structured JSON content that embeds
                            # __ui__ alongside the text content.
                            #
                            # This handles TWO paths:
                            #   1. Real LLM: ToolNode returns ToolMessage whose
                            #      content is JSON with __ui__ + content fields
                            #   2. MockLLM/any provider: AIMessage whose content
                            #      is JSON wrapping __ui__ + native text
                            try:
                                parsed = json.loads(raw_content)
                                if isinstance(parsed, dict):
                                    # Pop __ui__ so it doesn't leak to text
                                    ui_payload = parsed.pop("__ui__", None)
                                    # Use clean content field if available
                                    display_content = parsed.get("content", "")
                            except (json.JSONDecodeError, TypeError):
                                # Not JSON — use as plain text
                                pass

                            # Fall back to raw content if no cleaner version
                            if display_content is None:
                                display_content = raw_content

                            # Canonical SSE format (src/sse.py spec)
                            if display_content:
                                yield {
                                    "event": "messages/partial",
                                    "data": json.dumps(
                                        [{"content": display_content, "type": "ai"}]
                                    ),
                                }
                                # Backward-compatible delta (legacy chat pages)
                                yield {
                                    "event": "delta",
                                    "data": json.dumps({"content": display_content}),
                                }

                            # Emit UI payload if found in message content
                            if ui_payload:
                                yield {
                                    "event": "custom",
                                    "data": json.dumps({"type": "ui", **ui_payload}),
                                }
                                # Backward-compatible ui_actions
                                yield {
                                    "event": "ui_actions",
                                    "data": json.dumps({"actions": [ui_payload]}),
                                }

                    # Check for UI actions in last_tool_result (backup path)
                    if "last_tool_result" in event and event["last_tool_result"]:
                        result = event["last_tool_result"]
                        if "__ui__" in result:
                            ui = result["__ui__"]
                            # Canonical SSE format
                            yield {
                                "event": "custom",
                                "data": json.dumps({"type": "ui", **ui}),
                            }
                            # Backward-compatible ui_actions (legacy chat pages)
                            yield {
                                "event": "ui_actions",
                                "data": json.dumps({"actions": [ui]}),
                            }
                    
                    # Check for pending PR (approval flow)
                    if "pending_pr_id" in event and event["pending_pr_id"]:
                        yield {"event": "thread_id", "data": json.dumps({"threadId": event.get("pending_pr_number", "")})}
                
                # Canonical end event
                yield {"event": "end", "data": json.dumps({})}
                # Backward-compatible complete event
                yield {"event": "complete", "data": json.dumps({})}
                
            except Exception as e:
                logger.error(f"Chat error: {e}")
                yield {"event": "error", "data": json.dumps({"message": str(e)})}
        
        return EventSourceResponse(event_generator())
        
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def stream(request: Request, body: StreamRequest):
    """Alternative streaming endpoint - same as /chat"""
    return await chat(request, body)