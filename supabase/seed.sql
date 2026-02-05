-- Seed Data for Multi-tenant Customer Support Intelligence System

-- =====================================================
-- SAMPLE ORGANIZATION
-- =====================================================

INSERT INTO organizations (id, name, slug, domain, plan_tier, settings)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'Acme Support Corp',
    'acme-support',
    'acme-support.com',
    'enterprise',
    '{
        "business_hours": {"start": "09:00", "end": "18:00", "timezone": "America/New_York"},
        "sla_response_time": 60,
        "sla_resolution_time": 480,
        "auto_assignment": true,
        "ai_enabled": true,
        "custom_fields": ["order_id", "product_category"]
    }'::jsonb
);

-- =====================================================
-- SAMPLE USERS (All Roles)
-- =====================================================

-- Owner
INSERT INTO users (id, organization_id, email, full_name, role, is_active, department)
VALUES (
    'u0000001-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'john.owner@acme-support.com',
    'John Smith',
    'owner',
    TRUE,
    'Executive'
);

-- Admin
INSERT INTO users (id, organization_id, email, full_name, role, is_active, department)
VALUES (
    'u0000002-0000-0000-0000-000000000002',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'sarah.admin@acme-support.com',
    'Sarah Johnson',
    'admin',
    TRUE,
    'Management'
);

-- Supervisor
INSERT INTO users (id, organization_id, email, full_name, role, is_active, department)
VALUES (
    'u0000003-0000-0000-0000-000000000003',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'mike.supervisor@acme-support.com',
    'Mike Chen',
    'supervisor',
    TRUE,
    'Support'
);

-- Agents
INSERT INTO users (id, organization_id, email, full_name, role, is_active, department)
VALUES
    (
        'u0000004-0000-0000-0000-000000000004',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'emma.agent@acme-support.com',
        'Emma Wilson',
        'agent',
        TRUE,
        'Support'
    ),
    (
        'u0000005-0000-0000-0000-000000000005',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'david.agent@acme-support.com',
        'David Brown',
        'agent',
        TRUE,
        'Support'
    ),
    (
        'u0000006-0000-0000-0000-000000000006',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'lisa.agent@acme-support.com',
        'Lisa Anderson',
        'agent',
        FALSE,
        'Support'
    );

-- Viewer
INSERT INTO users (id, organization_id, email, full_name, role, is_active, department)
VALUES (
    'u0000007-0000-0000-0000-000000000007',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'tom.viewer@acme-support.com',
    'Tom Martinez',
    'viewer',
    TRUE,
    'Sales'
);

-- =====================================================
-- SAMPLE CUSTOMERS
-- =====================================================

INSERT INTO customers (id, organization_id, email, phone, full_name, company_name, tags, total_spent, total_orders, average_order_value, customer_since, last_purchase_at)
VALUES
    (
        'c0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'alice@example.com',
        '+1-555-0101',
        'Alice Thompson',
        'TechCorp Inc',
        ARRAY['enterprise', 'high-value'],
        15420.50,
        12,
        1285.04,
        '2023-01-15 10:30:00+00',
        '2024-12-01 14:22:00+00'
    ),
    (
        'c0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'bob@example.com',
        '+1-555-0102',
        'Bob Johnson',
        'StartupXYZ',
        ARRAY['startup', 'fast-growth'],
        3280.00,
        5,
        656.00,
        '2023-06-20 09:15:00+00',
        '2024-11-15 16:45:00+00'
    ),
    (
        'c0000003-0000-0000-0000-000000000003',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'carol@example.com',
        '+1-555-0103',
        'Carol Davis',
        'DesignStudio',
        ARRAY['creative', 'repeat'],
        892.50,
        3,
        297.50,
        '2024-02-10 11:00:00+00',
        '2024-10-20 13:30:00+00'
    ),
    (
        'c0000004-0000-0000-0000-000000000004',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'daniel@example.com',
        '+1-555-0104',
        'Daniel Kim',
        'DataDriven LLC',
        ARRAY['technical', 'premium'],
        24500.00,
        8,
        3062.50,
        '2022-11-05 08:45:00+00',
        '2024-12-03 10:15:00+00'
    ),
    (
        'c0000005-0000-0000-0000-000000000005',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'emma@example.com',
        '+1-555-0105',
        'Emma White',
        'RetailGroup',
        ARRAY['retail', 'returning'],
        1250.00,
        15,
        83.33,
        '2024-05-18 14:20:00+00',
        '2024-11-28 17:00:00+00'
    );

