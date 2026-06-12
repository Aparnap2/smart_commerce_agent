import pytest, os, asyncio
import sys
import asyncpg

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set required env vars before any import
os.environ.setdefault("JWT_SECRET", "test-secret-change-in-prod")
os.environ.setdefault(
    "DATABASE_URL", "postgresql://supabase_admin:postgres@localhost:5433/postgres"
)
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("COMMERCE_API_URL", "http://localhost:3001")
os.environ.setdefault("OPENAI_BASE_URL", "http://localhost:11434/v1")  # stub
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("OPENAI_MODEL", "gpt-oss-120b")
# LLM_PROVIDER: read from env (cohere, openrouter, etc.) — no mock.
# Tests use the real LLM provider. Set in .env or export before running.
# If unset, defaults to "cohere" via create_llm() in src/llm_config.py.

# Required for pytest-asyncio
pytest_plugins = ["pytest_asyncio"]


@pytest.fixture(scope="function")
def event_loop():
    """Create event loop for async tests."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


_test_conn = None


@pytest.fixture(scope="function")
async def test_db_pool():
    """Each test gets a fresh direct connection with a transaction that rolls back.
    No global pool — avoids cross-event-loop contamination.
    """
    DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://supabase_admin:postgres@localhost:5433/postgres")
    conn = await asyncpg.connect(DATABASE_URL, command_timeout=60)
    tx = conn.transaction()
    await tx.start()
    try:
        yield conn
    finally:
        await tx.rollback()
        await conn.close()


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


@pytest.fixture(autouse=True)
def real_llm():
    """Initialize the real LLM provider (from env) for ALL tests.

    Reads LLM_PROVIDER and provider-specific env vars (COHERE_*, etc.)
    from the environment. Falls back to create_llm() default (cohere).

    Tests that specifically need MockLLM behavior should override this
    fixture or set dependencies._llm directly.
    """
    from src import dependencies
    from src.llm_config import create_llm

    # Force creation — don't reuse stale singleton
    dependencies._llm = create_llm()
    yield
    dependencies._llm = None


@pytest.fixture(autouse=True)
def salesforce_client():
    """Initialize the Salesforce client singleton before each test function.
    
    Support tools now use the DI singleton (get_salesforce_client()) instead of
    creating a fresh MockSalesforceClient. This fixture ensures the singleton
    is available for tests that exercise support tools.
    """
    from src.dependencies import init_salesforce_client, shutdown_salesforce_client
    init_salesforce_client()
    yield
    shutdown_salesforce_client()
