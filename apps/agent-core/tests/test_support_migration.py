"""Tests for SupportPilot schema migration 006 — additive support tables.

TDD-first: these tests verify the schema created by
migrations/006_add_support_tables.sql. The migration SQL is read from
file and applied within each test's transaction (rolled back by the
``test_db_pool`` fixture from conftest.py).

Each test follows the RED (no migration applied) → GREEN (migration applied)
cycle within a self-contained transaction.
"""
import pytest
from pathlib import Path

MIGRATION_SQL_PATH = (
    Path(__file__).parent.parent / "migrations" / "006_add_support_tables.sql"
)

EXPECTED_TABLES = [
    "SupportConversation",
    "CaseReference",
    "EscalationRequest",
    "KnowledgeArticle",
    "SlaPolicy",
]

# ——— Helpers —————————————————————————————————————————————————


async def _check_table_exists(conn, table_name: str) -> bool:
    """Return True if *table_name* exists in the public schema."""
    row = await conn.fetchrow(
        """SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = $1""",
        table_name,
    )
    return row is not None


async def _get_column(conn, table: str, column: str):
    """Return column metadata row or None."""
    return await conn.fetchrow(
        """SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           AND column_name = $2""",
        table,
        column,
    )


async def _check_pk(conn, table: str) -> bool:
    """Return True if *table* has a PRIMARY KEY constraint."""
    row = await conn.fetchrow(
        """SELECT 1 FROM information_schema.table_constraints
           WHERE table_schema = 'public' AND table_name = $1
           AND constraint_type = 'PRIMARY KEY'""",
        table,
    )
    return row is not None


# ——— Fixtures ———————————————————————————————————————————————


@pytest.fixture(scope="module")
def migration_sql():
    """Read migration SQL once per module."""
    assert MIGRATION_SQL_PATH.exists(), (
        f"Migration file not found: {MIGRATION_SQL_PATH}"
    )
    return MIGRATION_SQL_PATH.read_text()


# ============================================================
# 1. Table Existence
# ============================================================


@pytest.mark.asyncio
async def test_tables_exist(test_db_pool, migration_sql):
    """All 5 support tables exist after applying migration 006."""
    conn = test_db_pool
    await conn.execute(migration_sql)

    for table_name in EXPECTED_TABLES:
        assert await _check_table_exists(conn, table_name), (
            f"Table \"{table_name}\" was not created by migration 006"
        )


# ============================================================
# 2. Column Schema — SupportConversation
# ============================================================


@pytest.mark.asyncio
async def test_support_conversation_schema(test_db_pool, migration_sql):
    """SupportConversation id UUID PK, status TEXT DEFAULT 'open',
    timestamptz columns, user_id FK to users(id)."""
    conn = test_db_pool
    await conn.execute(migration_sql)

    # id: UUID PK with gen_random_uuid default
    col = await _get_column(conn, "SupportConversation", "id")
    assert col is not None, "Column SupportConversation.id missing"
    assert col["data_type"] == "uuid", (
        f"Expected uuid, got {col['data_type']}"
    )
    assert col["is_nullable"] == "NO", "PK id must be NOT NULL"
    assert col["column_default"] is not None and "gen_random_uuid" in col["column_default"], (
        "Expected gen_random_uuid() default"
    )

    # status: TEXT NOT NULL DEFAULT 'open'
    col = await _get_column(conn, "SupportConversation", "status")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "NO"
    assert col["column_default"] is not None and "open" in col["column_default"]

    # title: nullable TEXT
    col = await _get_column(conn, "SupportConversation", "title")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "YES"

    # user_id: nullable TEXT (FK → users.id is TEXT)
    col = await _get_column(conn, "SupportConversation", "user_id")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "YES"

    # salesforce_case_id: nullable TEXT
    col = await _get_column(conn, "SupportConversation", "salesforce_case_id")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "YES"

    # created_at + updated_at: TIMESTAMPTZ NOT NULL DEFAULT now()
    for c in ("created_at", "updated_at"):
        col = await _get_column(conn, "SupportConversation", c)
        assert col is not None, f"Column {c} missing"
        assert col["data_type"] == "timestamp with time zone", (
            f"Expected timestamptz, got {col['data_type']}"
        )
        assert col["is_nullable"] == "NO"

    # Primary key
    assert await _check_pk(conn, "SupportConversation"), (
        "SupportConversation missing PRIMARY KEY"
    )


