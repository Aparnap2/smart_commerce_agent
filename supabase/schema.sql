-- Multi-tenant Customer Support Intelligence System Schema
-- PostgreSQL with Row Level Security (RLS) for tenant isolation

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'supervisor', 'agent', 'viewer');

CREATE TYPE ticket_status AS ENUM ('open', 'pending', 'in_progress', 'resolved', 'closed', 'reopened');

CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE sentiment_type AS ENUM ('positive', 'neutral', 'negative', 'mixed');

CREATE TYPE message_author_type AS ENUM ('customer', 'agent', 'system', 'ai');

CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'rejected', 'processed');

-- =====================================================
-- ORGANIZATIONS (Multi-tenancy Anchor)
-- =====================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    plan_tier VARCHAR(50) DEFAULT 'starter',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role user_role DEFAULT 'agent',
    is_active BOOLEAN DEFAULT TRUE,
    department VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_user_email_org UNIQUE (email, organization_id)
);

CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- =====================================================
-- CUSTOMERS
-- =====================================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}',
    tags TEXT[],
    total_spent DECIMAL(12, 2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    average_order_value DECIMAL(12, 2) DEFAULT 0,
    customer_since TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_purchase_at TIMESTAMP WITH TIME ZONE,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_customer_email_org UNIQUE (email, organization_id)
);

CREATE INDEX idx_customers_organization ON customers(organization_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- =====================================================
-- ORDERS
-- =====================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_number VARCHAR(100) NOT NULL,
    external_order_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax DECIMAL(12, 2) DEFAULT 0,
    shipping DECIMAL(12, 2) DEFAULT 0,
    discount DECIMAL(12, 2) DEFAULT 0,
    total DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    items JSONB DEFAULT '[]',
    shipping_address JSONB,
    billing_address JSONB,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fulfilled_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_order_number_org UNIQUE (order_number, organization_id)
);

CREATE INDEX idx_orders_organization ON orders(organization_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_ordered_at ON orders(ordered_at DESC);
CREATE INDEX idx_orders_external_id ON orders(external_order_id);

-- =====================================================
-- TICKETS
-- =====================================================

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    subject VARCHAR(500) NOT NULL,
    description TEXT,
    status ticket_status DEFAULT 'open',
    priority ticket_priority DEFAULT 'medium',
    channel VARCHAR(50) DEFAULT 'email',
    tags TEXT[],
    sentiment sentiment_type,
    sentiment_score DECIMAL(4, 3),
    sentiment_confidence DECIMAL(4, 3),
    satisfaction_rating INTEGER,
    first_response_at TIMESTAMP WITH TIME ZONE,
    first_response_time_seconds INTEGER,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_time_seconds INTEGER,
    last_message_at TIMESTAMP WITH TIME ZONE,
    ai_suggestions JSONB DEFAULT '[]',
    ai_summary TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tickets_organization ON tickets(organization_id);
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
CREATE INDEX idx_tickets_assigned_agent ON tickets(assigned_agent_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX idx_tickets_sentiment ON tickets(sentiment);

-- =====================================================
-- MESSAGES
-- =====================================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_id UUID,
    author_type message_author_type NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT,
    is_internal BOOLEAN DEFAULT FALSE,
    attachments JSONB DEFAULT '[]',
    ai_generated BOOLEAN DEFAULT FALSE,
    ai_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_ticket ON messages(ticket_id);
CREATE INDEX idx_messages_organization ON messages(organization_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_author ON messages(author_id, author_type);

-- =====================================================
-- REFUNDS
-- =====================================================

CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    refund_number VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    reason TEXT,
    status refund_status DEFAULT 'pending',
    notes TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refunds_organization ON refunds(organization_id);
CREATE INDEX idx_refunds_order ON refunds(order_id);
CREATE INDEX idx_refunds_customer ON refunds(customer_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_created_at ON refunds(created_at DESC);

-- =====================================================
-- KNOWLEDGE ARTICLES (RAG)
-- =====================================================

CREATE TABLE knowledge_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    content_html TEXT,
    excerpt TEXT,
    category VARCHAR(100),
    tags TEXT[],
    status VARCHAR(50) DEFAULT 'draft',
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    embedding_vector VECTOR(1536),
    metadata JSONB DEFAULT '{}',
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kb_articles_organization ON knowledge_articles(organization_id);
CREATE INDEX idx_kb_articles_status ON knowledge_articles(status);
CREATE INDEX idx_kb_articles_category ON knowledge_articles(category);
CREATE INDEX idx_kb_articles_created_at ON knowledge_articles(created_at DESC);
CREATE INDEX idx_kb_articles_slug ON knowledge_articles(slug);
CREATE INDEX idx_kb_articles_embedding ON knowledge_articles USING ivfflat (embedding_vector vector_cosine_ops)
  WITH (lists = 100);

-- =====================================================
-- AUDIT LOGS (Compliance)
-- =====================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- RLS POLICIES (Row Level Security)
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can view their own organization
CREATE POLICY "Users can view their organization" ON organizations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = organizations.id
            AND users.id = auth.uid()
        )
    );

-- Organizations: Owners/Admins can update their organization
CREATE POLICY "Owners/Admins can update organization" ON organizations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = organizations.id
            AND users.id = auth.uid()
            AND users.role IN ('owner', 'admin')
        )
    );

-- Users: Users can view other users in their organization
CREATE POLICY "Users can view organization users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users AS u
            WHERE u.organization_id = users.organization_id
            AND u.id = auth.uid()
        )
    );

