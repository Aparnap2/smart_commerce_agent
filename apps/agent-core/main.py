from fastapi import FastAPI
from routers.chat import router as chat_router
from contextlib import asynccontextmanager
from db.client import close_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_pool()


app = FastAPI(title="Smart Commerce Agent Core", version="1.0.0", lifespan=lifespan)

app.include_router(chat_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent-core", "version": "1.0.0"}
