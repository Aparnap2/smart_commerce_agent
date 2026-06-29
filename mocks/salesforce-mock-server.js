#!/usr/bin/env node
/**
 * Mock Salesforce API Server for SupportPilot Integration Testing
 *
 * Backs MockSalesforceClient HTTP mode (apps/agent-core/src/salesforce/client.py).
 * Run: node mocks/salesforce-mock-server.js
 */

import http from 'http';
import { URL } from 'url';

const PORT = parseInt(process.env.MOCK_PORT || '3002', 10);

// ── Realistic Mock Data (mirrors apps/agent-core/src/salesforce/client.py) ──

const COMPANY_NAMES = [
  'Acme Corp',
  'GlobalTech Inc',
  'Meridian Health',
  'Pacific Northwest Logistics',
  'Summit Ridge Energy',
];

const CASE_SUBJECTS = [
  'Login issue after password reset',
  'Payment not processed for invoice INV-2026-0042',
  'API rate limit exceeded',
  'Data sync failure between Salesforce and ERP',
  'User unable to access dashboard after upgrade',
];

const CASE_DESCRIPTIONS = [
  "User reports that after resetting their password via the 'Forgot Password' link, the new password is not being accepted by the login portal. The error message indicates 'Invalid credentials' despite multiple reset attempts.",
  'Invoice INV-2026-0042 was marked as paid in the accounting system, but the payment has not been reflected in the Salesforce billing module. Payment gateway confirmation ID is TXN-9876-5432.',
  'The integration with the third-party analytics service is exceeding the allocated API rate limit of 1000 requests per hour. This is causing intermittent failures in the reporting dashboard during peak usage hours.',
  'Scheduled data synchronization between Salesforce and the ERP system failed at 02:30 UTC. The sync log shows a connection timeout error when attempting to retrieve updated inventory records from the ERP endpoint.',
  'After the latest platform upgrade to version 4.2, the user is unable to access the analytics dashboard. The page loads but displays a spinner indefinitely. Clearing browser cache and using incognito mode did not resolve the issue.',
];

