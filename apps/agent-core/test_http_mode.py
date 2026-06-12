"""Inline test for MockSalesforceClient HTTP mode against mock server."""
import asyncio
import sys
import time

sys.path.insert(0, ".")

import httpx
from src.salesforce.client import MockSalesforceClient


async def test_all_operations():
    client = MockSalesforceClient(
        mode="http",
        base_url="http://localhost:3002/api/salesforce",
    )

    results = {}
    latencies = {}

    # 1. search_cases
    print("\n--- 1. search_cases ---")
    try:
        t0 = time.monotonic()
        cases = await client.search_cases("login")
        latencies["search_cases"] = time.monotonic() - t0
        results["search_cases"] = len(cases) > 0
        print(f"  search_cases('login'): {len(cases)} results {'OK' if results['search_cases'] else 'WARN (0)'}")
        if cases:
            print(f"    First: [{cases[0]['id']}] {cases[0]['subject']}")
    except Exception as e:
        results["search_cases"] = False
        latencies["search_cases"] = -1
        print(f"  FAIL: {e}")

    # Also test search with empty query (should return all)
    try:
        t0 = time.monotonic()
        all_cases = await client.search_cases("")
        latencies["search_cases_all"] = time.monotonic() - t0
        print(f"  search_cases(''): {len(all_cases)} results {'OK' if len(all_cases) > 0 else 'FAIL'}")
    except Exception as e:
        all_cases = []
        print(f"  search_cases('') FAILED: {e}")

    # 2. get_case_details
    print("\n--- 2. get_case_details ---")
    try:
        if all_cases and len(all_cases) > 0:
            first_id = all_cases[0]["id"]
            t0 = time.monotonic()
            details = await client.get_case_details(first_id)
            latencies["get_case_details"] = time.monotonic() - t0
            results["get_case_details"] = isinstance(details, dict) and "subject" in details
            print(f"  get_case_details('{first_id}'): {'OK' if results['get_case_details'] else 'FAIL'}")
            if results["get_case_details"]:
                print(f"    Subject: {details['subject']}")
                print(f"    Status: {details['status']}")
        else:
            results["get_case_details"] = False
            latencies["get_case_details"] = -1
            print(f"  SKIP: no cases available")
    except Exception as e:
        results["get_case_details"] = False
        latencies["get_case_details"] = -1
        print(f"  FAIL: {e}")

    # 3. get_customer_context
    print("\n--- 3. get_customer_context ---")
    try:
        t0 = time.monotonic()
        ctx = await client.get_customer_context("acc-001")
        latencies["get_customer_context"] = time.monotonic() - t0
        has_account = "account" in ctx
        has_contact = "contact" in ctx
        results["get_customer_context"] = has_account and has_contact
        print(f"  get_customer_context('acc-001'): {'OK' if results['get_customer_context'] else 'FAIL'}")
        if has_account:
            print(f"    Account: {ctx['account'].get('name')} ({ctx['account'].get('industry')})")
        if has_contact:
            print(f"    Contact: {ctx['contact'].get('name')} ({ctx['contact'].get('email')})")
    except Exception as e:
        results["get_customer_context"] = False
        latencies["get_customer_context"] = -1
        print(f"  FAIL: {e}")

    # 4. search_knowledge_base
    print("\n--- 4. search_knowledge_base ---")
    try:
        t0 = time.monotonic()
        articles = await client.search_knowledge_base("password")
        latencies["search_knowledge_base"] = time.monotonic() - t0
        results["search_knowledge_base"] = len(articles) > 0
        print(f"  search_knowledge_base('password'): {len(articles)} articles {'OK' if results['search_knowledge_base'] else 'FAIL'}")
        if articles:
            for a in articles:
                print(f"    [{a['articleId']}] {a['title']}")
    except Exception as e:
        results["search_knowledge_base"] = False
        latencies["search_knowledge_base"] = -1
        print(f"  FAIL: {e}")

    # 5. create_case
    print("\n--- 5. create_case ---")
    try:
        t0 = time.monotonic()
        new_case = await client.create_case(
            subject="Test HTTP Case",
            description="Testing HTTP mode case creation",
            priority="High",
            account_id="acc-001",
        )
        latencies["create_case"] = time.monotonic() - t0
        results["create_case"] = "id" in new_case and new_case.get("subject") == "Test HTTP Case"
        print(f"  create_case: {'OK' if results['create_case'] else 'FAIL'}")
        if "id" in new_case:
            print(f"    Created: [{new_case['id']}] {new_case.get('subject', 'N/A')} (status: {new_case.get('status', 'N/A')})")
    except Exception as e:
        results["create_case"] = False
        latencies["create_case"] = -1
        new_case = {}
        print(f"  FAIL: {e}")

    # 6. update_case
    print("\n--- 6. update_case ---")
    try:
        target_id = new_case.get("id") if results.get("create_case") else None
        if not target_id and all_cases and len(all_cases) > 0:
            target_id = all_cases[0]["id"]
        if target_id:
            t0 = time.monotonic()
            updated = await client.update_case(target_id, {"status": "In Progress", "priority": "Critical"})
            latencies["update_case"] = time.monotonic() - t0
            results["update_case"] = updated.get("status") == "In Progress" and updated.get("priority") == "Critical"
            print(f"  update_case('{target_id}'): {'OK' if results['update_case'] else 'FAIL'}")
            if results["update_case"]:
                print(f"    Updated: status={updated['status']}, priority={updated['priority']}")
        else:
            results["update_case"] = False
            latencies["update_case"] = -1
            print(f"  SKIP: no case ID available")
    except Exception as e:
        results["update_case"] = False
        latencies["update_case"] = -1
        print(f"  FAIL: {e}")

    # 7. escalate_case
    print("\n--- 7. escalate_case ---")
    try:
        target_id = new_case.get("id") if results.get("create_case") else None
        if not target_id and all_cases and len(all_cases) > 0:
            target_id = all_cases[0]["id"]
        if target_id:
            t0 = time.monotonic()
            escalation = await client.escalate_case(
                target_id,
                reason="Customer escalation requested",
                requested_action="Escalate to Level 2 support",
            )
            latencies["escalate_case"] = time.monotonic() - t0
            results["escalate_case"] = (
                escalation.get("caseId") == target_id
                and escalation.get("status") == "Escalated"
            )
            print(f"  escalate_case('{target_id}'): {'OK' if results['escalate_case'] else 'FAIL'}")
            if results["escalate_case"]:
                print(f"    Escalated: reason='{escalation.get('reason')}', status={escalation.get('status')}")
        else:
            results["escalate_case"] = False
            latencies["escalate_case"] = -1
            print(f"  SKIP: no case ID available")
    except Exception as e:
        results["escalate_case"] = False
        latencies["escalate_case"] = -1
        print(f"  FAIL: {e}")

    # Summary
    print("\n" + "=" * 60)
    print("HTTP MODE TEST SUMMARY")
    print("=" * 60)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(f"\n  Passed: {passed}/{total}")
    print(f"  Failed: {total - passed}/{total}")
    print()
    for op in [
        "search_cases",
        "get_case_details",
        "get_customer_context",
        "search_knowledge_base",
        "create_case",
        "update_case",
        "escalate_case",
    ]:
        if op in results:
            status = "OK" if results[op] else "FAIL"
            lat = latencies.get(op, -1)
            lat_str = f"{lat*1000:.1f}ms" if lat >= 0 else "N/A"
            print(f"  {status:4s} {op:30s} {lat_str:>8s}")

    return all(results.values())


if __name__ == "__main__":
    success = asyncio.run(test_all_operations())
    sys.exit(0 if success else 1)