-- =====================================================
-- SAMPLE ORDERS
-- =====================================================

INSERT INTO orders (id, organization_id, customer_id, order_number, external_order_id, status, subtotal, tax, shipping, discount, total, currency, items, shipping_address)
VALUES
    (
        'o0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000001-0000-0000-0000-000000000001',
        'ORD-2024-001',
        'SHOP-88521',
        'delivered',
        1250.00,
        112.50,
        25.00,
        0.00,
        1387.50,
        'USD',
        '[
            {"product_id": "PROD-001", "name": "Premium Widget", "quantity": 2, "price": 500.00},
            {"product_id": "PROD-002", "name": "Standard Gadget", "quantity": 5, "price": 50.00}
        ]'::jsonb,
        '{"street": "123 Tech Ave", "city": "San Francisco", "state": "CA", "zip": "94105", "country": "USA"}'::jsonb
    ),
    (
        'o0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000002-0000-0000-0000-000000000002',
        'ORD-2024-002',
        'SHOP-89012',
        'shipped',
        656.00,
        59.04,
        15.00,
        65.60,
        664.44,
        'USD',
        '[
            {"product_id": "PROD-003", "name": "Startup Bundle", "quantity": 1, "price": 656.00}
        ]'::jsonb,
        '{"street": "456 Innovation Blvd", "city": "Austin", "state": "TX", "zip": "78701", "country": "USA"}'::jsonb
    ),
    (
        'o0000003-0000-0000-0000-000000000003',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000003-0000-0000-0000-000000000003',
        'ORD-2024-003',
        'SHOP-89543',
        'processing',
        297.50,
        26.78,
        10.00,
        0.00,
        334.28,
        'USD',
        '[
            {"product_id": "PROD-004", "name": "Design Tools Pack", "quantity": 1, "price": 297.50}
        ]'::jsonb,
        '{"street": "789 Creative Lane", "city": "Los Angeles", "state": "CA", "zip": "90001", "country": "USA"}'::jsonb
    ),
    (
        'o0000004-0000-0000-0000-000000000004',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000004-0000-0000-0000-000000000004',
        'ORD-2024-004',
        'SHOP-90102',
        'cancelled',
        3062.50,
        275.63,
        0.00,
        306.25,
        3031.88,
        'USD',
        '[
            {"product_id": "PROD-005", "name": "Enterprise Suite", "quantity": 1, "price": 3062.50}
        ]'::jsonb,
        '{"street": "321 Data Drive", "city": "Seattle", "state": "WA", "zip": "98101", "country": "USA"}'::jsonb
    ),
    (
        'o0000005-0000-0000-0000-000000000005',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000005-0000-0000-0000-000000000005',
        'ORD-2024-005',
        'SHOP-90567',
        'delivered',
        83.33,
        7.50,
        5.99,
        0.00,
        96.82,
        'USD',
        '[
            {"product_id": "PROD-006", "name": "Accessory Pack", "quantity": 3, "price": 27.78}
        ]'::jsonb,
        '{"street": "555 Retail Road", "city": "Chicago", "state": "IL", "zip": "60601", "country": "USA"}'::jsonb
    );

-- =====================================================
-- SAMPLE TICKETS
-- =====================================================

