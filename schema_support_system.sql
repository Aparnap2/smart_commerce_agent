-- Customer Support Intelligence System Schema
-- PostgreSQL Multi-Tenant Database with RLS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ORGANIZATIONS (Multi-tenancy root)
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    settings JSONB DEFAULT '{}',
    subscription_tier VARCHAR(50) DEFAULT 'free',
    max_agents INTEGER DEFAULT 5,
    max_customers INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USERS (Agents, admins, supervisors)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url VARCHAR(500),
    role VARCHAR(20) NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'supervisor', 'agent', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

-- =====================================================
-- CUSTOMERS
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company VARCHAR(255),
    avatar_url VARCHAR(500),
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

-- =====================================================
-- PRODUCTS
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(12, 2) NOT NULL,
    cost DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, sku)
);

-- =====================================================
-- ORDERS
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    order_number VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    quantity INTEGER DEFAULT 1,
    subtotal DECIMAL(12, 2),
    tax DECIMAL(12, 2),
    shipping DECIMAL(12, 2),
    total DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    shipping_address JSONB,
    billing_address JSONB,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    ordered_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, order_number)
);

-- =====================================================
-- REFUNDS
-- =====================================================
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    reason VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed', 'failed')),
    processed_by UUID REFERENCES users(id),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TICKETS
-- =====================================================
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    ticket_number VARCHAR(50) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed', 'archived')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    category VARCHAR(100),
    channel VARCHAR(50) DEFAULT 'email' CHECK (channel IN ('email', 'chat', 'phone', 'web', 'api', 'social')),
    tags TEXT[] DEFAULT '{}',
    satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    sla_due_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, ticket_number)
);

-- =====================================================
-- MESSAGES (Conversation in tickets)
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system', 'bot')),
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'html', 'markdown')),
    is_internal BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- COUNTERS (Atomic sequences for multi-tenant entities)
-- =====================================================
CREATE TABLE IF NOT EXISTS ticket_counters (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    counter BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_counters (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    counter BIGINT NOT NULL DEFAULT 0
);

-- =====================================================
-- KNOWLEDGE ARTICLES
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, slug)
);

-- =====================================================
-- AUDIT LOGS (Track all changes for compliance)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES (Performance optimization)
-- =====================================================

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_organization ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(last_name, first_name);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_organization ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_organization ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_ordered ON orders(ordered_at);

-- Refunds indexes
CREATE INDEX IF NOT EXISTS idx_refunds_organization ON refunds(organization_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_customer ON refunds(customer_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- Tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_organization ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_agent ON tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_sla ON tickets(sla_due_at);
CREATE INDEX IF NOT EXISTS idx_tickets_tags ON tickets USING GIN(tags);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_type, sender_id);

-- Knowledge articles indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_organization ON knowledge_articles(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_articles(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_tags ON knowledge_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_title ON knowledge_articles(title);
CREATE INDEX IF NOT EXISTS idx_knowledge_published ON knowledge_articles(published_at);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_organization ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- =====================================================
-- RLS POLICIES (Row Level Security for Multi-tenancy)
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Organizations: Users can only see and modify their own organization
CREATE POLICY "organizations_select_policy" ON organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id FROM users 
            WHERE id = current_setting('app.current_user_id', true)::UUID
        )
    );

CREATE POLICY "organizations_insert_policy" ON organizations
    FOR INSERT WITH CHECK (
        id IN (
            SELECT organization_id FROM users 
            WHERE id = current_setting('app.current_user_id', true)::UUID
        )
    );

CREATE POLICY "organizations_update_policy" ON organizations
    FOR UPDATE USING (
        id IN (
            SELECT organization_id FROM users 
            WHERE id = current_setting('app.current_user_id', true)::UUID
        )
    );

-- Users: Users can only access users in their organization
CREATE POLICY "users_select_policy" ON users
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "users_insert_policy" ON users
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "users_update_policy" ON users
    FOR UPDATE USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

-- Customers: Same organization access
CREATE POLICY "customers_select_policy" ON customers
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "customers_insert_policy" ON customers
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "customers_update_policy" ON customers
    FOR UPDATE USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

-- Products: Same organization access
CREATE POLICY "products_select_policy" ON products
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "products_insert_policy" ON products
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "products_update_policy" ON products
    FOR UPDATE USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

-- Orders: Same organization access
CREATE POLICY "orders_select_policy" ON orders
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "orders_insert_policy" ON orders
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "orders_update_policy" ON orders
    FOR UPDATE USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

-- Refunds: Same organization access
CREATE POLICY "refunds_select_policy" ON refunds
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "refunds_insert_policy" ON refunds
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "refunds_update_policy" ON refunds
    FOR UPDATE USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

-- Tickets: Same organization access (with special rules for customers)
CREATE POLICY "tickets_select_policy" ON tickets
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID)
        OR customer_id = current_setting('app.current_customer_id', true)::UUID
    );

CREATE POLICY "tickets_insert_policy" ON tickets
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "tickets_update_policy" ON tickets
    FOR UPDATE USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

