"""
Enforcement tests for the SupportPilot codebase.

These are PERMANENT domain-boundary assertions that prevent procurement
code from ever re-entering the codebase. If any test here fails, it means
a procurement artifact has leaked back in and must be removed.

These tests are intentionally simple and dependency-light so they always
run correctly regardless of the broader test environment state.
"""

import os
import ast
import importlib
import pytest

# ─────────────────────────────────────────────────────────────
# Test 1: Source tree scan for procurement identifiers
# ─────────────────────────────────────────────────────────────


def test_no_procurement_tool_names_exist():
    """Search every .py file in src/ for any procurement tool name.

    Uses string matching (covers imports, references, comments, strings).
    The intent is zero tolerance — these names must never appear anywhere
    in the source tree.
    """
    procurement_names = [
        "search_catalog",
        "get_budget_status",
        "manage_purchase_request",
        "submit_for_approval",
        "process_approval",
        "compare_market_price",
        "vendor_sourcing_request",
        "get_pricing_audit_results",
        "raise_dispute",
    ]
    src_dir = os.path.join(os.path.dirname(__file__), "..", "src")
    violations = []
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            if f.endswith(".py"):
                path = os.path.join(root, f)
                with open(path) as fh:
                    content = fh.read()
                for name in procurement_names:
                    if name in content:
                        violations.append(f"{path}: contains '{name}'")
    assert not violations, "Procurement tool names found:\n" + "\n".join(violations)


# ─────────────────────────────────────────────────────────────
# Test 2: Role-based tool routing returns only support tools
# ─────────────────────────────────────────────────────────────


def test_get_tools_for_role_only_returns_support_tools():
    """Verify that EVERY role returns only support-domain tools.

    Unknown/undefined roles must return an empty list — no implicit
    fallback to procurement tools or any other non-support domain.
    """
    from src.tools import get_tools_for_role

    SUPPORT_TOOL_NAMES = [
        "search_salesforce_cases",
        "get_case_details",
        "get_customer_context",
        "search_knowledge_base",
        "search_similar_tickets",
        "draft_case_reply",
        "create_case",
        "update_case",
        "escalate_case",
    ]
    for role in ("SUPPORT_AGENT", "TEAM_LEAD", "SUPPORT_OPS", "ADMIN"):
        tools = get_tools_for_role(role)
        tool_names = [t.name for t in tools]
        for name in tool_names:
            assert name in SUPPORT_TOOL_NAMES, (
                f"Role {role} has non-support tool: {name}"
            )
    assert get_tools_for_role("UNKNOWN") == []
    assert get_tools_for_role("EMPLOYEE") == []
    assert get_tools_for_role("MANAGER") == []
    assert get_tools_for_role("FINANCE") == []


# ─────────────────────────────────────────────────────────────
# Test 3: Core support modules import cleanly
# ─────────────────────────────────────────────────────────────


def test_support_migration_imports_clean():
    """Verify all core support modules are importable without error.

    A failed import here indicates a broken module dependency chain,
    a missing file, or an ImportError that would crash the agent at
    runtime. This is a basic health check for the module tree.
    """
    for module_name in ["src.tools", "src.graph", "src.support", "src.salesforce"]:
        try:
            importlib.import_module(module_name)
        except ImportError as e:
            pytest.fail(f"Module {module_name} failed to import: {e}")


# ─────────────────────────────────────────────────────────────
# Test 4: Known procurement files must not exist on disk
# ─────────────────────────────────────────────────────────────


def test_no_procurement_files_remain():
    """Assert that known procurement-related files have been deleted.

    These files were removed during the procurement-to-support migration
    and must never be recreated.
    """
    src_dir = os.path.join(os.path.dirname(__file__), "..", "src")
    app_dir = os.path.join(os.path.dirname(__file__), "..")
    migrations_dir = os.path.join(os.path.dirname(__file__), "..", "..", "migrations")

    checks = [
        os.path.join(src_dir, "catalog_audit.py"),
        os.path.join(app_dir, "run_catalog_audit.py"),
        os.path.join(app_dir, "scripts", "run_catalog_audit.py"),
        os.path.join(migrations_dir, "005_add_pricing_flag.sql"),
    ]
    for filepath in checks:
        assert not os.path.exists(filepath), (
            f"Deleted procurement file still exists: {filepath}"
        )


# ─────────────────────────────────────────────────────────────
# Test 5: Old procurement test modules must not be importable
# ─────────────────────────────────────────────────────────────


def test_deleted_procurement_tests_cannot_be_imported():
    """Verify that old procurement test modules raise ModuleNotFoundError.

    If any of these can be imported, the old test file has been restored
    or a stale branch was merged.
    """
    procurement_tests = [
        "tests.test_tools_tdd",
        "tests.test_catalog_audit",
        "tests.test_serpapi_market_price",
        "tests.test_budget_timing",
        "tests.test_dispute_flow",
    ]
    for module_name in procurement_tests:
        with pytest.raises(ModuleNotFoundError):
            importlib.import_module(module_name)


# ─────────────────────────────────────────────────────────────
# Test 6: Graph module must not expose procurement-era nodes
# ─────────────────────────────────────────────────────────────


def test_graph_has_no_approval_gate():
    """Assert that procurement-era graph nodes were permanently removed.

    'route_after_tools' and 'approval_gate_node' were removed in Phase 3
    of the procurement-to-support migration. They must never reappear.
    """
    import src.graph as graph_mod
    assert not hasattr(graph_mod, "route_after_tools"), (
        "route_after_tools was removed in Phase 3 — do not restore"
    )
    assert not hasattr(graph_mod, "approval_gate_node"), (
        "approval_gate_node was removed in Phase 3 — do not restore"
    )
