# E-Commerce Support Intelligence System - Implementation Plan

## Vision

Build a **complete multi-tenant e-commerce support intelligence platform** that provides:
- AI-powered customer support (chat, tickets, refunds)
- Full admin panel for merchants
- Real-time analytics and insights
- Third-party integrations (payments, email, SMS, analytics)

---

## 1. Authentication & User Management (Better Auth)

### Current State
- Hardcoded demo credentials in `lib/auth/store.ts`
- No real user management
- Zustand for client state only

### Implementation

#### Files to Create/Modify

| File | Purpose |
|------|---------|
| `lib/auth/better-auth.ts` | Better Auth configuration |
| `app/api/auth/[...all]/route.ts` | Auth API routes |
| `prisma/schema.prisma` | Add User, Session, Account models |
| `types/auth.ts` | Auth type exports |

#### Schema Changes
```prisma
// User model (replace or extend existing)
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  name          String?
  emailVerified Boolean   @default(false)
  image         String?
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Multi-tenancy
  organizationId String?
  organization  Organization? @relation(fields: [organizationId], references: [id])

  // Relations
  sessions       Session[]
  accounts       Account[]
  customer       Customer?     // Link to e-commerce customer
}

enum Role {
  USER
  ADMIN
  MANAGER
  SUPER_ADMIN
}

model Session {
  id        String   @id @default(uuid())
  userId    String
  expiresAt DateTime
  token     String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id           String  @id @default(uuid())
  userId       String
  accountId    String  // Provider's user ID
  provider     String  // "google", "github", "credentials"
  accessToken  String?
  refreshToken String?
  expiresAt    DateTime?
  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

#### Features
- **Credentials login** (email/password)
- **OAuth providers**: Google, GitHub, Apple
- **Email verification** (magic links)
- **Password reset**
- **Session management** (JWT + refresh tokens)
- **Role-based access control (RBAC)**

---

## 2. Multi-Tenancy Architecture

### Current State
- Single-tenant e-commerce data model
- No `organizationId` or tenant isolation
- All data in flat structure

### Implementation

#### New Models
```prisma
model Organization {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  domain      String?  // For email domain matching
  logo        String?
  settings    Json     @default("{}")

  // Subscription
  plan        Plan     @default(FREE)
  stripeCustomerId String?

  // Billing
  billingEmail String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  users       User[]
  customers   Customer[]
  products    Product[]
  orders      Order[]
  tickets     SupportTicket[]
  settings    OrganizationSettings?

  @@index([slug])
}

