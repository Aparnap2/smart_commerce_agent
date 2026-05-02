# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat curl
WORKDIR /app

# ── deps ──────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile

# ── builder ───────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm build

# ── runner ────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 agentuser

COPY --from=builder --chown=agentuser:nodejs \
  /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY /app/package.json ./
COPY /app/langgraph.json ./

USER agentuser
EXPOSE 2024

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:2024/ok || exit 1

CMD ["node", "node_modules/.bin/langgraph", \
     "start", "--host", "0.0.0.0", "--port", "2024"]
