

------

## PRD Overview

**Product name:** SupportPilot

**One-line description:** An AI-powered customer support workspace that helps support agents search Salesforce, retrieve customer context, draft replies, create and update cases, and escalate to humans with approval-style HITL checkpoints.[youtube](https://www.youtube.com/watch?v=v5iSo5fglV8)[help.salesforce](https://help.salesforce.com/s/articleView?id=release-notes.rn_asp_ga.htm&language=es&release=254&type=5)

**Primary audience:** Support agents, team leads, and support ops teams at B2B SaaS companies that use Salesforce Service Cloud. Salesforce case management is explicitly built around collecting, tracking, assigning, and resolving customer issues in one system.speridian+1

**Portfolio goal:** Demonstrate applied AI, agentic workflows, legacy system integration, RAG over support knowledge, and production-quality GenUI.[help.salesforce](https://help.salesforce.com/s/articleView?id=release-notes.rn_asp_ga.htm&language=es&release=254&type=5)[youtube](https://www.youtube.com/watch?v=36tz6V_7Xpc)

------

## Core Experience

The product starts as a chat-style support cockpit. A user can type a customer issue, search Salesforce cases, inspect account history, find similar past tickets, draft a response, and create or update a case without leaving the interface. Salesforce support flows commonly include case creation, case tracking, severity changes, and transcript-backed summaries, which makes this interaction model feel native to the platform.[help.salesforce](https://help.salesforce.com/s/articleView?id=release-notes.rn_einstein_create_case_with_enhanced_data.htm&language=sv&release=256&type=5)[youtube](https://www.youtube.com/watch?v=v5iSo5fglV8)

The agent should be able to answer questions like:

- “Show me open cases for Acme.”
- “Summarize the last three cases from this customer.”
- “Draft a reply and create a case.”
- “Escalate this to tier 2.”
- “What is the status of case 00012345?”[youtube](https://www.youtube.com/watch?v=v5iSo5fglV8)[speridian](https://speridian.com/blogs/the-top-features-of-salesforce-case-management/)

------

## Functional Scope

## F1 — Authentication and session

- Email/password login.
- Supabase session for the web app.
- Role-aware routing for support agent, team lead, support ops, and admin.
- Session context must include user id, role, queue/team, and Salesforce org mapping.

## F2 — Support chat workspace

- Main chat at `/support`.
- Conversational entry for all support actions.
- Persistent conversation history.
- Streaming assistant responses.
- Reply drafts shown as editable GenUI cards.

## F3 — Salesforce case search

- Search Salesforce cases by customer name, email, case number, subject, status, priority, and owner.
- Support natural language queries and structured filters.
- Return case lists in a `CaseListCard` GenUI component.

## F4 — Salesforce customer context

- Fetch account, contact, and case history.
- Show customer tier, open cases, last reply date, and recent interactions.
- Summarize customer context in a `CustomerContextCard`.

## F5 — Similar ticket retrieval

- Search past resolved cases and knowledge articles.
- Use RAG over internal support docs and case transcripts.
- Return concise suggestions with citations or supporting snippets.

## F6 — Draft reply generation

- Generate a suggested reply grounded in case data and KB context.
- Human can edit before sending.
- Draft appears in a `ReplyDraftCard`.

## F7 — Case creation and update

- Create cases from chat.
- Update subject, description, priority, status, owner, and comments.
- Support transcript attachment where available.
- Case creation flow should mirror Salesforce support patterns that ask for issue details and produce a structured case summary.[youtube](https://www.youtube.com/watch?v=OUxtejvgL7Y)[help.salesforce](https://help.salesforce.com/s/articleView?id=release-notes.rn_einstein_create_case_with_enhanced_data.htm&language=sv&release=256&type=5)

## F8 — Escalation and HITL

- Certain actions require confirmation before execution:
  - closing a case,
  - escalating priority,
  - reassigning ownership,
  - sending an external reply.
- Use interrupt/resume workflow for human approval.
- Show a clear approval card before mutation.

## F9 — Team lead dashboard

- Pending escalations.
- SLA risk view.
- Open cases by queue.
- Recent agent actions.
- Cases awaiting approval or manual review.

## F10 — Support ops dashboard

- Case volume trend.
- Resolution time.
- SLA compliance.
- Case categories.
- Escalation rate.
- Knowledge article effectiveness.

## F11 — Notifications

- Notify team leads on escalations.
- Notify agents on approvals or case updates.
- Notify ops on SLA breach risk.
- Display real-time notification bell in the UI.

## F12 — Third-party integrations

- Salesforce REST API for Cases, Accounts, Contacts, and Notes.
- Salesforce SOQL search for records.
- Knowledge base retrieval from internal documents.
- Optional Jira integration for engineering escalations.
- Optional email or Slack handoff for follow-ups.

## F13 — Observability and audit

- Log every tool call.
- Save agent traces.
- Capture approval decisions.
- Capture failed queries and fallback behavior.
- Use Langfuse or equivalent tracing.

## F14 — Evaluation harness

- Unit tests for UI states.
- Integration tests for Salesforce tool calls.
- E2E tests for login, search, draft reply, create case, and escalation.
- Eval set for ambiguous support scenarios.

## F15 — Security and permissions

- Support agents can search and draft.
- Team leads can approve escalations and case changes.
- Admin can manage mappings and integrations.
- Tool access is filtered by role.
- Sensitive customer data is never exposed outside authorized views.

------

## Tooling Spec

## Required agent tools

- `search_salesforce_cases(query, filters)`
- `get_case_details(case_id)`
- `get_customer_context(account_or_contact_id)`
- `search_similar_tickets(query)`
- `search_knowledge_base(query)`
- `draft_case_reply(case_id, context)`
- `create_case(subject, description, priority, account_id)`
- `update_case(case_id, fields)`
- `escalate_case(case_id, reason)`
- `send_case_reply(case_id, message)`
- `link_jira_issue(case_id, summary)` optional

Salesforce’s own docs and integrations support case search, case creation, and agent workflows, and LangChain has Salesforce integration docs available for tool building.docs.langchain+2

------

## GenUI Components

- `CaseListCard`
- `CustomerContextCard`
- `ReplyDraftCard`
- `EscalationCard`
- `SlaGauge`
- `SupportOpsChart`
- `NotificationBell`

Every component must handle loading, empty, null, and error states gracefully.

------

## Data Model

## Core records

- User
- SupportConversation
- CaseReference
- CaseActionLog
- EscalationRequest
- KnowledgeArticle
- Notification
- EvalRun

## Key fields

- `salesforce_case_id`
- `case_number`
- `account_id`
- `contact_id`
- `priority`
- `status`
- `owner`
- `sla_due_at`
- `last_synced_at`
- `approval_required`

------

## Non-functional Requirements

- P95 tool response under 3 seconds for cached reads.
- P95 under 8 seconds for live Salesforce calls.
- Graceful fallback when Salesforce API is slow or unavailable.
- All writes must be idempotent.
- All external data should be cached with TTL where appropriate.
- Streaming UI must remain usable on mobile and desktop.

Salesforce Developer Edition is available for testing and development, so this can be built against a real org without needing production access.developer.salesforce+1

------

## MVP Cut

For the portfolio version, the MVP should include:

- Login and role-based routing.
- Search Salesforce cases.
- Fetch customer context.
- Search knowledge base and similar tickets.
- Draft reply generation.
- Create/update case.
- Escalation with human approval.
- Team lead dashboard.
- Notification bell.
- Observability and tests.

That is enough to demonstrate an FDE-grade system with real enterprise integration, agentic reasoning, and polished UX.careers.salesforce+2

------

## Out of Scope

- Full omnichannel inbox.
- Omnichannel routing engine.
- Voice support.
- Multilingual support.
- Deep Salesforce customization beyond standard objects.
- Complex forecasting or revenue analytics.
- Mobile app.

These can come later, but they are unnecessary for the portfolio goal.