-- Messages: Same organization access
CREATE POLICY "messages_select_policy" ON messages
    FOR SELECT USING (ticket_id IN (
        SELECT id FROM tickets WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
        )
    ));

CREATE POLICY "messages_insert_policy" ON messages
    FOR INSERT WITH CHECK (ticket_id IN (
        SELECT id FROM tickets WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
        )
    ));

CREATE POLICY "messages_update_policy" ON messages
    FOR UPDATE USING (ticket_id IN (
        SELECT id FROM tickets WHERE organization_id IN (
            SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
        )
    ));

-- Knowledge articles: Published articles visible to all
CREATE POLICY "knowledge_select_policy" ON knowledge_articles
    FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID)
        OR status = 'published'
    );

CREATE POLICY "knowledge_insert_policy" ON knowledge_articles
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "knowledge_update_policy" ON knowledge_articles
    FOR UPDATE USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

-- Audit logs: Same organization access (admin only typically)
CREATE POLICY "audit_select_policy" ON audit_logs
    FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

CREATE POLICY "audit_insert_policy" ON audit_logs
    FOR INSERT WITH CHECK (organization_id IN (
        SELECT organization_id FROM users WHERE id = current_setting('app.current_user_id', true)::UUID
    ));

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON refunds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_updated_at BEFORE UPDATE ON knowledge_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate ticket number function (atomic)
CREATE OR REPLACE FUNCTION generate_ticket_number(organization_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    next_val BIGINT;
    org_mod TEXT;
    year_part TEXT;
    month_part TEXT;
BEGIN
    -- Atomically increment the counter for this organization
    INSERT INTO ticket_counters (organization_id, counter) 
    VALUES (organization_id, 1)
    ON CONFLICT (organization_id) 
    DO UPDATE SET counter = ticket_counters.counter + 1
    RETURNING counter INTO next_val;

    -- Build the ticket number components
    org_mod := LPAD((organization_id::TEXT::BIGINT % 1000000)::TEXT, 6, '0');
    year_part := EXTRACT(YEAR FROM NOW())::TEXT;
    month_part := LPAD(EXTRACT(MONTH FROM NOW())::TEXT, 2, '0');

    -- Format: TKT-{org_mod}-{year}{month}{counter:6d}
    RETURN 'TKT-' || org_mod || '-' || year_part || month_part || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Generate order number function (atomic)
CREATE OR REPLACE FUNCTION generate_order_number(organization_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    next_val BIGINT;
BEGIN
    -- Atomically increment the counter for this organization
    INSERT INTO order_counters (organization_id, counter) 
    VALUES (organization_id, 1)
    ON CONFLICT (organization_id) 
    DO UPDATE SET counter = order_counters.counter + 1
    RETURNING counter INTO next_val;

    -- Format: ORD-{YYYYMMDD}-{counter:6d}
    RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(next_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS
-- =====================================================

-- Ticket summary view
CREATE OR REPLACE VIEW ticket_summaries AS
SELECT
    t.id,
    t.organization_id,
    t.ticket_number,
    t.subject,
    t.status,
    t.priority,
    t.category,
    t.channel,
    t.tags,
    t.satisfaction_rating,
    t.created_at,
    t.first_response_at,
    t.resolved_at,
    t.closed_at,
    t.sla_due_at,
    c.id AS customer_id,
    c.email AS customer_email,
    c.first_name AS customer_first_name,
    c.last_name AS customer_last_name,
    u.id AS agent_id,
    u.email AS agent_email,
    u.first_name AS agent_first_name,
    u.last_name AS agent_last_name,
    (SELECT COUNT(*) FROM messages WHERE ticket_id = t.id) AS message_count,
    (SELECT created_at FROM messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
FROM tickets t
LEFT JOIN customers c ON t.customer_id = c.id
LEFT JOIN users u ON t.assigned_agent_id = u.id;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE organizations IS 'Multi-tenant organizations - root entity for customer support instances';
COMMENT ON TABLE users IS 'Support team members with roles: owner, admin, supervisor, agent, viewer';
COMMENT ON TABLE customers IS 'End customers who create support tickets';
COMMENT ON TABLE products IS 'Products sold by organizations for reference in tickets';
COMMENT ON TABLE orders IS 'Customer orders linked to products and refunds';
COMMENT ON TABLE refunds IS 'Refund requests linked to orders';
COMMENT ON TABLE tickets IS 'Support tickets with status lifecycle: open -> pending -> resolved -> closed -> archived';
COMMENT ON TABLE messages IS 'Conversation messages within tickets';
COMMENT ON TABLE knowledge_articles IS 'Internal knowledge base articles';
COMMENT ON TABLE audit_logs IS 'Complete audit trail for compliance and debugging';

COMMENT ON COLUMN tickets.status IS 'Ticket lifecycle: open(in progress), pending(waiting on customer), resolved(solved), closed(finished), archived(archived)';
COMMENT ON COLUMN tickets.priority IS 'Urgency level: low, medium, high, urgent';
COMMENT ON COLUMN tickets.channel IS 'Origin of ticket: email, chat, phone, web, api, social';