# ============================================================
# 3. Column Schema — CaseReference
# ============================================================


@pytest.mark.asyncio
async def test_case_reference_schema(test_db_pool, migration_sql):
    """CaseReference id UUID PK, salesforce_case_id NOT NULL,
    conversation_id FK to SupportConversation, last_synced_at TIMESTAMPTZ."""
    conn = test_db_pool
    await conn.execute(migration_sql)

    # id: UUID PK
    col = await _get_column(conn, "CaseReference", "id")
    assert col is not None, "Column CaseReference.id missing"
    assert col["data_type"] == "uuid"
    assert col["is_nullable"] == "NO"
    assert col["column_default"] is not None and "gen_random_uuid" in col["column_default"]

    # conversation_id: nullable UUID (FK)
    col = await _get_column(conn, "CaseReference", "conversation_id")
    assert col is not None
    assert col["data_type"] == "uuid"
    assert col["is_nullable"] == "YES"

    # salesforce_case_id: TEXT NOT NULL
    col = await _get_column(conn, "CaseReference", "salesforce_case_id")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "NO", "salesforce_case_id must be NOT NULL"

    # case_number, subject, status, priority, owner, account_id, contact_id: nullable TEXT
    for c in ("case_number", "subject", "status", "priority", "owner", "account_id", "contact_id"):
        col = await _get_column(conn, "CaseReference", c)
        assert col is not None, f"Column {c} missing"
        assert col["data_type"] == "text"
        assert col["is_nullable"] == "YES"

    # last_synced_at: TIMESTAMPTZ, nullable
    col = await _get_column(conn, "CaseReference", "last_synced_at")
    assert col is not None
    assert col["data_type"] == "timestamp with time zone"
    assert col["is_nullable"] == "YES"

    # Primary key
    assert await _check_pk(conn, "CaseReference")


# ============================================================
# 4. Column Schema — EscalationRequest
# ============================================================


@pytest.mark.asyncio
async def test_escalation_request_schema(test_db_pool, migration_sql):
    """EscalationRequest id UUID PK, case_id FK, requested_by FK,
    status TEXT DEFAULT 'pending', reason TEXT NOT NULL."""
    conn = test_db_pool
    await conn.execute(migration_sql)

    # id: UUID PK
    col = await _get_column(conn, "EscalationRequest", "id")
    assert col is not None
    assert col["data_type"] == "uuid"
    assert col["is_nullable"] == "NO"
    assert col["column_default"] is not None and "gen_random_uuid" in col["column_default"]

    # case_id: UUID FK to CaseReference
    col = await _get_column(conn, "EscalationRequest", "case_id")
    assert col is not None
    assert col["data_type"] == "uuid"
    assert col["is_nullable"] == "YES"

    # reason: TEXT NOT NULL
    col = await _get_column(conn, "EscalationRequest", "reason")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "NO"

    # requested_action: nullable TEXT
    col = await _get_column(conn, "EscalationRequest", "requested_action")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "YES"

    # status: TEXT NOT NULL DEFAULT 'pending'
    col = await _get_column(conn, "EscalationRequest", "status")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "NO"
    assert col["column_default"] is not None and "pending" in col["column_default"]

    # requested_by: TEXT FK to users.id (users.id is TEXT)
    col = await _get_column(conn, "EscalationRequest", "requested_by")
    assert col is not None, "Column requested_by missing"
    assert col["data_type"] == "text"

    # decided_by: nullable UUID (no FK constraint)
    col = await _get_column(conn, "EscalationRequest", "decided_by")
    assert col is not None, "Column decided_by missing"
    assert col["data_type"] == "uuid"

    # decision: nullable TEXT
    col = await _get_column(conn, "EscalationRequest", "decision")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "YES"

    # Timestamps
    for c in ("decided_at", "created_at"):
        col = await _get_column(conn, "EscalationRequest", c)
        assert col is not None, f"Column {c} missing"
        assert col["data_type"] == "timestamp with time zone"

    # created_at NOT NULL
    col = await _get_column(conn, "EscalationRequest", "created_at")
    assert col["is_nullable"] == "NO"

    # Primary key
    assert await _check_pk(conn, "EscalationRequest")


