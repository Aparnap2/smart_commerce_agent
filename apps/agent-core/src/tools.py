from src.support import SUPPORT_TOOLS


# ─────────────────────────────────────────────────────────
# SupportPilot — Salesforce support role-tool mapping
# ─────────────────────────────────────────────────────────

# Index constants for slicing (12 tools total)
_READ_ONLY_END = 5       # Tools 0-4: search, detail, context, kb, similar
_PROACTIVE_SCAN_IDX = -2  # Second-to-last: proactive_scan (index 10)
_APPROVE_FIX_IDX = -1     # Last: approve_fix (index 11)

SUPPORT_ROLE_TOOLS = {
    # All 12 (full access: read + write + scan + approve fix)
    "ADMIN": SUPPORT_TOOLS,
    "TEAM_LEAD": SUPPORT_TOOLS,
    "MANAGER": SUPPORT_TOOLS,

    # All except approve_fix (agents can scan and propose, not execute)
    "SUPPORT_AGENT": [t for t in SUPPORT_TOOLS if t.name != "approve_fix"],
    "SUPPORT": [t for t in SUPPORT_TOOLS if t.name != "approve_fix"],

    # Read-only + proactive_scan (ops can scan but not mutate or approve)
    "SUPPORT_OPS": [
        *SUPPORT_TOOLS[:_READ_ONLY_END],       # Read-only tools
        SUPPORT_TOOLS[_PROACTIVE_SCAN_IDX],     # proactive_scan only
    ],
    "EMPLOYEE": [
        *SUPPORT_TOOLS[:_READ_ONLY_END],       # Read-only tools
        SUPPORT_TOOLS[_PROACTIVE_SCAN_IDX],     # proactive_scan only
    ],
}


def get_tools_for_role(role: str) -> list:
    """
    Get role-specific tool list.

    Args:
        role: User role (SUPPORT_AGENT, TEAM_LEAD, SUPPORT_OPS, ADMIN, etc.)

    Returns:
        List of tools available for the role
    """
    role = role.upper() if role else ""
    support_roles = {
        "SUPPORT_AGENT", "TEAM_LEAD", "SUPPORT_OPS",
        "ADMIN", "EMPLOYEE", "SUPPORT", "MANAGER",
    }
    if role in support_roles:
        return SUPPORT_ROLE_TOOLS.get(role, SUPPORT_TOOLS[:_READ_ONLY_END])
    return []  # unknown role gets no tools


ALL_TOOLS = [
    *SUPPORT_TOOLS,
]
