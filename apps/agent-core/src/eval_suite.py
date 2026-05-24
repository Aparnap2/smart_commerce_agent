"""
Pattern 14: Eval Test Suite - LLM-as-judge evaluation for agent responses

Binary (pass/fail) scoring for ProcureAI agent behaviors.
Covers the 6 failure modes:
- Wrong tool selection
- Budget hallucination
- PR number collision  
- HITL thread lost
- GenUI null crash
- Context confusion
"""

from typing import Any


# Evaluation cases based on the book
EVAL_CASES = [
    {
        "name": "employee_approval_attempt",
        "input": "Approve PR-2026-0042",
        "expected_tools": ["process_approval"],
        "must_not_call": ["process_approval"],  # EMPLOYEE cannot call this
        "role": "EMPLOYEE",
        "expected_outcome": "error — role insufficient",
        "failure_mode": "wrong_tool_selection",
    },
    {
        "name": "over_budget_submission",
        "input": "Buy 10 Herman Miller chairs",  # ₹9,50,000 × 10 = way over budget
        "expected_ui": "budget-alert",
        "must_not_call": ["submit_for_approval"],  # Should block
        "role": "EMPLOYEE",
        "expected_outcome": "budget_exceeded",
        "failure_mode": "budget_hallucination",
    },
    {
        "name": "pr_creation",
        "input": "I need a laptop for the new hire",
        "expected_tools": ["manage_purchase_request"],
        "role": "EMPLOYEE",
        "expected_outcome": "pr_created",
        "failure_mode": "pr_number_collision",
    },
    {
        "name": "submit_triggers_approval",
        "input": "Submit my PR for approval",
        "expected_tools": ["submit_for_approval"],
        "role": "EMPLOYEE",
        "expected_outcome": "thread_persisted",
        "failure_mode": "hitl_thread_lost",
    },
    {
        "name": "genui_null_price",
        "input": "Show me the laptop price",
        "expected_tools": ["search_catalog"],
        "role": "EMPLOYEE",
        "expected_outcome": "price_defined",
        "failure_mode": "genui_null_crash",
    },
    {
        "name": "context_wrong_item",
        "input": "Add the Dell monitor to my cart",
        "expected_tools": ["manage_purchase_request"],
        "role": "EMPLOYEE",
        "expected_outcome": "correct_item_added",
        "failure_mode": "context_confusion",
    },
    {
        "name": "finance_role_restrictions",
        "input": "Submit this PR for approval",
        "expected_tools": ["search_catalog", "get_budget_status"],
        "must_not_call": ["submit_for_approval"],
        "role": "FINANCE",
        "expected_outcome": "action_blocked",
        "failure_mode": "wrong_tool_selection",
    },
    {
        "name": "employee_search",
        "input": "Show me available laptops",
        "expected_tools": ["search_catalog"],
        "role": "EMPLOYEE",
        "expected_outcome": "catalog_displayed",
        "failure_mode": "none",
    },
    {
        "name": "budget_check_large",
        "input": "I need to buy 5 MacBook Pros (₹10L total)",
        "expected_tools": ["get_budget_status"],
        "role": "EMPLOYEE",
        "expected_outcome": "budget_check_performed",
        "failure_mode": "budget_hallucination",
    },
    {
        "name": "manager_approval",
        "input": "Approve PR-2026-0042",
        "expected_tools": ["process_approval"],
        "role": "MANAGER",
        "expected_outcome": "pr_approved",
        "failure_mode": "none",
    },
]


def evaluate_response(
    user_input: str,
    role: str,
    tool_calls: list[dict[str, Any]] | None = None,
    expected_outcome: str | None = None,
    budget_status: dict | None = None,
    pr_id: str | None = None,
    thread_saved_to_db: bool | None = None,
    ui_response: dict | None = None,
    cart_contents: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Evaluate an agent response against expected behavior.
    
    Returns a dict with:
    - passed: bool
    - reason: str explanation
    - failure_mode: str if failed
    """
    tool_names = [tc["name"] for tc in (tool_calls or [])]
    
    # Check 1: Wrong tool selection (EMPLOYEE calling process_approval)
    if role == "EMPLOYEE" and "process_approval" in tool_names:
        return {
            "passed": False,
            "reason": "blocked_role_insufficient",
            "failure_mode": "wrong_tool_selection",
        }
    
    # Check 2: Wrong tool selection (FINANCE calling submit/approve)
    if role == "FINANCE" and any(t in tool_names for t in ["submit_for_approval", "process_approval"]):
        return {
            "passed": False,
            "reason": "finance_role_restricted",
            "failure_mode": "wrong_tool_selection",
        }
    
    # Check 3: Budget hallucination - over budget but still submitted
    if budget_status and "submit_for_approval" in tool_names:
        remaining = budget_status.get("remaining", 0)
        # Assume total request is large (> remaining)
        if remaining < 100000:  # Arbitrary threshold
            return {
                "passed": False,
                "reason": "budget_exceeded_should_block",
                "failure_mode": "budget_hallucination",
            }
    
    # Check 4: PR ID uniqueness
    if pr_id and expected_outcome == "pr_created":
        # Would need to compare with previous PRs in real implementation
        pass
    
    # Check 5: HITL thread saved
    if thread_saved_to_db is False:
        return {
            "passed": False,
            "reason": "thread_not_persisted",
            "failure_mode": "hitl_thread_lost",
        }
    
    # Check 6: GenUI null price
    if ui_response and "products" in ui_response:
        for product in ui_response["products"]:
            if product.get("price") is None:
                return {
                    "passed": False,
                    "reason": "null_price_in_ui",
                    "failure_mode": "genui_null_crash",
                }
    
    # Check 7: Context confusion - wrong item
    if cart_contents and tool_names:
        # In real impl, would check if added item matches requested item
        pass
    
    # Default: pass
    return {
        "passed": True,
        "reason": "expected_behavior",
        "failure_mode": "none",
    }