# ============================================================
# 5. Column Schema — KnowledgeArticle
# ============================================================


@pytest.mark.asyncio
async def test_knowledge_article_schema(test_db_pool, migration_sql):
    """KnowledgeArticle id UUID PK, title + content TEXT NOT NULL,
    embedding vector(1536)."""
    conn = test_db_pool
    await conn.execute(migration_sql)

    # id: UUID PK
    col = await _get_column(conn, "KnowledgeArticle", "id")
    assert col is not None
    assert col["data_type"] == "uuid"
    assert col["is_nullable"] == "NO"
    assert col["column_default"] is not None and "gen_random_uuid" in col["column_default"]

    # title + content: TEXT NOT NULL
    for c in ("title", "content"):
        col = await _get_column(conn, "KnowledgeArticle", c)
        assert col is not None, f"Column {c} missing"
        assert col["data_type"] == "text"
        assert col["is_nullable"] == "NO", f"KnowledgeArticle.{c} must be NOT NULL"

    # category: nullable TEXT
    col = await _get_column(conn, "KnowledgeArticle", "category")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "YES"

    # salesforce_article_id: nullable TEXT
    col = await _get_column(conn, "KnowledgeArticle", "salesforce_article_id")
    assert col is not None
    assert col["data_type"] == "text"
    assert col["is_nullable"] == "YES"

    # embedding: vector(1536)
    col = await _get_column(conn, "KnowledgeArticle", "embedding")
    assert col is not None, "Column embedding missing"
    # vector is a USER-DEFINED type; check udt_name to confirm
    assert col["data_type"] == "USER-DEFINED", (
        f"Expected USER-DEFINED (vector), got {col['data_type']}"
    )
    assert col["is_nullable"] == "YES"

    # Primary key
    assert await _check_pk(conn, "KnowledgeArticle")


# ============================================================
# 6. Column Schema — SlaPolicy
# ============================================================


@pytest.mark.asyncio
async def test_sla_policy_schema(test_db_pool, migration_sql):
    """SlaPolicy id UUID PK, name/priority TEXT NOT NULL,
    response_hours/resolution_hours INTEGER NOT NULL."""
    conn = test_db_pool
    await conn.execute(migration_sql)

    # id: UUID PK
    col = await _get_column(conn, "SlaPolicy", "id")
    assert col is not None
    assert col["data_type"] == "uuid"
    assert col["is_nullable"] == "NO"
    assert col["column_default"] is not None and "gen_random_uuid" in col["column_default"]

    # name + priority: TEXT NOT NULL
    for c in ("name", "priority"):
        col = await _get_column(conn, "SlaPolicy", c)
        assert col is not None, f"Column {c} missing"
        assert col["data_type"] == "text"
        assert col["is_nullable"] == "NO"

    # response_hours + resolution_hours: INTEGER NOT NULL
    for c in ("response_hours", "resolution_hours"):
        col = await _get_column(conn, "SlaPolicy", c)
        assert col is not None, f"Column {c} missing"
        assert col["data_type"] == "integer"
        assert col["is_nullable"] == "NO"

    # created_at: TIMESTAMPTZ NOT NULL DEFAULT now()
    col = await _get_column(conn, "SlaPolicy", "created_at")
    assert col is not None
    assert col["data_type"] == "timestamp with time zone"
    assert col["is_nullable"] == "NO"

    # Primary key
    assert await _check_pk(conn, "SlaPolicy")