INSERT INTO tickets (
    id, organization_id, customer_id, order_id, assigned_agent_id,
    subject, description, status, priority, channel, tags,
    sentiment, sentiment_score, sentiment_confidence,
    satisfaction_rating, first_response_at, first_response_time_seconds,
    resolved_at, resolution_time_seconds, last_message_at,
    ai_summary, created_at
)
VALUES
    (
        't0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000001-0000-0000-0000-000000000001',
        'o0000001-0000-0000-0000-000000000001',
        'u0000004-0000-0000-0000-000000000004',
        'Premium Widget not working properly',
        'I purchased two Premium Widgets last week and one of them is making a strange buzzing noise. The other works fine. This is very disappointing for the price I paid.',
        'resolved',
        'high',
        'email',
        ARRAY['hardware-issue', 'premium-customer'],
        'negative',
        0.15,
        0.92,
        4,
        '2024-12-02 09:15:00+00',
        45,
        '2024-12-02 14:30:00+00',
        19140,
        '2024-12-02 14:30:00+00',
        'Customer reported defective Premium Widget with buzzing noise. Replacement unit shipped and refund for expedited shipping provided.',
        '2024-12-02 09:14:00+00'
    ),
    (
        't0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000002-0000-0000-0000-000000000002',
        'o0000002-0000-0000-0000-000000000002',
        'u0000005-0000-0000-0000-000000000005',
        'Startup Bundle activation issues',
        'I just received my Startup Bundle but the activation key is not working. I have tried multiple times following the documentation but keep getting an error.',
        'in_progress',
        'medium',
        'chat',
        ARRAY['activation', 'software'],
        'neutral',
        0.50,
        0.75,
        NULL,
        '2024-11-15 17:00:00+00',
        15,
        NULL,
        NULL,
        '2024-11-16 10:30:00+00',
        'Customer unable to activate Startup Bundle. Investigating key validation issue with engineering team.',
        '2024-11-15 16:45:00+00'
    ),
    (
        't0000003-0000-0000-0000-000000000003',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000003-0000-0000-0000-000000000003',
        'o0000003-0000-0000-0000-000000000003',
        'u0000004-0000-0000-0000-000000000004',
        'Question about bulk order discount',
        'Hello! I absolutely love your Design Tools Pack and want to order 10 more for my team. Is there a bulk order discount available? Thanks!',
        'pending',
        'low',
        'email',
        ARRAY['sales', 'bulk-order'],
        'positive',
        0.85,
        0.88,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        '2024-11-20 11:30:00+00',
        'Inquiry about bulk order discount for Design Tools Pack. Awaiting sales team consultation.',
        '2024-11-20 11:00:00+00'
    ),
    (
        't0000004-0000-0000-0000-000000000004',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000004-0000-0000-0000-000000000004',
        'o0000004-0000-0000-0000-000000000004',
        'u0000003-0000-0000-0000-000000000003',
        'URGENT: Enterprise Suite refund request',
        'Our company decided to go with a different solution. We need an immediate full refund for the Enterprise Suite. This was a significant investment for us and we are very disappointed.',
        'open',
        'urgent',
        'phone',
        ARRAY['refund', 'enterprise', 'cancellation'],
        'negative',
        0.10,
        0.95,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        '2024-12-03 10:00:00+00',
        'High-value customer requesting full refund for Enterprise Suite. Requires supervisor approval. Need to review cancellation policy.',
        '2024-12-03 10:15:00+00'
    ),
    (
        't0000005-0000-0000-0000-000000000005',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000005-0000-0000-0000-000000000005',
        'o0000005-0000-0000-0000-000000000005',
        'u0000005-0000-0000-0000-000000000005',
        'Missing item in my order',
        'I received my order but one of the accessories is missing from the package. The packing slip shows it should be there. Please help!',
        'closed',
        'medium',
        'email',
        ARRAY['missing-item', 'shipping'],
        'negative',
        0.35,
        0.82,
        5,
        '2024-11-28 17:30:00+00',
        30,
        '2024-11-29 09:00:00+00',
        55800,
        '2024-11-29 09:00:00+00',
        'Missing accessory confirmed. Replacement shipped overnight with complimentary expedited delivery.',
        '2024-11-28 17:05:00+00'
    ),
    (
        't0000006-0000-0000-0000-000000000006',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000001-0000-0000-0000-000000000001',
        NULL,
        'u0000004-0000-0000-0000-000000000004',
        'General product inquiry',
        'What are the system requirements for your upcoming Pro version? Planning our 2025 upgrade.',
        'open',
        'low',
        'web',
        ARRAY['product-inquiry', 'pre-sales'],
        'positive',
        0.70,
        0.65,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        '2024-12-05 08:00:00+00',
        'Pre-sales inquiry about upcoming Pro version system requirements. Product roadmap information requested.',
        '2024-12-05 08:00:00+00'
    );