const STATUSES = ['Open', 'In Progress', 'Escalated', 'Closed', 'Pending Customer Response'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const ORIGINS = ['Phone', 'Email', 'Web', 'Chat', 'Social Media'];

const OWNERS = [
  'Sarah Chen',
  'Mike Rodriguez',
  'Emily Watson',
  'James Thompson',
  'Priya Sharma',
];

const ACCOUNT_NAMES = [
  'Acme Corp',
  'GlobalTech Inc',
  'Meridian Health',
  'Pacific Northwest Logistics',
  'Summit Ridge Energy',
];

const CONTACT_NAMES = [
  'John Smith',
  'Lisa Park',
  'Robert Kim',
  'Amanda Foster',
  'Carlos Mendez',
];

const CONTACT_EMAILS = [
  'john.smith@acme.com',
  'lisa.park@globaltech.io',
  'robert.kim@meridian.health',
  'amanda.foster@pacificnw.com',
  'carlos.mendez@sre.com',
];

const CONTACT_TITLES = [
  'IT Operations Manager',
  'VP of Engineering',
  'Chief Medical Officer',
  'Logistics Director',
  'Head of Energy Trading',
];

const DEPARTMENTS = ['Information Technology', 'Engineering', 'Medical', 'Logistics', 'Trading'];

const INDUSTRIES = ['Technology', 'Healthcare', 'Logistics', 'Energy', 'Finance'];

const BILLING_CITIES = ['San Francisco', 'Austin', 'Chicago', 'Seattle', 'Denver'];

const CUSTOMER_TIERS = ['Premium', 'Standard', 'Enterprise', 'Basic', 'Premium'];

const KNOWLEDGE_ARTICLES = [
  {
    articleId: 'KA-001',
    title: 'Troubleshooting Login Issues After Password Reset',
    contentExcerpt: 'If you are unable to log in after resetting your password, please ensure that the new password meets the complexity requirements: at least 8 characters, one uppercase letter, one number, and one special character. Clear your browser cache and try again.',
    category: 'Authentication',
    url: 'https://help.acme.com/articles/KA-001',
    lastReviewedDate: '2026-03-15',
  },
  {
    articleId: 'KA-002',
    title: 'Payment Gateway Integration Troubleshooting',
    contentExcerpt: 'When payments fail to sync between the billing module and Salesforce, first verify the webhook configuration in the payment gateway settings. Ensure the endpoint URL is correct and the SSL certificate is valid.',
    category: 'Billing',
    url: 'https://help.acme.com/articles/KA-002',
    lastReviewedDate: '2026-04-02',
  },
  {
    articleId: 'KA-003',
    title: 'API Rate Limit Best Practices',
    contentExcerpt: 'To avoid hitting API rate limits, implement exponential backoff in your integration clients. The default rate limit is 1000 requests per hour per API key. Monitor your usage via the Developer Dashboard.',
    category: 'Integration',
    url: 'https://help.acme.com/articles/KA-003',
    lastReviewedDate: '2026-02-20',
  },
  {
    articleId: 'KA-004',
    title: 'Data Sync Failure Resolution Guide',
    contentExcerpt: 'When Salesforce-to-ERP data synchronization fails, check the connection status, verify API credentials, and review the sync error logs. Common causes include network timeouts and schema changes on the ERP side.',
    category: 'Integration',
    url: 'https://help.acme.com/articles/KA-004',
    lastReviewedDate: '2026-05-10',
  },
  {
    articleId: 'KA-005',
    title: 'Dashboard Access After Platform Upgrade',
    contentExcerpt: 'If the analytics dashboard fails to load after a platform upgrade, verify that browser extensions are not interfering, clear the application cache, and confirm your user role has the appropriate dashboard permissions.',
    category: 'Platform',
    url: 'https://help.acme.com/articles/KA-005',
    lastReviewedDate: '2026-05-01',
  },
];

// ── In-Memory Case Store ──

/** @type {Object<string, object>} */
const casesStore = {};
let caseCounter = 0;

function generateCaseNumber() {
  caseCounter += 1;
  const year = new Date().getFullYear();
  return `CAS-${year}-${String(caseCounter).padStart(4, '0')}`;
}

function buildMockCase(index, subjectOverride, statusOverride, priorityOverride) {
  const now = new Date().toISOString();
  const caseId = `500${String(index).padStart(6, '0')}`;
  const company = COMPANY_NAMES[index % COMPANY_NAMES.length];
  const contact = CONTACT_NAMES[index % CONTACT_NAMES.length];
  const email = CONTACT_EMAILS[index % CONTACT_EMAILS.length];
  const owner = OWNERS[index % OWNERS.length];

  return {
    id: caseId,
    caseNumber: generateCaseNumber(),
    subject: subjectOverride || CASE_SUBJECTS[index % CASE_SUBJECTS.length],
    description: CASE_DESCRIPTIONS[index % CASE_DESCRIPTIONS.length],
    status: statusOverride || STATUSES[index % STATUSES.length],
    priority: priorityOverride || PRIORITIES[index % PRIORITIES.length],
    origin: ORIGINS[index % ORIGINS.length],
    owner: owner,
    accountId: `acc-${String(index + 1).padStart(3, '0')}`,
    accountName: company,
    contactId: `con-${String(index + 1).padStart(3, '0')}`,
    contactName: contact,
    email: email,
    phone: `+1-555-${String(1000 + index).padStart(4, '0')}`,
    createdDate: '2026-04-01T08:00:00Z',
    lastModifiedDate: now,
  };
}

function findCaseById(caseId) {
  // Check in-memory store first
  if (casesStore[caseId]) {
    return casesStore[caseId];
  }

  // Check if it matches a valid mock case pattern (500xxxxxx)
  if (/^500\d{6}$/.test(caseId)) {
    const index = parseInt(caseId.slice(3), 10) % COMPANY_NAMES.length;
    return buildMockCase(index);
  }

  return null;
}

// ── Request Body Parser ──

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ── Route Matching Helpers ──

function pathMatch(pattern, pathname) {
  // Convert :param patterns to regex
  const regexStr = pattern.replace(/:(\w+)/g, '([^/]+)');
  const regex = new RegExp(`^${regexStr}$`);
  const match = pathname.match(regex);
  if (!match) return null;
  // Extract named params
  const paramNames = [...pattern.matchAll(/:(\w+)/g)].map((m) => m[1]);
  const params = {};
  paramNames.forEach((name, i) => {
    params[name] = match[i + 1];
  });
  return params;
}

// ── Request Handler ──

const handler = async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const respond = (statusCode, data) => {
    console.log(`${method} ${path} → ${statusCode}`);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  const respondError = (statusCode, message) => {
    respond(statusCode, { error: message });
  };

  try {
    // ── 1. GET /api/salesforce/cases?q={query} ──
    if (path === '/api/salesforce/cases' && method === 'GET') {
      const query = (url.searchParams.get('q') || '').toLowerCase();

      // Generate 4 mock cases (mix of statuses/priorities)
      const cases = [];
      for (let i = 0; i < 4; i++) {
        const c = buildMockCase(i);
        // Check stored cases for matching IDs
        if (casesStore[c.id]) {
          cases.push(casesStore[c.id]);
        } else {
          cases.push(c);
        }
      }

      // Filter by query if provided (match against subject)
      const filtered = query
        ? cases.filter((c) => c.subject.toLowerCase().includes(query))
        : cases;

      respond(200, filtered);
      return;
    }

    // ── 2. POST /api/salesforce/cases (create case) ──
    if (path === '/api/salesforce/cases' && method === 'POST') {
      let body;
      try {
        body = await parseBody(req);
      } catch (e) {
        respondError(400, 'Invalid JSON');
        return;
      }

      const now = new Date().toISOString();
      const caseId = `500${String(Date.now()).slice(-6)}`;
      const newCase = {
        id: caseId,
        caseNumber: generateCaseNumber(),
        subject: body.subject || 'New Case',
        description: body.description || '',
        status: 'New',
        priority: body.priority || 'Medium',
        origin: 'Web',
        owner: 'Unassigned',
        accountId: body.accountId || '',
        accountName: 'Unknown Account',
        contactId: '',
        contactName: '',
        email: '',
        phone: '',
        createdDate: now,
        lastModifiedDate: now,
      };

      casesStore[caseId] = newCase;
      respond(201, newCase);
      return;
    }

    // ── 3. GET /api/salesforce/cases/{caseId} ──
    const getCaseParams = pathMatch('/api/salesforce/cases/:caseId', path);
    if (getCaseParams && method === 'GET') {
      const theCase = findCaseById(getCaseParams.caseId);
      if (!theCase) {
        respondError(404, `Case not found: ${getCaseParams.caseId}`);
        return;
      }
      respond(200, theCase);
      return;
    }

    // ── 4. PATCH /api/salesforce/cases/{caseId} ──
    if (getCaseParams && method === 'PATCH') {
      const theCase = findCaseById(getCaseParams.caseId);
      if (!theCase) {
        respondError(404, `Case not found: ${getCaseParams.caseId}`);
        return;
      }

      let body;
      try {
        body = await parseBody(req);
      } catch (e) {
        respondError(400, 'Invalid JSON');
        return;
      }

      const now = new Date().toISOString();

      // Update fields
      Object.assign(theCase, body);
      theCase.lastModifiedDate = now;

      // Store updated case
      casesStore[getCaseParams.caseId] = theCase;

      respond(200, theCase);
      return;
    }

    // ── 5. POST /api/salesforce/cases/{caseId}/escalate ──
    const escalateParams = pathMatch('/api/salesforce/cases/:caseId/escalate', path);
    if (escalateParams && method === 'POST') {
      const theCase = findCaseById(escalateParams.caseId);
      if (!theCase) {
        respondError(404, `Case not found: ${escalateParams.caseId}`);
        return;
      }

      let body;
      try {
        body = await parseBody(req);
      } catch (e) {
        respondError(400, 'Invalid JSON');
        return;
      }

      const now = new Date().toISOString();
      const escalationResult = {
        caseId: escalateParams.caseId,
        reason: body.reason || 'No reason provided',
        escalatedBy: 'System',
        escalatedAt: now,
        status: 'Escalated',
        priority: 'High',
      };

      respond(200, escalationResult);
      return;
    }

    // ── 6. GET /api/salesforce/accounts/{accountId} ──
    const accountParams = pathMatch('/api/salesforce/accounts/:accountId', path);
    if (accountParams && method === 'GET') {
      const accountId = accountParams.accountId;

      // Derive a consistent index from the account_id (matches client.py logic)
      let index = 0;
      for (let i = 0; i < accountId.length; i++) {
        index = (index * 31 + accountId.charCodeAt(i)) & 0x7fffffff;
      }
      index = index % COMPANY_NAMES.length;

      const accountData = {
        account: {
          id: accountId,
          name: ACCOUNT_NAMES[index],
          industry: INDUSTRIES[index],
          website: `https://www.${ACCOUNT_NAMES[index].toLowerCase().replace(/\s+/g, '')}.com`,
          phone: `+1-555-${String(2000 + index).padStart(4, '0')}`,
          billingCity: BILLING_CITIES[index],
          billingCountry: 'United States',
          annualRevenue: 50000000 * (index + 1),
          customerTier: CUSTOMER_TIERS[index],
          openCases: Math.max(0, 3 - index),
          lastCaseDate: '2026-04-15T10:30:00Z',
        },
        contact: {
          id: `con-${accountId}`,
          name: CONTACT_NAMES[index],
          email: CONTACT_EMAILS[index],
          phone: `+1-555-${String(3000 + index).padStart(4, '0')}`,
          title: CONTACT_TITLES[index],
          department: DEPARTMENTS[index],
        },
      };

      respond(200, accountData);
      return;
    }

    // ── 7. GET /api/salesforce/knowledge-base?q={query} ──
    if (path === '/api/salesforce/knowledge-base' && method === 'GET') {
      const query = (url.searchParams.get('q') || '').toLowerCase();
      let results = [];

      if (query) {
        results = KNOWLEDGE_ARTICLES.filter(
          (a) => a.title.toLowerCase().includes(query) || a.category.toLowerCase().includes(query)
        );
      }

      // Return at least 2 results for testing
      if (results.length === 0) {
        results = KNOWLEDGE_ARTICLES.slice(0, 2);
      }

      respond(200, results);
      return;
    }

    // ── 404 Fallback ──
    console.log(`${method} ${path} → 404`);
    respondError(404, 'Not found');
  } catch (error) {
    console.error('Error:', error);
    respondError(500, 'Internal server error');
  }
};

// ── Start Server ──

const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`SupportPilot Salesforce Mock Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET    /api/salesforce/cases?q={query}');
  console.log('  POST   /api/salesforce/cases');
  console.log('  GET    /api/salesforce/cases/:caseId');
  console.log('  PATCH  /api/salesforce/cases/:caseId');
  console.log('  POST   /api/salesforce/cases/:caseId/escalate');
  console.log('  GET    /api/salesforce/accounts/:accountId');
  console.log('  GET    /api/salesforce/knowledge-base?q={query}');
});

// ── Graceful Shutdown ──

process.on('SIGINT', () => {
  console.log('\nShutting down Salesforce mock server...');
  server.close(() => process.exit(0));
});
