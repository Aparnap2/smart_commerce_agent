import pytest, os, asyncio
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set required env vars before any import
os.environ.setdefault("JWT_SECRET", "test-secret-change-in-prod")
os.environ.setdefault(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/smart_commerce"
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("COMMERCE_API_URL", "http://localhost:3001")
os.environ.setdefault("OPENAI_BASE_URL", "http://localhost:11434/v1")  # stub
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("OPENAI_MODEL", "gpt-oss-120b")

# Required for pytest-asyncio
pytest_plugins = ["pytest_asyncio"]