-- =====================================================
-- SAMPLE MESSAGES
-- =====================================================

INSERT INTO messages (ticket_id, organization_id, author_id, author_type, content, content_html, is_internal, attachments, created_at)
VALUES
    -- Ticket 1 messages
    (
        't0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000001-0000-0000-0000-000000000001',
        'customer',
        'I purchased two Premium Widgets last week and one of them is making a strange buzzing noise. The other works fine. This is very disappointing for the price I paid.',
        '<p>I purchased two Premium Widgets last week and one of them is making a strange buzzing noise. The other works fine. This is very disappointing for the price I paid.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-12-02 09:14:00+00'
    ),
    (
        't0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000004-0000-0000-0000-000000000004',
        'agent',
        'Hi Alice, I am truly sorry to hear about this issue with your Premium Widget. I completely understand your frustration. Let me help resolve this immediately. Could you please provide the serial number from the buzzing widget so I can check if there is a known issue with that batch? In the meantime, I have already initiated a replacement order for you.',
        '<p>Hi Alice, I am truly sorry to hear about this issue with your Premium Widget. I completely understand your frustration. Let me help resolve this immediately. Could you please provide the serial number from the buzzing widget so I can check if there is a known issue with that batch? In the meantime, I have already initiated a replacement order for you.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-12-02 09:15:00+00'
    ),
    (
        't0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000001-0000-0000-0000-000000000001',
        'customer',
        'Thank you for the quick response. The serial number is SW-2024-1105-8852. I really appreciate you expediting the replacement.',
        '<p>Thank you for the quick response. The serial number is SW-2024-1105-8852. I really appreciate you expediting the replacement.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-12-02 10:30:00+00'
    ),
    (
        't0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000004-0000-0000-0000-000000000004',
        'agent',
        'I found that this unit is part of a batch that had some quality control issues. I have processed a full replacement and also applied a $25 credit to your account for the expedited shipping. The replacement should arrive within 2 business days.',
        '<p>I found that this unit is part of a batch that had some quality control issues. I have processed a full replacement and also applied a $25 credit to your account for the expedited shipping. The replacement should arrive within 2 business days.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-12-02 12:00:00+00'
    ),
    (
        't0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000001-0000-0000-0000-000000000001',
        'customer',
        'That is excellent service! Thank you so much for taking care of this. You have definitely restored my faith in your company.',
        '<p>That is excellent service! Thank you so much for taking care of this. You have definitely restored my faith in your company.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-12-02 14:25:00+00'
    ),

    -- Ticket 2 messages
    (
        't0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000002-0000-0000-0000-000000000002',
        'customer',
        'I just received my Startup Bundle but the activation key is not working. I have tried multiple times following the documentation but keep getting an error.',
        '<p>I just received my Startup Bundle but the activation key is not working. I have tried multiple times following the documentation but keep getting an error.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-11-15 16:45:00+00'
    ),
    (
        't0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000005-0000-0000-0000-000000000005',
        'agent',
        'Hello Bob! I am sorry you are running into activation issues. Let me look into this right away. Could you tell me what specific error message you are seeing?',
        '<p>Hello Bob! I am sorry you are running into activation issues. Let me look into this right away. Could you tell me what specific error message you are seeing?</p>',
        FALSE,
        '[]'::jsonb,
        '2024-11-15 17:00:00+00'
    ),
    (
        't0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000002-0000-0000-0000-000000000002',
        'customer',
        'The error says "Invalid license key. Please contact support." I have double-checked that I am typing it correctly.',
        '<p>The error says "Invalid license key. Please contact support." I have double-checked that I am typing it correctly.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-11-15 22:30:00+00'
    ),
    (
        't0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        NULL,
        'ai',
        'AI Analysis: The activation key may have been mistyped during fulfillment or there could be a database sync issue. Recommend generating a new activation key and sending directly to customer email.',
        '<p>AI Analysis: The activation key may have been mistyped during fulfillment or there could be a database sync issue. Recommend generating a new activation key and sending directly to customer email.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-11-16 09:00:00+00'
    ),
    (
        't0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000003-0000-0000-0000-000000000003',
        'agent',
        'I have escalated this to our engineering team to investigate the activation system. They are running diagnostics now. I will update you within 2 hours with a solution.',
        '<p>I have escalated this to our engineering team to investigate the activation system. They are running diagnostics now. I will update you within 2 hours with a solution.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-11-16 10:30:00+00'
    ),

    -- Ticket 4 messages (internal note)
    (
        't0000004-0000-0000-0000-000000000004',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000004-0000-0000-0000-000000000004',
        'customer',
        'Our company decided to go with a different solution. We need an immediate full refund for the Enterprise Suite. This was a significant investment for us and we are very disappointed.',
        '<p>Our company decided to go with a different solution. We need an immediate full refund for the Enterprise Suite. This was a significant investment for us and we are very disappointed.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-12-03 10:15:00+00'
    ),
    (
        't0000004-0000-0000-0000-000000000004',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000003-0000-0000-0000-000000000003',
        'supervisor',
        '[INTERNAL] Customer is within 30-day refund window (purchased Nov 5). Enterprise policy allows full refund with documentation of decision. Need Mike to review and approve.',
        '<p><strong>[INTERNAL]</strong> Customer is within 30-day refund window (purchased Nov 5). Enterprise policy allows full refund with documentation of decision. Need Mike to review and approve.</p>',
        TRUE,
        '[]'::jsonb,
        '2024-12-03 10:30:00+00'
    ),

    -- Ticket 5 messages
    (
        't0000005-0000-0000-0000-000000000005',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000005-0000-0000-0000-000000000005',
        'customer',
        'I received my order but one of the accessories is missing from the package. The packing slip shows it should be there. Please help!',
        '<p>I received my order but one of the accessories is missing from the package. The packing slip shows it should be there. Please help!</p>',
        FALSE,
        '[]'::jsonb,
        '2024-11-28 17:05:00+00'
    ),
    (
        't0000005-0000-0000-0000-000000000005',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000005-0000-0000-0000-000000000005',
        'agent',
        'Hi Emma, I am so sorry about the missing item! This should never happen. I have verified your order and confirmed the missing accessory. I am shipping a replacement right now with overnight delivery at no extra charge. You should receive it by tomorrow.',
        '<p>Hi Emma, I am so sorry about the missing item! This should never happen. I have verified your order and confirmed the missing accessory. I am shipping a replacement right now with overnight delivery at no extra charge. You should receive it by tomorrow.</p>',
        FALSE,
        '[]'::jsonb,
        '2024-11-28 17:30:00+00'
    ),
    (
        't0000005-0000-0000-0000-000000000005',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'c0000005-0000-0000-0000-000000000005',
        'customer',
        'Wow, that was fast! Thank you so much for the quick response and overnight shipping. You saved my weekend project!',
        '<p>Wow, that was fast! Thank you so much for the quick response and overnight shipping. You saved my weekend project!</p>',
        FALSE,
        '[]'::jsonb,
        '2024-11-28 18:00:00+00'
    ),
    (
        't0000005-0000-0000-0000-000000000005',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000005-0000-0000-0000-000000000005',
        'agent',
        'You are very welcome! I am glad I could help. I have marked this ticket as resolved. If you need anything else, please do not hesitate to reach out. Have a great weekend!',
        '<p>You are very welcome! I am glad I could help. I have marked this ticket as resolved. If you need anything else, please do not hesitate to reach out. Have a great weekend!</p>',
        FALSE,
        '[]'::jsonb,
        '2024-11-29 09:00:00+00'
    );