# ============================================================
# 7. Foreign Key constraints
# ============================================================


@pytest.mark.asyncio
async def test_foreign_key_constraints(test_db_pool, migration_sql):
    """Referential integrity constraints are properly defined."""
    conn = test_db_pool
    await conn.execute(migration_sql)

    # Check FK exists: CaseReference.conversation_id → SupportConversation.id
    row = await conn.fetchrow(
        """SELECT 1 FROM information_schema.table_constraints tc
           JOIN information_schema.constraint_column_usage ccu
             ON tc.constraint_name = ccu.constraint_name
           WHERE tc.table_schema = 'public'
             AND tc.table_name = 'CaseReference'
             AND tc.constraint_type = 'FOREIGN KEY'
             AND ccu.table_name = 'SupportConversation'"""
    )
    assert row is not None, (
        "Missing FK: CaseReference.conversation_id → SupportConversation.id"
    )

    # Check FK exists: EscalationRequest.case_id → CaseReference.id
    row = await conn.fetchrow(
        """SELECT 1 FROM information_schema.table_constraints tc
           JOIN information_schema.constraint_column_usage ccu
             ON tc.constraint_name = ccu.constraint_name
           WHERE tc.table_schema = 'public'
             AND tc.table_name = 'EscalationRequest'
             AND tc.constraint_type = 'FOREIGN KEY'
             AND ccu.table_name = 'CaseReference'"""
    )
    assert row is not None, (
        "Missing FK: EscalationRequest.case_id → CaseReference.id"
    )

    # Check FK exists: EscalationRequest.requested_by → users.id
    row = await conn.fetchrow(
        """SELECT 1 FROM information_schema.table_constraints tc
           JOIN information_schema.constraint_column_usage ccu
             ON tc.constraint_name = ccu.constraint_name
           WHERE tc.table_schema = 'public'
             AND tc.table_name = 'EscalationRequest'
             AND tc.constraint_type = 'FOREIGN KEY'
             AND ccu.table_name = 'users'"""
    )
    assert row is not None, (
        "Missing FK: EscalationRequest.requested_by → users.id"
    )


# ============================================================
# 8. INSERT + SELECT round-trip (data integrity)
# ============================================================


