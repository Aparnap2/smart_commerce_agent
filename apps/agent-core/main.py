from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.chat import router as chat_router
from src.dependencies import lifespan, get_pool
from src.graph import graph
from src.sse import graph_to_sse
from dotenv import load_dotenv
from loguru import logger
import os
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage

load_dotenv()

app = FastAPI(lifespan=lifespan)

logger.add(
    "/tmp/agent.log",
    rotation="10 MB",
    level="DEBUG",
    format="<level>{message}</level>",
    filter=lambda record: "Department lookup" in record["message"] or "dept_id" in record["message"]
)


# CORS Configuration
origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://localhost:8080",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)


class ChatMessage(BaseModel):
    role: str
    content: str


class StreamRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: str
    thread_id: str | None = None


@app.post("/stream")
async def stream_chat(body: StreamRequest):
    lc_messages = []
    for m in body.messages:
        if m.role == "human":
            lc_messages.append(HumanMessage(content=m.content))
        else:
            lc_messages.append(AIMessage(content=m.content))

    from db.client import get_pool
    pool = await get_pool()
    department_id = None
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            'SELECT "departmentId" FROM users WHERE email = $1', body.user_id
        )
        if user:
            department_id = user["departmentId"]

    config = {
        "configurable": {
            "user_id": body.user_id,
            "thread_id": body.thread_id,
            "department_id": department_id,
        }
    }
    logger.info(f"Department lookup: user={body.user_id}, dept_id={department_id}")

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

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        graph_to_sse(stream),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/health")
async def health():
    pool = await get_pool()
    async with pool.acquire() as conn:
        pg_ok = bool(await conn.fetchval("SELECT 1"))
    return {"status": "ok", "service": "agent-core", "version": "1.0.0", "postgres": pg_ok}
