from src.support import SUPPORT_TOOLS


# ─────────────────────────────────────────────────────────
# SupportPilot — Salesforce support role-tool mapping
# ─────────────────────────────────────────────────────────

SUPPORT_ROLE_TOOLS = {
    "SUPPORT_AGENT": SUPPORT_TOOLS[:-1],  # All except escalate (read+create+update)
    "TEAM_LEAD": SUPPORT_TOOLS,           # All 9 (including escalate)
    "SUPPORT_OPS": SUPPORT_TOOLS[:5],     # Read-only (case search, detail, context, kb, similar)
    "ADMIN": SUPPORT_TOOLS,               # All 9
}


def get_tools_for_role(role: str) -> list:
    """
    Get role-specific tool list.

    Args:
        role: User role (SUPPORT_AGENT, TEAM_LEAD, SUPPORT_OPS, ADMIN)

    Returns:
        List of tools available for the role
    """
    role = role.upper() if role else ""
    support_roles = {"SUPPORT_AGENT", "TEAM_LEAD", "SUPPORT_OPS", "ADMIN"}
    if role in support_roles:
        return SUPPORT_ROLE_TOOLS.get(role, SUPPORT_TOOLS[:5])  # fallback to read-only
    return []  # unknown role gets no tools


ALL_TOOLS = [
    *SUPPORT_TOOLS,
]