-- Users: Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- Users: Admins can create new users
CREATE POLICY "Admins can create users" ON users
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users AS u
            WHERE u.organization_id = users.organization_id
            AND u.id = auth.uid()
            AND u.role IN ('owner', 'admin')
        )
    );

-- Customers: View access for all org members
CREATE POLICY "Org members can view customers" ON customers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = customers.organization_id
            AND users.id = auth.uid()
        )
    );

-- Customers: Create access for org members
CREATE POLICY "Org members can create customers" ON customers
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = customers.organization_id
            AND users.id = auth.uid()
        )
    );

-- Orders: View access for org members
CREATE POLICY "Org members can view orders" ON orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = orders.organization_id
            AND users.id = auth.uid()
        )
    );

-- Tickets: View access for org members
CREATE POLICY "Org members can view tickets" ON tickets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = tickets.organization_id
            AND users.id = auth.uid()
        )
    );

-- Tickets: Agents can create/update tickets
CREATE POLICY "Agents can manage tickets" ON tickets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = tickets.organization_id
            AND users.id = auth.uid()
            AND users.role IN ('owner', 'admin', 'supervisor', 'agent')
        )
    );

-- Messages: View access for org members
CREATE POLICY "Org members can view messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = messages.organization_id
            AND users.id = auth.uid()
        )
    );

-- Messages: Agents can create messages
CREATE POLICY "Agents can create messages" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = messages.organization_id
            AND users.id = auth.uid()
            AND users.role IN ('owner', 'admin', 'supervisor', 'agent')
        )
    );

-- Refunds: View access for org members
CREATE POLICY "Org members can view refunds" ON refunds
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = refunds.organization_id
            AND users.id = auth.uid()
        )
    );

-- Refunds: Admins/Supervisors can manage refunds
CREATE POLICY "Admins/Supervisors can manage refunds" ON refunds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = refunds.organization_id
            AND users.id = auth.uid()
            AND users.role IN ('owner', 'admin', 'supervisor')
        )
    );

-- Knowledge Articles: View published articles publicly
CREATE POLICY "Anyone can view published KB articles" ON knowledge_articles
    FOR SELECT USING (
        status = 'published'
        OR EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = knowledge_articles.organization_id
            AND users.id = auth.uid()
        )
    );

-- Knowledge Articles: Admins can manage KB
CREATE POLICY "Admins can manage KB articles" ON knowledge_articles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = knowledge_articles.organization_id
            AND users.id = auth.uid()
            AND users.role IN ('owner', 'admin')
        )
    );

-- Audit Logs: View access for org members
CREATE POLICY "Org members can view audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = audit_logs.organization_id
            AND users.id = auth.uid()
        )
    );

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to auto-update updated_at columns
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
CREATE TRIGGER set_organizations_timestamp
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_customers_timestamp
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_orders_timestamp
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_tickets_timestamp
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_messages_timestamp
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_refunds_timestamp
    BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_kb_articles_timestamp
    BEFORE UPDATE ON knowledge_articles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_number IS NULL THEN
        NEW.ticket_number := 'TKT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
            LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ticket_number
    BEFORE INSERT ON tickets
    FOR EACH ROW EXECUTE FUNCTION generate_ticket_number();

-- Function to generate refund number
CREATE OR REPLACE FUNCTION generate_refund_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.refund_number IS NULL THEN
        NEW.refund_number := 'REF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
            LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_refund_number
    BEFORE INSERT ON refunds
    FOR EACH ROW EXECUTE FUNCTION generate_refund_number();

-- =====================================================
-- VIEWS
-- =====================================================

-- Ticket summary view
CREATE OR REPLACE VIEW ticket_summary AS
SELECT
    o.id AS organization_id,
    o.name AS organization_name,
    t.status,
    t.priority,
    COUNT(*) AS ticket_count,
    AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600)::DECIMAL(10,2) AS avg_resolution_hours,
    AVG(t.satisfaction_rating) AS avg_satisfaction,
    COUNT(CASE WHEN t.sentiment = 'negative' THEN 1 END) AS negative_sentiment_count
FROM tickets t
JOIN organizations o ON o.id = t.organization_id
GROUP BY o.id, o.name, t.status, t.priority;

-- Agent performance view
CREATE OR REPLACE VIEW agent_performance AS
SELECT
    o.id AS organization_id,
    o.name AS organization_name,
    u.id AS agent_id,
    u.full_name AS agent_name,
    COUNT(DISTINCT t.id) AS total_tickets,
    COUNT(DISTINCT CASE WHEN t.status IN ('resolved', 'closed') THEN t.id END) AS resolved_tickets,
    AVG(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60)::DECIMAL(10,2) AS avg_first_response_minutes,
    AVG(t.satisfaction_rating) AS avg_rating
FROM users u
JOIN organizations o ON o.id = u.organization_id
LEFT JOIN tickets t ON t.assigned_agent_id = u.id
WHERE u.role IN ('agent', 'supervisor')
GROUP BY o.id, o.name, u.id, u.full_name;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE organizations IS 'Multi-tenant organizations - root entity for data isolation';
COMMENT ON TABLE users IS 'Organization users with role-based access control';
COMMENT ON TABLE customers IS 'Customer profiles linked to organizations';
COMMENT ON TABLE orders IS 'E-commerce orders linked to customers';
COMMENT ON TABLE tickets IS 'Support tickets with sentiment analysis and AI metadata';
COMMENT ON TABLE messages IS 'Ticket messages with author attribution';
COMMENT ON TABLE refunds IS 'Refund requests linked to orders and tickets';
COMMENT ON TABLE knowledge_articles IS 'Knowledge base articles for RAG-powered support';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for compliance';
