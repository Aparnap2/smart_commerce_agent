-- Migration 006: Add SupportPilot tables for salesforce customer support cockpit
-- Spec: SupportPilot Phase 1 — Support Schema Migration
--
-- This migration is additive. All existing procurement tables remain untouched.
-- New support tables: SupportConversation, CaseReference, EscalationRequest,
-- KnowledgeArticle, SlaPolicy.
--
-- Run against your database:
--   psql -U supabase_admin -d postgres -f migrations/006_add_support_tables.sql
-- Or via Docker:
--   docker exec -i supabase-db psql -U supabase_admin -d postgres < migrations/006_add_support_tables.sql

-- Ensure pgvector extension for embedding column on KnowledgeArticle
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- ============================================================
-- TABLE: SupportConversation
-- Tracks customer support chat sessions / conversations
-- ============================================================

CREATE TABLE IF NOT EXISTS "SupportConversation" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    user_id TEXT REFERENCES users(id),
    salesforce_case_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE "SupportConversation" IS 'Customer support chat sessions initiated via the SupportPilot cockpit. Each conversation tracks interaction context, status lifecycle, and links to a Salesforce case.';
COMMENT ON COLUMN "SupportConversation".id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN "SupportConversation".title IS 'Human-readable conversation label (e.g. "Order delay inquiry #1234")';
COMMENT ON COLUMN "SupportConversation".status IS 'Current lifecycle state: open, pending, resolved, closed';
COMMENT ON COLUMN "SupportConversation".user_id IS 'FK to the support agent or customer who initiated the conversation';
COMMENT ON COLUMN "SupportConversation".salesforce_case_id IS 'Corresponding Salesforce case identifier for cross-referencing';
COMMENT ON COLUMN "SupportConversation".created_at IS 'Timestamp of conversation creation';
COMMENT ON COLUMN "SupportConversation".updated_at IS 'Timestamp of last conversation update';

-- ============================================================
-- TABLE: CaseReference
-- Cached Salesforce case data for fast lookup without API round-trips
-- ============================================================

CREATE TABLE IF NOT EXISTS "CaseReference" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES "SupportConversation"(id),
    salesforce_case_id TEXT NOT NULL,
    case_number TEXT,
    subject TEXT,
    status TEXT,
    priority TEXT,
    owner TEXT,
    account_id TEXT,
    contact_id TEXT,
    last_synced_at TIMESTAMPTZ
);

COMMENT ON TABLE "CaseReference" IS 'Cached snapshot of Salesforce case data. Minimizes API calls by storing frequently accessed fields locally. Refreshed on-demand via sync trigger.';
COMMENT ON COLUMN "CaseReference".id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN "CaseReference".conversation_id IS 'FK to the SupportConversation this case reference belongs to';
COMMENT ON COLUMN "CaseReference".salesforce_case_id IS 'Unique Salesforce case identifier (NOT NULL — required for cross-reference)';
COMMENT ON COLUMN "CaseReference".case_number IS 'Human-readable case number from Salesforce (e.g. 00001234)';
COMMENT ON COLUMN "CaseReference".subject IS 'Case subject line as entered in Salesforce';
COMMENT ON COLUMN "CaseReference".status IS 'Case status from Salesforce (New, Working, Escalated, Closed)';
COMMENT ON COLUMN "CaseReference".priority IS 'Case priority (Low, Medium, High, Critical)';
COMMENT ON COLUMN "CaseReference".owner IS 'Name of the assigned Salesforce case owner';
COMMENT ON COLUMN "CaseReference".account_id IS 'Salesforce Account ID associated with this case';
COMMENT ON COLUMN "CaseReference".contact_id IS 'Salesforce Contact ID associated with this case';
COMMENT ON COLUMN "CaseReference".last_synced_at IS 'Timestamp of the most recent sync from Salesforce API';

-- ============================================================
-- TABLE: EscalationRequest
-- Human-in-the-loop (HITL) approval requests for case escalations
-- ============================================================

