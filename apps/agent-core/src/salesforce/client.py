"""
Mock Salesforce client for development and testing.

Returns realistic mock data structures for all Salesforce support operations.
Designed to be a drop-in replacement for a real Salesforce API client.
"""

import uuid
from datetime import datetime, timezone
from typing import Any

import httpx


# ─────────────────────────────────────────────────────────
# REALISTIC MOCK DATA
# ─────────────────────────────────────────────────────────

_COMPANY_NAMES = [
    "Acme Corp",
    "GlobalTech Inc",
    "Meridian Health",
    "Pacific Northwest Logistics",
    "Summit Ridge Energy",
]

_CASE_SUBJECTS = [
    "Login issue after password reset",
    "Payment not processed for invoice INV-2026-0042",
    "API rate limit exceeded",
    "Data sync failure between Salesforce and ERP",
    "User unable to access dashboard after upgrade",
]

_CASE_DESCRIPTIONS = [
    "User reports that after resetting their password via the 'Forgot Password' link, "
    "the new password is not being accepted by the login portal. The error message "
    "indicates 'Invalid credentials' despite multiple reset attempts.",
    "Invoice INV-2026-0042 was marked as paid in the accounting system, but the payment "
    "has not been reflected in the Salesforce billing module. Payment gateway "
    "confirmation ID is TXN-9876-5432.",
    "The integration with the third-party analytics service is exceeding the allocated "
    "API rate limit of 1000 requests per hour. This is causing intermittent failures "
    "in the reporting dashboard during peak usage hours.",
    "Scheduled data synchronization between Salesforce and the ERP system failed at "
    "02:30 UTC. The sync log shows a connection timeout error when attempting to "
    "retrieve updated inventory records from the ERP endpoint.",
    "After the latest platform upgrade to version 4.2, the user is unable to access "
    "the analytics dashboard. The page loads but displays a spinner indefinitely. "
    "Clearing browser cache and using incognito mode did not resolve the issue.",
]

_STATUSES = ["Open", "In Progress", "Escalated", "Closed", "Pending Customer Response"]
_PRIORITIES = ["Low", "Medium", "High", "Critical"]
_ORIGINS = ["Phone", "Email", "Web", "Chat", "Social Media"]

_OWNERS = [
    "Sarah Chen",
    "Mike Rodriguez",
    "Emily Watson",
    "James Thompson",
    "Priya Sharma",
]

_ACCOUNT_NAMES = [
    "Acme Corp",
    "GlobalTech Inc",
    "Meridian Health",
    "Pacific Northwest Logistics",
    "Summit Ridge Energy",
]

_CONTACT_NAMES = [
    "John Smith",
    "Lisa Park",
    "Robert Kim",
    "Amanda Foster",
    "Carlos Mendez",
]

_CONTACT_EMAILS = [
    "john.smith@acme.com",
    "lisa.park@globaltech.io",
    "robert.kim@meridian.health",
    "amanda.foster@pacificnw.com",
    "carlos.mendez@sre.com",
]

_CONTACT_TITLES = [
    "IT Operations Manager",
    "VP of Engineering",
    "Chief Medical Officer",
    "Logistics Director",
    "Head of Energy Trading",
]

_DEPARTMENTS = ["Information Technology", "Engineering", "Medical", "Logistics", "Trading"]

_KNOWLEDGE_ARTICLES = [
    {
        "articleId": "KA-001",
        "title": "Troubleshooting Login Issues After Password Reset",
        "contentExcerpt": "If you are unable to log in after resetting your password, please ensure that the new password meets the complexity requirements: at least 8 characters, one uppercase letter, one number, and one special character. Clear your browser cache and try again.",
        "category": "Authentication",
        "url": "https://help.acme.com/articles/KA-001",
        "lastReviewedDate": "2026-03-15",
    },
    {
        "articleId": "KA-002",
        "title": "Payment Gateway Integration Troubleshooting",
        "contentExcerpt": "When payments fail to sync between the billing module and Salesforce, first verify the webhook configuration in the payment gateway settings. Ensure the endpoint URL is correct and the SSL certificate is valid.",
        "category": "Billing",
        "url": "https://help.acme.com/articles/KA-002",
        "lastReviewedDate": "2026-04-02",
    },
    {
        "articleId": "KA-003",
        "title": "API Rate Limit Best Practices",
        "contentExcerpt": "To avoid hitting API rate limits, implement exponential backoff in your integration clients. The default rate limit is 1000 requests per hour per API key. Monitor your usage via the Developer Dashboard.",
        "category": "Integration",
        "url": "https://help.acme.com/articles/KA-003",
        "lastReviewedDate": "2026-02-20",
    },
    {
        "articleId": "KA-004",
        "title": "Data Sync Failure Resolution Guide",
        "contentExcerpt": "When Salesforce-to-ERP data synchronization fails, check the connection status, verify API credentials, and review the sync error logs. Common causes include network timeouts and schema changes on the ERP side.",
        "category": "Integration",
        "url": "https://help.acme.com/articles/KA-004",
        "lastReviewedDate": "2026-05-10",
    },
    {
        "articleId": "KA-005",
        "title": "Dashboard Access After Platform Upgrade",
        "contentExcerpt": "If the analytics dashboard fails to load after a platform upgrade, verify that browser extensions are not interfering, clear the application cache, and confirm your user role has the appropriate dashboard permissions.",
        "category": "Platform",
        "url": "https://help.acme.com/articles/KA-005",
        "lastReviewedDate": "2026-05-01",
    },
]

