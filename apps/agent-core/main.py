from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.chat import router as chat_router
from contextlib import asynccontextmanager
from db.client import close_pool
import os


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown
    await close_pool()


app = FastAPI(
    title="Smart Commerce Agent Core",
    version="1.0.0",
    description="AI-powered commerce assistant with LangGraph agents",
    lifespan=lifespan,
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent-core", "version": "1.0.0"}