enum Plan {
  FREE
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

model OrganizationSettings {
  id              String       @id @default(uuid())
  organizationId  String       @unique @map("organization_id")
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Support settings
  supportEmail     String?
  supportPhone     String?
  autoRespond      Boolean      @default(false)
  responseTimeSLA  Int?        // Hours

  // AI settings
  aiEnabled       Boolean      @default(true)
  aiModel         String       @default("gpt-4o-mini")
  aiTemperature   Float        @default(0.7)

  // Business rules
  refundPolicyDays Int         @default(30)
  maxRefundAmount  Float?
  requireApproval  Boolean      @default(false)

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}
```

#### Tenant Isolation Pattern

**Prisma Middleware** for automatic tenant filtering:
```typescript
// lib/db/tenant-middleware.ts
prisma.$use(async (params, next) => {
  const ctx = getTenantContext();
  if (ctx?.organizationId) {
    // Add tenant filter to relevant models
    const tenantModels = ['Customer', 'Product', 'Order', 'SupportTicket'];
    if (tenantModels.includes(params.model)) {
      params.args.where = {
        ...params.args.where,
        organizationId: ctx.organizationId,
      };
    }
  }
  return next(params);
});
```

---

## 3. E-Commerce Admin Panel

### Current State
- Basic dashboard with mock data
- Limited to chat, orders, refunds view
- No CRUD operations

### Implementation

#### New Routes Structure

```
app/dashboard/
├── layout.tsx              # Dashboard layout with sidebar
├── page.tsx                # Overview analytics
├── orders/                 # Order management
│   ├── page.tsx            # Order list
│   └── [id]/page.tsx      # Order detail
├── products/               # Product management
│   ├── page.tsx           # Product list
│   ├── [id]/page.tsx     # Product edit
│   └── new/page.tsx       # Create product
├── customers/              # Customer management
│   ├── page.tsx           # Customer list
│   └── [id]/page.tsx      # Customer detail
├── tickets/                # Support tickets
│   ├── page.tsx           # Ticket list
│   └── [id]/page.tsx      # Ticket detail
├── refunds/                # Refund management
│   ├── page.tsx           # Refund list
│   └── [id]/page.tsx      # Refund detail
├── analytics/              # Analytics & reports
│   ├── page.tsx           # Overview
│   ├── revenue/page.tsx   # Revenue analytics
│   └── tickets/page.tsx   # Support analytics
├── settings/               # Organization settings
│   ├── page.tsx           # General settings
│   ├── billing/page.tsx   # Subscription
│   ├── team/page.tsx      # Team management
│   └── integrations/page.tsx # Third-party
└── api/                    # Admin API routes
    ├── orders/
    ├── products/
    ├── customers/
    └── analytics/
```

#### Components to Create

| Component | Purpose |
|-----------|---------|
| `components/admin/sidebar.tsx` | Navigation sidebar |
| `components/admin/header.tsx` | User menu, notifications |
| `components/admin/data-table.tsx` | Reusable data table with filters |
| `components/admin/product-form.tsx` | Product CRUD form |
| `components/admin/order-detail.tsx` | Order view with actions |
| `components/admin/customer-profile.tsx` | Customer 360 view |
| `components/admin/ticket-thread.tsx` | Ticket conversation |
| `components/admin/stats-grid.tsx` | Analytics cards |
| `components/admin/charts/` | Revenue, orders, tickets charts |

#### Features
- **Product Management**: CRUD, categories, inventory, pricing
- **Order Management**: List, filter, status updates, tracking
- **Customer Management**: Profile, history, segments
- **Ticket Management**: SLA tracking, assignments, resolutions
- **Analytics**: Real-time dashboards, exports, reports
- **Team Management**: Invite users, assign roles

---

## 4. Third-Party Integrations

### Current State
- Stripe integration (payments, refunds)

### Implementation Plan

#### A. Email (Resend)
```typescript
// lib/email/client.ts
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(params: {
  to: string;
  subject: string;
  template: 'ticket-created' | 'ticket-resolved' | 'refund-processed';
  data: Record<string, unknown>;
});
```

**Templates:**
- Ticket created/updated/resolved
- Refund processed
- Order confirmation
- Password reset

#### B. SMS (Twilio)
```typescript
// lib/sms/client.ts
export async function sendSMS(params: {
  to: string;
  message: string;
  template?: 'ticket-created' | 'refund-processed';
});
```

#### C. Analytics (PostHog/Mixpanel)
```typescript
// lib/analytics/index.ts
export function trackEvent(event: string, properties?: Record<string, unknown>);
export function identifyUser(userId: string, traits: Record<string, unknown>);
```

#### D. Error Tracking (Sentry)
```typescript
// lib/observability/sentry.ts
export function initSentry();
export function captureException(error: Error, context?: Record<string, unknown>);
```

#### E. Search (Algolia/Meilisearch)
```typescript
// lib/search/client.ts
export async function indexProduct(product: Product);
export async function searchProducts(query: string, filters?: Record<string, unknown>);
```

#### F. Shipping (EasyPost/Shippo)
```typescript
// lib/shipping/client.ts
export async function getRates(params: { from, to, package });
export async function createLabel(shipmentId: string);
```

---

## 5. Complete E-Commerce Features

### A. Customer 360
- View all interactions (orders, tickets, refunds)
- Communication history
- Lifetime value calculation
- Segmentation

### B. Smart Recommendations
- AI-powered product recommendations
- Similar products
- Frequently bought together
- Price drop alerts

### C. Automated Workflows
- Ticket routing based on keywords
- Auto-responses for common queries
- Refund eligibility checks
- Inventory alerts

### D. Reporting
- Revenue reports (daily, weekly, monthly)
- Support metrics (response time, resolution rate)
- Product performance
- Customer acquisition/retention

---

## 6. File Changes Summary

### New Files to Create

```
lib/
├── auth/
│   ├── better-auth.ts      # Auth config
│   ├── middleware.ts        # Auth protection
│   └── permissions.ts      # RBAC
├── db/
│   ├── tenant-middleware.ts # Multi-tenancy
│   └── transactions.ts      # Typed transactions
├── email/
│   ├── client.ts           # Resend client
│   └── templates.ts         # Email templates
├── sms/
│   └── client.ts           # Twilio client
├── analytics/
│   ├── client.ts           # PostHog/Mixpanel
│   └── events.ts           # Analytics events
├── search/
│   └── client.ts           # Search client
├── shipping/
│   └── client.ts           # Shipping client
├── admin/
│   ├── components/         # Admin UI components
│   └── services/           # Admin business logic
└── webhook/
    └── handlers/          # Webhook processors

app/
├── api/
│   ├── auth/               # Auth routes
│   ├── admin/              # Admin CRUD
│   ├── webhooks/           # External webhooks
│   └── analytics/          # Reporting API

prisma/
└── migrations/             # DB migrations
```

### Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add User, Organization, Session, Account, OrganizationSettings |
| `lib/auth/store.ts` | Replace with Better Auth integration |
| `lib/auth/index.ts` | Export Better Auth types |
| `lib/env.js` | Add new env vars |
| `app/dashboard/layout.tsx` | Expand for full admin panel |
| `middleware.ts` | Add auth protection |

---

## 7. Environment Variables

```bash
# Authentication
AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=https://your-domain.com

# OAuth Providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Email (Resend)
RESEND_API_KEY=

# SMS (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Analytics
POSTHOG_API_KEY=

# Error Tracking
SENTRY_DSN=

# Search
ALGOLIA_APP_ID=
ALGOLIA_API_KEY=

# Shipping
EASYPOST_API_KEY=
```

---

## 8. Implementation Phases

### Phase 1: Foundation
- [ ] Better Auth setup with credentials + Google OAuth
- [ ] User, Session, Account models in Prisma
- [ ] Auth middleware
- [ ] Login/signup pages

### Phase 2: Multi-Tenancy
- [ ] Organization model
- [ ] Tenant middleware
- [ ] Organization settings
- [ ] Team management

### Phase 3: Admin Panel Core
- [ ] Dashboard layout
- [ ] Product management (CRUD)
- [ ] Order management
- [ ] Customer management

### Phase 4: Support Features
- [ ] Ticket management
- [ ] Refund workflow
- [ ] Customer 360 view

### Phase 5: Analytics & Reporting
- [ ] Analytics dashboard
- [ ] Revenue reports
- [ ] Support metrics
- [ ] Data exports

### Phase 6: Third-Party Integrations
- [ ] Email (Resend)
- [ ] SMS (Twilio)
- [ ] Analytics (PostHog)
- [ ] Error tracking (Sentry)

---

## 9. Dependencies to Add

```bash
pnpm add better-auth @better-auth/expo
pnpm add resend
pnpm add twilio
pnpm add posthog-node
pnpm add @sentry/node
pnpm add algoliasearch
pnpm add @easypost/easypost
```

---

## 10. Migration Strategy

1. **Backup existing data**
2. **Create Prisma migration** for new schema
3. **Deploy auth changes** (maintain backward compatibility)
4. **Migrate existing users** to new auth system
5. **Add organization field** to existing data
6. **Deploy admin panel** incrementally

---

## Next Steps

1. Review and approve this plan
2. Select which phase to start with
3. Prioritize specific features
4. Set up development environment