-- =====================================================
-- SAMPLE REFUNDS
-- =====================================================

INSERT INTO refunds (id, organization_id, order_id, customer_id, ticket_id, requested_by_id, approved_by_id, amount, currency, reason, status, notes, processed_at, created_at)
VALUES
    (
        'r0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'o0000004-0000-0000-0000-000000000004',
        'c0000004-0000-0000-0000-000000000004',
        't0000004-0000-0000-0000-000000000004',
        'u0000003-0000-0000-0000-000000000003',
        NULL,
        3062.50,
        'USD',
        'Customer decided to use a different solution. Within 30-day refund window.',
        'pending',
        'Awaiting supervisor approval. Enterprise policy Section 4.2 applies.',
        NULL,
        '2024-12-03 11:00:00+00'
    ),
    (
        'r0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'o0000001-0000-0000-0000-000000000001',
        'c0000001-0000-0000-0000-000000000001',
        't0000001-0000-0000-0000-000000000001',
        'u0000004-0000-0000-0000-000000000004',
        'u0000002-0000-0000-0000-000000000002',
        25.00,
        'USD',
        'Expedited shipping credit for defective product',
        'processed',
        'Refund to original payment method. Customer acknowledged.',
        '2024-12-02 15:00:00+00',
        '2024-12-02 14:30:00+00'
    );