@pytest.mark.asyncio
async def test_insert_round_trip(test_db_pool, migration_sql):
    """INSERT into each table and SELECT back — verify data survives."""
    conn = test_db_pool
    await conn.execute(migration_sql)

    # Get an existing user for FK references
    user = await conn.fetchrow("SELECT id FROM users LIMIT 1")
    assert user is not None, "Test DB must have at least one user"
    user_id = user["id"]

    # --- SupportConversation ---
    conv_id = await conn.fetchval(
        """INSERT INTO "SupportConversation" (title, user_id, salesforce_case_id)
           VALUES ('Customer inquiry about order #1234', $1, '500AB000001')
           RETURNING id""",
        user_id,
    )
    assert conv_id is not None, "SupportConversation INSERT failed"
    conv = await conn.fetchrow(
        """SELECT title, status, user_id, salesforce_case_id
           FROM "SupportConversation" WHERE id = $1""",
        conv_id,
    )
    assert conv["title"] == "Customer inquiry about order #1234"
    assert conv["status"] == "open", "Default status should be 'open'"
    assert conv["user_id"] == user_id
    assert conv["salesforce_case_id"] == "500AB000001"

    # --- CaseReference ---
    case_id = await conn.fetchval(
        """INSERT INTO "CaseReference"
              (conversation_id, salesforce_case_id, case_number, subject, status, priority, owner)
           VALUES ($1, '500AB000001', 'CAS-2026-001', 'Order delay inquiry', 'Open', 'High', 'Sarah Johnson')
           RETURNING id""",
        conv_id,
    )
    assert case_id is not None, "CaseReference INSERT failed"
    case_row = await conn.fetchrow(
        """SELECT salesforce_case_id, case_number, subject, status, priority
           FROM "CaseReference" WHERE id = $1""",
        case_id,
    )
    assert case_row["salesforce_case_id"] == "500AB000001"
    assert case_row["case_number"] == "CAS-2026-001"
    assert case_row["subject"] == "Order delay inquiry"

    # --- EscalationRequest ---
    esc_id = await conn.fetchval(
        """INSERT INTO "EscalationRequest"
              (case_id, reason, requested_action, requested_by)
           VALUES ($1, 'Customer escalating due to SLA breach', 'Expedite shipping and apply discount', $2)
           RETURNING id""",
        case_id,
        user_id,
    )
    assert esc_id is not None, "EscalationRequest INSERT failed"
    esc = await conn.fetchrow(
        """SELECT reason, status, requested_by
           FROM "EscalationRequest" WHERE id = $1""",
        esc_id,
    )
    assert esc["reason"] == "Customer escalating due to SLA breach"
    assert esc["status"] == "pending", "Default status should be 'pending'"
    assert esc["requested_by"] == user_id

    # --- KnowledgeArticle ---
    ka_id = await conn.fetchval(
        """INSERT INTO "KnowledgeArticle" (title, content, category, salesforce_article_id)
           VALUES ('How to process refunds', 'Step-by-step guide for processing customer refunds.', 'Operations', 'KA-001')
           RETURNING id""",
    )
    assert ka_id is not None, "KnowledgeArticle INSERT failed"
    ka = await conn.fetchrow(
        """SELECT title, category, salesforce_article_id FROM "KnowledgeArticle" WHERE id = $1""",
        ka_id,
    )
    assert ka["title"] == "How to process refunds"
    assert ka["category"] == "Operations"

    # --- SlaPolicy ---
    sla_id = await conn.fetchval(
        """INSERT INTO "SlaPolicy" (name, priority, response_hours, resolution_hours)
           VALUES ('Premium Support', 'Critical', 1, 4)
           RETURNING id""",
    )
    assert sla_id is not None, "SlaPolicy INSERT failed"
    sla = await conn.fetchrow(
        """SELECT name, priority, response_hours, resolution_hours
           FROM "SlaPolicy" WHERE id = $1""",
        sla_id,
    )
    assert sla["name"] == "Premium Support"
    assert sla["priority"] == "Critical"
    assert sla["response_hours"] == 1
    assert sla["resolution_hours"] == 4


# ============================================================
# 9. Rollback behavior
# ============================================================


@pytest.mark.asyncio
async def test_rollback_behavior(test_db_pool, migration_sql):
    """BEGIN / INSERT / ROLLBACK via savepoint — row must not persist."""
    conn = test_db_pool
    await conn.execute(migration_sql)

    # Use SlaPolicy (no FK dependencies) for clean rollback test
    await conn.execute("SAVEPOINT test_rollback_sp")

    await conn.execute(
        """INSERT INTO "SlaPolicy" (name, priority, response_hours, resolution_hours)
           VALUES ('Rollback Test Policy', 'Low', 24, 72)"""
    )

    # Verify the row is visible within the savepoint
    row = await conn.fetchrow(
        """SELECT 1 FROM "SlaPolicy" WHERE name = 'Rollback Test Policy'"""
    )
    assert row is not None, "Row should be visible after INSERT"

    # Rollback the savepoint
    await conn.execute("ROLLBACK TO SAVEPOINT test_rollback_sp")

    # Verify the row is gone
    row = await conn.fetchrow(
        """SELECT 1 FROM "SlaPolicy" WHERE name = 'Rollback Test Policy'"""
    )
    assert row is None, "Row should not exist after ROLLBACK"