CREATE TABLE IF NOT EXISTS "EscalationRequest" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES "CaseReference"(id),
    reason TEXT NOT NULL,
    requested_action TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by TEXT REFERENCES users(id),
    decided_by UUID,
    decision TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE "EscalationRequest" IS 'Human-in-the-loop escalation requests. When the AI agent determines a case needs supervisor judgment, it creates an EscalationRequest for manual review and approval.';
COMMENT ON COLUMN "EscalationRequest".id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN "EscalationRequest".case_id IS 'FK to the CaseReference being escalated';
COMMENT ON COLUMN "EscalationRequest".reason IS 'Detailed explanation of why escalation is needed (NOT NULL)';
COMMENT ON COLUMN "EscalationRequest".requested_action IS 'Suggested action for the reviewer (e.g. "Approve refund of $250")';
COMMENT ON COLUMN "EscalationRequest".status IS 'Escalation lifecycle: pending, approved, rejected, cancelled';
COMMENT ON COLUMN "EscalationRequest".requested_by IS 'FK to the user who requested the escalation';
COMMENT ON COLUMN "EscalationRequest".decided_by IS 'FK to the user who made the decision (set when status changes from pending)';
COMMENT ON COLUMN "EscalationRequest".decision IS 'Decision notes from the reviewer';
COMMENT ON COLUMN "EscalationRequest".decided_at IS 'Timestamp when a decision was made (null while pending)';
COMMENT ON COLUMN "EscalationRequest".created_at IS 'Timestamp of escalation request creation';

-- ============================================================
-- TABLE: KnowledgeArticle
-- RAG source documents for AI-powered support answers
-- ============================================================

CREATE TABLE IF NOT EXISTS "KnowledgeArticle" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    salesforce_article_id TEXT,
    embedding vector(1536),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE "KnowledgeArticle" IS 'Knowledge base articles used as RAG (Retrieval-Augmented Generation) source material. The AI agent retrieves relevant articles via semantic search on the embedding column to answer customer queries.';
COMMENT ON COLUMN "KnowledgeArticle".id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN "KnowledgeArticle".title IS 'Article title (NOT NULL — required for display in search results)';
COMMENT ON COLUMN "KnowledgeArticle".content IS 'Full article body text (NOT NULL — the primary RAG source)';
COMMENT ON COLUMN "KnowledgeArticle".category IS 'Article category for faceted browsing (e.g. Shipping, Returns, Billing)';
COMMENT ON COLUMN "KnowledgeArticle".salesforce_article_id IS 'Optional Salesforce Knowledge article ID for cross-reference';
COMMENT ON COLUMN "KnowledgeArticle".embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions) for semantic similarity search';
COMMENT ON COLUMN "KnowledgeArticle".created_at IS 'Timestamp of article creation';

-- ============================================================
-- TABLE: SlaPolicy
-- Service Level Agreement definitions mapped to case priorities
-- ============================================================

CREATE TABLE IF NOT EXISTS "SlaPolicy" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    priority TEXT NOT NULL,
    response_hours INTEGER NOT NULL,
    resolution_hours INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE "SlaPolicy" IS 'SLA policy definitions that drive escalation triggers. Each policy maps a case priority to target response and resolution times. The AI agent checks SLA compliance when handling cases.';
COMMENT ON COLUMN "SlaPolicy".id IS 'Auto-generated UUID primary key';
COMMENT ON COLUMN "SlaPolicy".name IS 'Policy display name (e.g. "Premium Support", "Standard Support")';
COMMENT ON COLUMN "SlaPolicy".priority IS 'Matching case priority (Critical, High, Medium, Low)';
COMMENT ON COLUMN "SlaPolicy".response_hours IS 'Target response time in hours (integer, NOT NULL)';
COMMENT ON COLUMN "SlaPolicy".resolution_hours IS 'Target resolution time in hours (integer, NOT NULL)';
COMMENT ON COLUMN "SlaPolicy".created_at IS 'Timestamp of policy creation';