-- =====================================================
-- SAMPLE KNOWLEDGE ARTICLES
-- =====================================================

INSERT INTO knowledge_articles (id, organization_id, title, slug, content, content_html, excerpt, category, tags, status, author_id, view_count, helpful_count, published_at, created_at)
VALUES
    (
        'k0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'How to Activate Your Startup Bundle',
        'how-to-activate-startup-bundle',
        'This guide will walk you through the activation process for your Startup Bundle. Follow these steps to get started:\n\n1. Locate your activation key in the welcome email\n2. Visit https://activate.acme-support.com\n3. Enter your activation key exactly as shown\n4. Create your account credentials\n5. Verify your email address\n\nIf you encounter any issues, please contact support.',
        '<h2>Activation Guide</h2><p>This guide will walk you through the activation process for your Startup Bundle. Follow these steps to get started:</p><ol><li>Locate your activation key in the welcome email</li><li>Visit https://activate.acme-support.com</li><li>Enter your activation key exactly as shown</li><li>Create your account credentials</li><li>Verify your email address</li></ol><p>If you encounter any issues, please contact support.</p>',
        'Step-by-step guide to activating your Startup Bundle',
        'Onboarding',
        ARRAY['activation', 'startup', 'setup'],
        'published',
        'u0000002-0000-0000-0000-000000000002',
        1250,
        1180,
        '2024-01-15 10:00:00+00',
        '2024-01-10 08:00:00+00'
    ),
    (
        'k0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'Refund and Return Policy',
        'refund-return-policy',
        'Our refund policy is designed with customer satisfaction in mind:\n\n30-Day Money-Back Guarantee\n- Products can be returned within 30 days of purchase for a full refund\n- Item must be in original packaging with all accessories\n\nDefective Products\n- Defective products can be exchanged at any time\n- No restocking fee for defective items\n\nEnterprise Customers\n- Custom refund terms available for enterprise agreements\n- Contact your account manager for details\n\nRefunds are processed within 5-7 business days.',
        '<h2>Refund and Return Policy</h2><p>Our refund policy is designed with customer satisfaction in mind:</p><h3>30-Day Money-Back Guarantee</h3><ul><li>Products can be returned within 30 days of purchase for a full refund</li><li>Item must be in original packaging with all accessories</li></ul><h3>Defective Products</h3><ul><li>Defective products can be exchanged at any time</li><li>No restocking fee for defective items</li></ul><h3>Enterprise Customers</h3><ul><li>Custom refund terms available for enterprise agreements</li><li>Contact your account manager for details</li></ul><p>Refunds are processed within 5-7 business days.</p>',
        'Complete guide to our refund and return policies',
        'Policies',
        ARRAY['refund', 'returns', 'policy'],
        'published',
        'u0000002-0000-0000-0000-000000000002',
        3420,
        3100,
        '2024-01-01 00:00:00+00',
        '2023-12-15 08:00:00+00'
    ),
    (
        'k0000003-0000-0000-0000-000000000003',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'Troubleshooting Premium Widget Issues',
        'troubleshooting-premium-widget',
        'If your Premium Widget is not functioning correctly, try these troubleshooting steps:\n\n1. Power Cycle\n   - Turn off the device and unplug it for 30 seconds\n   - Reconnect and power on\n\n2. Check Connections\n   - Ensure all cables are securely connected\n   - Try a different power outlet\n\n3. Update Firmware\n   - Connect to the companion app\n   - Check for and install any firmware updates\n\n4. Reset to Factory Settings\n   - Press and hold the reset button for 10 seconds\n   - Reconfigure from scratch\n\nIf issues persist after these steps, please contact support.',
        '<h2>Troubleshooting Premium Widget</h2><p>If your Premium Widget is not functioning correctly, try these troubleshooting steps:</p><h3>1. Power Cycle</h3><ul><li>Turn off the device and unplug it for 30 seconds</li><li>Reconnect and power on</li></ul><h3>2. Check Connections</h3><ul><li>Ensure all cables are securely connected</li><li>Try a different power outlet</li></ul><h3>3. Update Firmware</h3><ul><li>Connect to the companion app</li><li>Check for and install any firmware updates</li></ul><h3>4. Reset to Factory Settings</h3><ul><li>Press and hold the reset button for 10 seconds</li><li>Reconfigure from scratch</li></ul><p>If issues persist after these steps, please contact support.</p>',
        'Common fixes for Premium Widget problems',
        'Troubleshooting',
        ARRAY['premium-widget', 'troubleshooting', 'hardware'],
        'published',
        'u0000004-0000-0000-0000-000000000004',
        890,
        756,
        '2024-06-01 10:00:00+00',
        '2024-05-20 08:00:00+00'
    ),
    (
        'k0000004-0000-0000-0000-000000000004',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'Bulk Order Discounts',
        'bulk-order-discounts',
        'Planning a large purchase? We offer competitive discounts for bulk orders:\n\nVolume Tiers:\n- 5-9 units: 10% off\n- 10-24 units: 15% off\n- 25-49 units: 20% off\n- 50+ units: Contact us for custom pricing\n\nAdditional Benefits:\n- Free expedited shipping on orders over $1,000\n- Dedicated account manager for orders over $10,000\n- Extended warranty options available\n\nTo request a bulk quote, please contact our sales team or use the quote request form in your dashboard.',
        '<h2>Bulk Order Discounts</h2><p>Planning a large purchase? We offer competitive discounts for bulk orders:</p><h3>Volume Tiers:</h3><ul><li>5-9 units: <strong>10% off</strong></li><li>10-24 units: <strong>15% off</strong></li><li>25-49 units: <strong>20% off</strong></li><li>50+ units: Contact us for custom pricing</li></ul><h3>Additional Benefits:</h3><ul><li>Free expedited shipping on orders over $1,000</li><li>Dedicated account manager for orders over $10,000</li><li>Extended warranty options available</li></ul><p>To request a bulk quote, please contact our sales team or use the quote request form in your dashboard.</p>',
        'Volume discounts for large orders',
        'Sales',
        ARRAY['bulk', 'discounts', 'sales'],
        'published',
        'u0000002-0000-0000-0000-000000000002',
        456,
        398,
        '2024-02-01 10:00:00+00',
        '2024-01-25 08:00:00+00'
    ),
    (
        'k0000005-0000-0000-0000-000000000005',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'Enterprise Suite Overview',
        'enterprise-suite-overview',
        '[DRAFT - Internal Review Required]\n\nEnterprise Suite is our comprehensive solution designed for large organizations with advanced needs.\n\nKey Features:\n- Unlimited users and departments\n- Advanced analytics and reporting\n- Custom integrations and API access\n- Dedicated support channel\n- 99.99% SLA\n- On-premise deployment option\n\nThis document is for internal use only. External customers should refer to the public product page.',
        '<h2>Enterprise Suite Overview</h2><p><strong>[DRAFT - Internal Review Required]</strong></p><p>Enterprise Suite is our comprehensive solution designed for large organizations with advanced needs.</p><h3>Key Features:</h3><ul><li>Unlimited users and departments</li><li>Advanced analytics and reporting</li><li>Custom integrations and API access</li><li>Dedicated support channel</li><li>99.99% SLA</li><li>On-premise deployment option</li></ul><p>This document is for internal use only. External customers should refer to the public product page.</p>',
        'Internal draft - Enterprise Suite features',
        'Internal',
        ARRAY['enterprise', 'internal'],
        'draft',
        'u0000001-0000-0000-0000-000000000001',
        0,
        0,
        NULL,
        '2024-12-01 08:00:00+00'
    );