_RESOLUTIONS = [
    "Reset the user's password and cleared the SSO session cache. User was able to log in successfully after the fix.",
    "Manually reconciled the payment by re-syncing the invoice through the payment gateway webhook. Payment now reflected in billing module.",
    "Increased API rate limit from 1000 to 2000 requests per hour for the affected integration. Implemented caching to reduce redundant API calls.",
    "Restarted the sync service and re-established the connection pool. The ERP endpoint had a temporary network issue which has been resolved.",
    "Cleared the application cache and refreshed the user's permission set. The dashboard now loads correctly after assigning the missing permission group.",
]

_RESOLVED_CASE_SUBJECTS = [
    "Login failure after SSO configuration change",
    "Invoice payment not syncing to accounting",
    "API timeout on data export endpoint",
]

_RESOLVED_DATES = [
    "2026-04-10T14:30:00Z",
    "2026-04-08T09:15:00Z",
    "2026-04-05T16:45:00Z",
]

_SATISFACTION_RATINGS = [4, 5, 3]


class MockSalesforceClient:
    """
    Mock Salesforce client for development and testing.

    Returns realistic mock data structures for all Salesforce operations.
    Use mode='mock' for in-memory data (fast, no network), mode='http'
    for real HTTP calls to Mockoon or a real Salesforce API.

    Args:
        api_key: Optional Salesforce API key (for future live mode)
        instance_url: Optional Salesforce instance URL (for future live mode)
        mode: 'mock' (default) or 'http'
        base_url: Base URL for HTTP mode (default http://localhost:3002/api/salesforce)
    """

    def __init__(
        self,
        api_key: str | None = None,
        instance_url: str | None = None,
        mode: str = "mock",
        base_url: str = "http://localhost:3002/api/salesforce",
    ):
        self.api_key = api_key
        self.instance_url = instance_url
        self.mode = mode
        self.base_url = base_url.rstrip("/")
        # In-memory store for created cases (to support update_case)
        self._cases_store: dict[str, dict] = {}
        self._case_counter: int = 0

    # ── Internal Helpers ─────────────────────────────────

    def _generate_case_number(self) -> str:
        """Generate sequential case numbers: CAS-2026-0001, CAS-2026-0002, etc."""
        self._case_counter += 1
        return f"CAS-2026-{self._case_counter:04d}"

    def _build_mock_case(
        self,
        index: int,
        subject_override: str | None = None,
        status_override: str | None = None,
        priority_override: str | None = None,
    ) -> dict:
        """Build a realistic mock case dictionary."""
        now = datetime.now(timezone.utc).isoformat()
        case_id = f"500{index:06d}"
        company = _COMPANY_NAMES[index % len(_COMPANY_NAMES)]
        contact = _CONTACT_NAMES[index % len(_CONTACT_NAMES)]
        email = _CONTACT_EMAILS[index % len(_CONTACT_EMAILS)]
        owner = _OWNERS[index % len(_OWNERS)]

        return {
            "id": case_id,
            "caseNumber": self._generate_case_number(),
            "subject": subject_override or _CASE_SUBJECTS[index % len(_CASE_SUBJECTS)],
            "description": _CASE_DESCRIPTIONS[index % len(_CASE_DESCRIPTIONS)],
            "status": status_override or _STATUSES[index % len(_STATUSES)],
            "priority": priority_override or _PRIORITIES[index % len(_PRIORITIES)],
            "origin": _ORIGINS[index % len(_ORIGINS)],
            "owner": owner,
            "accountId": f"acc-{index + 1:03d}",
            "accountName": company,
            "contactId": f"con-{index + 1:03d}",
            "contactName": contact,
            "email": email,
            "phone": f"+1-555-{1000 + index:04d}",
            "createdDate": "2026-04-01T08:00:00Z",
            "lastModifiedDate": now,
        }

    def _get_first_case_id(self) -> str:
        """Get a valid case ID from the default mock data."""
        return "500000"

    # ── Public API ───────────────────────────────────────

    async def search_cases(
        self, query: str, filters: dict | None = None
    ) -> list[dict[str, Any]]:
        """
        Search cases by query string with optional filters.

        Args:
            query: Search query (matches against subject, account name, etc.)
            filters: Optional dict with keys like status, priority, owner

        Returns:
            List of matching case dicts
        """
        if self.mode == "http":
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/cases", params={"q": query}
                )
                response.raise_for_status()
                cases: list[dict[str, Any]] = response.json()
            # Apply filters client-side (Mockoon returns all cases)
            if filters:
                for key, value in filters.items():
                    cases = [c for c in cases if c.get(key) == value]
            return cases

        # ── mock mode ─────────────────────────────────────────
        # Generate 4 mock cases (mix of statuses/priorities)
        cases = []
        for i in range(4):
            case = self._build_mock_case(i)
            # Check stored cases for matching IDs
            if case["id"] in self._cases_store:
                case = self._cases_store[case["id"]]
            cases.append(case)

        # Apply filters if provided
        if filters:
            for key, value in filters.items():
                cases = [c for c in cases if c.get(key) == value]

        return cases

    async def get_case_details(self, case_id: str) -> dict[str, Any]:
        """
        Get full case details by case ID.

        Args:
            case_id: The Salesforce case ID

        Returns:
            Full case detail dict

        Raises:
            ValueError: If case_id is unknown
        """
        if self.mode == "http":
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/cases/{case_id}")
                if response.status_code == 404:
                    raise ValueError(f"Case not found: {case_id}")
                response.raise_for_status()
                return response.json()

        # ── mock mode ─────────────────────────────────────────
        # Try lookup by internal ID in stored cases
        if case_id in self._cases_store:
            return self._cases_store[case_id].copy()

        # Try lookup by caseNumber in stored cases
        for stored_case in self._cases_store.values():
            if stored_case.get("caseNumber") == case_id:
                return stored_case.copy()

        # Check if it matches internal ID pattern: 500xxxxxx
        if case_id.startswith("500") and len(case_id) == 9:
            index = int(case_id[3:]) % len(_COMPANY_NAMES)
            case = self._build_mock_case(index)
            self._cases_store[case["id"]] = case
            return case.copy()

        # Check if it matches caseNumber pattern: CAS-2026-NNNN
        if case_id.startswith("CAS-"):
            try:
                num = int(case_id.rsplit("-", 1)[-1])
                index = (num - 1) % len(_COMPANY_NAMES)
                case = self._build_mock_case(index)
                # Use the actual caseNumber from the request
                stored_num = self._case_counter
                case["caseNumber"] = f"CAS-2026-{num:04d}"
                # Recalculate ID to match the expected pattern
                case["id"] = f"500{index:06d}"
                self._cases_store[case["id"]] = case
                return case.copy()
            except (ValueError, IndexError):
                pass

        raise ValueError(f"Case not found: {case_id}")

    async def get_customer_context(self, account_id: str) -> dict[str, Any]:
        """
        Get customer context including account and contact information.

        Args:
            account_id: The Salesforce account ID

        Returns:
            Dict with 'account' and 'contact' keys

        Raises:
            ValueError: If account_id is unknown
        """
        if self.mode == "http":
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/accounts/{account_id}")
                if response.status_code == 404:
                    raise ValueError(f"Account not found: {account_id}")
                response.raise_for_status()
                return response.json()

        # ── mock mode ─────────────────────────────────────────
        # Derive a deterministic index from the account_id
        # Use acc-NNN => index N-1 to stay consistent with _build_mock_case
        if account_id.startswith("acc-"):
            try:
                num = int(account_id.split("-")[1])
                index = (num - 1) % len(_COMPANY_NAMES)
            except (ValueError, IndexError):
                index = 0
        else:
            index = abs(hash(account_id)) % len(_COMPANY_NAMES)

        return {
            "account": {
                "id": account_id,
                "name": _ACCOUNT_NAMES[index],
                "industry": [
                    "Technology",
                    "Healthcare",
                    "Logistics",
                    "Energy",
                    "Finance",
                ][index],
                "website": f"https://www.{_COMPANY_NAMES[index].lower().replace(' ', '')}.com",
                "phone": f"+1-555-{2000 + index:04d}",
                "billingCity": ["San Francisco", "Austin", "Chicago", "Seattle", "Denver"][
                    index
                ],
                "billingCountry": "United States",
                "annualRevenue": 50_000_000 * (index + 1),
                "customerTier": ["Premium", "Standard", "Enterprise", "Basic", "Premium"][
                    index
                ],
                "openCases": max(0, 3 - index),
                "lastCaseDate": "2026-04-15T10:30:00Z",
            },
            "contact": {
                "id": f"con-{account_id}",
                "name": _CONTACT_NAMES[index],
                "email": _CONTACT_EMAILS[index],
                "phone": f"+1-555-{3000 + index:04d}",
                "title": _CONTACT_TITLES[index],
                "department": _DEPARTMENTS[index],
            },
        }

    async def search_knowledge_base(self, query: str) -> list[dict[str, Any]]:
        """
        Search the knowledge base for articles matching the query.

        Args:
            query: Search query string

        Returns:
            List of matching knowledge article dicts
        """
        if self.mode == "http":
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.base_url}/knowledge-base", params={"q": query}
                )
                response.raise_for_status()
                return response.json()

        # ── mock mode ─────────────────────────────────────────
        query_lower = query.lower()
        results = []
        for article in _KNOWLEDGE_ARTICLES:
            if query_lower in article["title"].lower() or query_lower in article["category"].lower():
                results.append(article)

        # Return at least 2 results for testing
        if not results:
            results = _KNOWLEDGE_ARTICLES[:2]

        return results

    async def search_similar_tickets(self, query: str) -> list[dict[str, Any]]:
        """
        Search for resolved tickets similar to the given query.

        Args:
            query: Search query string

        Returns:
            List of resolved case dicts with resolution info
        """
        return [
            {
                "id": "500100",
                "caseNumber": "CAS-2026-0100",
                "subject": _RESOLVED_CASE_SUBJECTS[0],
                "resolution": _RESOLUTIONS[0],
                "resolvedDate": _RESOLVED_DATES[0],
                "satisfactionRating": _SATISFACTION_RATINGS[0],
            },
            {
                "id": "500101",
                "caseNumber": "CAS-2026-0101",
                "subject": _RESOLVED_CASE_SUBJECTS[1],
                "resolution": _RESOLUTIONS[1],
                "resolvedDate": _RESOLVED_DATES[1],
                "satisfactionRating": _SATISFACTION_RATINGS[1],
            },
            {
                "id": "500102",
                "caseNumber": "CAS-2026-0102",
                "subject": _RESOLVED_CASE_SUBJECTS[2],
                "resolution": _RESOLUTIONS[2],
                "resolvedDate": _RESOLVED_DATES[2],
                "satisfactionRating": _SATISFACTION_RATINGS[2],
            },
        ]

    async def draft_reply(
        self, case_id: str, context: dict | None = None
    ) -> str:
        """
        Draft a reply for a given case.

        Args:
            case_id: The case ID to draft a reply for
            context: Optional context dict with additional information

        Returns:
            A 2-3 sentence draft reply string

        Raises:
            ValueError: If case_id is unknown
        """
        # Get case details to find the subject
        try:
            case = await self.get_case_details(case_id)
        except ValueError:
            raise ValueError(f"Case not found: {case_id}")

        subject = case.get("subject", "your issue")
        customer_name = case.get("contactName", "Valued Customer")

        greeting = f"Dear {customer_name},"
        body = (
            f"Thank you for reaching out regarding '{subject}'. "
            f"Our support team is reviewing your case and we will provide an update "
            f"within the next 24 hours."
        )

        if context and "issue" in context:
            body += (
                f" Regarding the {context['issue']} you mentioned, we are actively "
                f"investigating the root cause."
            )

        closing = "We appreciate your patience and will keep you informed of any progress."

        return f"{greeting}\n\n{body}\n\n{closing}"

    async def create_case(
        self,
        subject: str,
        description: str,
        priority: str,
        account_id: str,
    ) -> dict[str, Any]:
        """
        Create a new case.

        Args:
            subject: Case subject line
            description: Detailed description of the issue
            priority: Priority level (Low, Medium, High, Critical)
            account_id: The Salesforce account ID

        Returns:
            The newly created case dict
        """
        if self.mode == "http":
            payload = {
                "subject": subject,
                "description": description,
                "priority": priority,
                "accountId": account_id,
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(f"{self.base_url}/cases", json=payload)
                response.raise_for_status()
                return response.json()

        # ── mock mode ─────────────────────────────────────────
        now = datetime.now(timezone.utc).isoformat()
        case_id = str(uuid.uuid4())

        new_case = {
            "id": case_id,
            "caseNumber": self._generate_case_number(),
            "subject": subject,
            "description": description,
            "status": "New",
            "priority": priority,
            "origin": "Web",
            "owner": "Unassigned",
            "accountId": account_id,
            "accountName": "Unknown Account",
            "contactId": "",
            "contactName": "",
            "email": "",
            "phone": "",
            "createdDate": now,
            "lastModifiedDate": now,
        }

        # Store for later retrieval / updates
        self._cases_store[case_id] = new_case

        return new_case.copy()

    async def update_case(
        self, case_id: str, fields: dict[str, Any]
    ) -> dict[str, Any]:
        """
        Update fields on an existing case.

        Args:
            case_id: The case ID to update
            fields: Dict of field names to new values

        Returns:
            The updated case dict

        Raises:
            ValueError: If case_id is unknown
        """
        if self.mode == "http":
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.patch(
                    f"{self.base_url}/cases/{case_id}", json=fields
                )
                if response.status_code == 404:
                    raise ValueError(f"Case not found: {case_id}")
                response.raise_for_status()
                return response.json()

        # ── mock mode ─────────────────────────────────────────
        now = datetime.now(timezone.utc).isoformat()

        # Check stored cases first
        if case_id in self._cases_store:
            self._cases_store[case_id].update(fields)
            self._cases_store[case_id]["lastModifiedDate"] = now
            return self._cases_store[case_id].copy()

        # Check if it matches a valid mock case pattern
        if case_id.startswith("500") and len(case_id) == 9:
            index = int(case_id[3:]) % len(_COMPANY_NAMES)
            case = self._build_mock_case(index)
            case.update(fields)
            case["lastModifiedDate"] = now
            # Store updated case
            self._cases_store[case_id] = case
            return case.copy()

        raise ValueError(f"Case not found: {case_id}")

    async def escalate_case(
        self, case_id: str, reason: str, requested_action: str | None = None
    ) -> dict[str, Any]:
        """
        Escalate a case with a reason.

        Args:
            case_id: The case ID to escalate
            reason: The reason for escalation
            requested_action: Optional requested action for the escalation

        Returns:
            Escalation result dict

        Raises:
            ValueError: If case_id is unknown
        """
        if self.mode == "http":
            payload: dict[str, str] = {"reason": reason}
            if requested_action:
                payload["requestedAction"] = requested_action
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/cases/{case_id}/escalate", json=payload
                )
                if response.status_code == 404:
                    raise ValueError(f"Case not found: {case_id}")
                response.raise_for_status()
                return response.json()

        # ── mock mode ─────────────────────────────────────────
        # Validate case_id exists
        try:
            await self.get_case_details(case_id)
        except ValueError:
            raise ValueError(f"Case not found: {case_id}")

        now = datetime.now(timezone.utc).isoformat()

        return {
            "caseId": case_id,
            "reason": reason,
            "escalatedBy": "System",
            "escalatedAt": now,
            "status": "Escalated",
            "priority": "High",
        }

    async def send_reply(
        self, case_id: str, message: str, channel: str = "email"
    ) -> dict[str, Any]:
        """
        Send a reply to the customer on an existing case.

        Args:
            case_id: The case ID to reply to
            message: The reply message content
            channel: Delivery channel ('email', 'portal', 'chat')

        Returns:
            Reply confirmation dict

        Raises:
            ValueError: If case_id is unknown
        """
        if self.mode == "http":
            payload: dict[str, str] = {"message": message, "channel": channel}
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.base_url}/cases/{case_id}/reply", json=payload
                )
                if response.status_code == 404:
                    raise ValueError(f"Case not found: {case_id}")
                response.raise_for_status()
                return response.json()

        # ── mock mode ─────────────────────────────────────────
        try:
            await self.get_case_details(case_id)
        except ValueError:
            raise ValueError(f"Case not found: {case_id}")

        now = datetime.now(timezone.utc).isoformat()

        return {
            "caseId": case_id,
            "channel": channel,
            "sentAt": now,
            "status": "delivered",
        }
