import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from .db import get_pool, close_pool
from .graph import graph
from .sse import graph_to_sse

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    yield
    await close_pool()


app = FastAPI(
    title="TechTrend Python Agent",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class StreamRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: str
    thread_id: str | None = None


@app.get("/ok")
async def health():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("SELECT 1")
    return {"status": "ok", "agent": "python"}


@app.get("/health")
async def health_detailed():
    pool = await get_pool()
    async with pool.acquire() as conn:
        pg_ok = bool(await conn.fetchval("SELECT 1"))
    return {
        "status": "ok",
        "postgres": pg_ok,
        "agent": "python-langgraph",
    }


@app.post("/stream")
async def stream_chat(body: StreamRequest):
    from langchain_core.messages import HumanMessage, AIMessage

    lc_messages = []
    for m in body.messages:
        if m.role == "human":
            lc_messages.append(HumanMessage(content=m.content))
        else:
            lc_messages.append(AIMessage(content=m.content))

    config = {
        "configurable": {
            "user_id": body.user_id,
            "thread_id": body.thread_id,
        }
    }

    stream = graph.astream(
        {
            "messages": lc_messages,
            "user_id": body.user_id,
            "step_count": 0,
        },
        config=config,
        stream_mode=["messages", "updates"],
        version="v2",
    )

    return StreamingResponse(
        graph_to_sse(stream),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/chat")
async def chat_sync(body: StreamRequest):
    from langchain_core.messages import HumanMessage

    lc_messages = [
        HumanMessage(content=m.content)
        for m in body.messages
        if m.role == "human"
    ][-1:]

    config = {
        "configurable": {"user_id": body.user_id}
    }

    result = await graph.ainvoke(
        {"messages": lc_messages, "user_id": body.user_id},
        config=config,
    )

    last = result["messages"][-1]
    return {
        "content": last.content,
        "type": last.type,
    }