-- =====================================================
-- SAMPLE AUDIT LOGS
-- =====================================================

INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at)
VALUES
    (
        'a0000001-0000-0000-0000-000000000001',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000004-0000-0000-0000-000000000004',
        'ticket.created',
        'ticket',
        't0000001-0000-0000-0000-000000000001',
        NULL,
        '{"subject": "Premium Widget not working properly", "priority": "high", "status": "open"}'::jsonb,
        '192.168.1.100',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        '2024-12-02 09:14:00+00'
    ),
    (
        'a0000002-0000-0000-0000-000000000002',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000004-0000-0000-0000-000000000004',
        'ticket.assigned',
        'ticket',
        't0000001-0000-0000-0000-000000000001',
        '{"assigned_agent_id": null}'::jsonb,
        '{"assigned_agent_id": "u0000004-0000-0000-0000-000000000004"}'::jsonb,
        '192.168.1.100',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        '2024-12-02 09:14:05+00'
    ),
    (
        'a0000003-0000-0000-0000-000000000003',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000004-0000-0000-0000-000000000004',
        'ticket.status_changed',
        'ticket',
        't0000001-0000-0000-0000-000000000001',
        '{"status": "open"}'::jsonb,
        '{"status": "resolved"}'::jsonb,
        '192.168.1.100',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        '2024-12-02 14:30:00+00'
    ),
    (
        'a0000004-0000-0000-0000-000000000004',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000002-0000-0000-0000-000000000002',
        'refund.approved',
        'refund',
        'r0000002-0000-0000-0000-000000000002',
        '{"status": "pending"}'::jsonb,
        '{"status": "processed"}'::jsonb,
        '192.168.1.105',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        '2024-12-02 15:00:00+00'
    ),
    (
        'a0000005-0000-0000-0000-000000000005',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000003-0000-0000-0000-000000000003',
        'ticket.assigned',
        'ticket',
        't0000004-0000-0000-0000-000000000004',
        '{"assigned_agent_id": null}'::jsonb,
        '{"assigned_agent_id": "u0000003-0000-0000-0000-000000000003"}'::jsonb,
        '192.168.1.103',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        '2024-12-03 10:20:00+00'
    ),
    (
        'a0000006-0000-0000-0000-000000000006',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000005-0000-0000-0000-000000000005',
        'message.created',
        'message',
        'm0000005-0000-0000-0000-000000000005',
        NULL,
        '{"content": "[INTERNAL] Customer is within 30-day refund window..."}'::jsonb,
        '192.168.1.104',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        '2024-12-03 10:30:00+00'
    ),
    (
        'a0000007-0000-0000-0000-000000000007',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'u0000003-0000-0000-0000-000000000003',
        'refund.created',
        'refund',
        'r0000001-0000-0000-0000-000000000001',
        NULL,
        '{"amount": 3062.50, "reason": "Customer decided to use a different solution"}'::jsonb,
        '192.168.1.103',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        '2024-12-03 11:00:00+00'
    );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- SELECT 'Organizations created' AS entity, COUNT(*) AS count FROM organizations;
-- SELECT 'Users created' AS entity, COUNT(*) AS count FROM users;
-- SELECT 'Customers created' AS entity, COUNT(*) AS count FROM customers;
-- SELECT 'Orders created' AS entity, COUNT(*) AS count FROM orders;
-- SELECT 'Tickets created' AS entity, COUNT(*) AS count FROM tickets;
-- SELECT 'Messages created' AS entity, COUNT(*) AS count FROM messages;
-- SELECT 'Refunds created' AS entity, COUNT(*) AS count FROM refunds;
-- SELECT 'KB Articles created' AS entity, COUNT(*) AS count FROM knowledge_articles;
-- SELECT 'Audit Logs created' AS entity, COUNT(*) AS count FROM audit_logs;
