# API Reference

All routes are under apps/web/app/api/.

## Public

### GET /api/health
Returns status of all backing services.

**Response 200:**
```json
{
  "status": "ok",
  "postgres": true,
  "redis": true
}
```

**Response 503 (degraded):**
```json
{
  "status": "degraded",
  "postgres": false,
  "redis": true
}
```

## Authenticated (requires NextAuth session)

### POST /api/agent
Rate-limited proxy to LangGraph server. Proxies to LANGGRAPH_URL/runs/stream.

**Headers:**
- Content-Type: application/json

**Body:** LangGraph run request object

**Response 200:** Server-sent event stream
**Response 401:** Unauthorized (no session)
**Response 429:** Rate limit exceeded
  - Headers:
    - X-RateLimit-Remaining: 0
    - X-RateLimit-Reset: <unix timestamp>
    - Retry-After: <seconds>

## Auth (NextAuth)

### GET  /api/auth/session
### POST /api/auth/signin
### POST /api/auth/signout
### GET  /api/auth/providers

Standard NextAuth routes — see nextauth.js.org/docs.

## Cron (requires x-cron-secret header)

### GET /api/cron/events
Processes pending CommerceEvents (cart abandonment, restock triggers, etc.)

**Headers:**
- x-cron-secret: <CRON_SECRET env var>

**Response 200:** `{ "processed": N }`
**Response 401:** Wrong or missing secret

## Dev Only (NODE_ENV !== production)

### GET /api/test/recent-order
Returns a recently delivered order ID for E2E tests.

### GET /api/test/old-order
Returns an order older than 7 days for return window tests.
