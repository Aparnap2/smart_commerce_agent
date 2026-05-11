import pytest, os, asyncio
import sys
import asyncpg

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set required env vars before any import
os.environ.setdefault("JWT_SECRET", "test-secret-change-in-prod")
os.environ.setdefault(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/techtrend"
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("COMMERCE_API_URL", "http://localhost:3001")
os.environ.setdefault("OPENAI_BASE_URL", "http://localhost:11434/v1")  # stub
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("OPENAI_MODEL", "gpt-oss-120b")

# Required for pytest-asyncio
pytest_plugins = ["pytest_asyncio"]


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


_test_pool = None


@pytest.fixture(scope="session")
async def test_db_pool(event_loop):
    """Create async connection pool for tests using real Docker DB."""
    global _test_pool
    if _test_pool is None:
        DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/techtrend")

        _test_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )

        # Initialize dependencies pool so tools.py can use it
        from src import dependencies
        dependencies._db_pool = _test_pool

    return _test_pool


@pytest.fixture
def tool_config():
    """Default tool config for tests."""
    return {
        "configurable": {
            "user_id": "admin@techtrend.com",
            "department_id": "dept-eng-001",
            "role": "EMPLOYEE",
            "thread_id": "test-thread",
        }
    }