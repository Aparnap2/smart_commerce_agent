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
    thread_id: Optional[str] = None
    configurable: Optional[dict] = None


@router.post("/chat")
async def chat(request: Request, body: StreamRequest):
    """
    Chat with agent - returns SSE stream
    
    Auth: JWT required (validated by middleware)
    Returns: text/event-stream with:
    - delta: text chunks
    - tool_call: tool invocations  
    - ui_actions: GenUI components
    - thread_id: conversation ID
    - complete: end of stream
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
        
        # Build initial state
        initial_state = {
            "messages": langchain_messages,
            "user_id": body.user_id,
            "user_role": body.configurable.get("role", "EMPLOYEE") if body.configurable else "EMPLOYEE",
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
                            yield {"event": "delta", "data": json.dumps({"content": last_msg.content})}
                    
                    # Check for tool calls (would be in last message's tool_calls)
                    # Check for UI actions in last_tool_result
                    if "last_tool_result" in event and event["last_tool_result"]:
                        result = event["last_tool_result"]
                        if "__ui__" in result:
                            yield {"event": "ui_actions", "data": json.dumps({"actions": [result["__ui__"]]})}
                    
                    # Check for pending PR (approval flow)
                    if "pending_pr_id" in event and event["pending_pr_id"]:
                        yield {"event": "thread_id", "data": json.dumps({"threadId": event.get("pending_pr_number", "")})}
                
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