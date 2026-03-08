.PHONY: agent-briefing infra-up infra-down \
        build-api build-agent \
        start-api stop-api start-agent stop-agent \
        dev-web dev-api dev-agent \
        test-web test-api test-agent \
        db-migrate db-seed db-reset db-studio \
        health clean prune \
        start-postgres stop-postgres test-postgres health-postgres \
        start-redis stop-redis test-redis health-redis \
        start-langfuse stop-langfuse test-langfuse health-langfuse \
        test-all-sequential health-all-sequential clean-all

# ── Agent briefing ───────────────────────────────────────────
agent-briefing:
	@echo ""
	@echo "═══════════════ SMART COMMERCE ════════════════════════"
	@echo ""
	@echo "── Containers ─────────────────────────────────────────"
	@docker ps --format "  {{.Names}}\t{{.Status}}\t{{.Ports}}" \
	  2>/dev/null || echo "  docker not running"
	@echo ""
	@echo "── Memory (free) ──────────────────────────────────────"
	@free -h | awk '/^Mem/{print "  RAM:  " $$4 " available"}'
	@free -h | awk '/^Swap/{print "  Swap: " $$3 " used / " $$2}'
	@echo ""
	@echo "── DB row counts ──────────────────────────────────────"
	@docker exec smart-commerce-postgres \
	  psql -U postgres smart_commerce -t -c \
	  'SELECT \
	    (SELECT COUNT(*) FROM "Product") as products, \
	    (SELECT COUNT(*) FROM "User")    as users, \
	    (SELECT COUNT(*) FROM "Order")   as orders' \
	  2>/dev/null || echo "  postgres not running"
	@echo ""
	@echo "── Service health ─────────────────────────────────────"
	@curl -sf http://localhost:3000/api/health >/dev/null 2>&1 \
	  && echo "  ✅ web        :3000" || echo "  ❌ web        :3000"
	@curl -sf http://localhost:3001/health    >/dev/null 2>&1 \
	  && echo "  ✅ commerce   :3001" || echo "  ❌ commerce   :3001"
	@curl -sf http://localhost:8000/health    >/dev/null 2>&1 \
	  && echo "  ✅ agent-core :8000" || echo "  ❌ agent-core :8000"
	@echo ""
	@echo "── Recent commits ─────────────────────────────────────"
	@git log --oneline -6
	@echo ""
	@echo "── Open tasks ─────────────────────────────────────────"
	@grep "^\- \[ \]" TASKS.md 2>/dev/null | head -8 || true
	@echo "═══════════════════════════════════════════════════════"

# ── Infrastructure only (postgres + redis) ──────────────────
infra-up:
	docker compose up -d postgres redis
	@echo "Waiting for postgres..."
	@until docker exec smart-commerce-postgres \
	  pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
	@echo "✅ postgres ready"
	@echo "✅ redis ready"

infra-down:
	docker compose stop postgres redis

# ── Build — one at a time to save RAM ───────────────────────
build-api:
	docker compose build --no-cache commerce-api
	docker system prune -f

build-agent:
	docker compose build --no-cache agent-core
	docker system prune -f

# ── Start/stop individual services ──────────────────────────
start-api:
	docker compose up -d commerce-api
	@echo "Waiting for commerce-api..."
	@sleep 5
	@curl -sf http://localhost:3001/health \
	  && echo "✅ commerce-api ready" || echo "❌ commerce-api failed"

stop-api:
	docker compose stop commerce-api

start-agent:
	docker compose up -d agent-core
	@echo "Waiting for agent-core..."
	@sleep 8
	@curl -sf http://localhost:8000/health \
	  && echo "✅ agent-core ready" || echo "❌ agent-core failed"

stop-agent:
	docker compose stop agent-core

# ── Local dev (processes, not Docker) ───────────────────────
dev-web:
	pnpm --filter @smart-commerce/web dev

dev-api:
	cd apps/commerce-api && bun run src/index.ts

dev-agent:
	cd apps/agent-core && uvicorn main:app --reload --port 8000

# ── Tests — one file/service at a time ──────────────────────
test-web:
	@echo "Running web tests one file at a time..."
	@find apps/web/tests -name "*.test.ts" -o -name "*.test.tsx" \
	  | sort | while read f; do \
	    echo "  testing: $$f"; \
	    pnpm vitest run $$f --reporter=dot 2>&1 | tail -3; \
	  done

test-api:
	cd apps/commerce-api && bun test

test-agent:
	cd apps/agent-core && pytest tests/ -v --tb=short -x

# ── Database ─────────────────────────────────────────────────
db-migrate:
	pnpm prisma migrate dev

db-seed:
	pnpm prisma db seed

db-reset:
	pnpm prisma migrate reset --force
	$(MAKE) db-seed

db-studio:
	pnpm prisma studio

# ── Health ──────────────────────────────────────────────────
health:
	@echo "── Health checks ──────────────────────────────────────"
	@curl -sf http://localhost:3001/health \
	  && echo "✅ commerce-api :3001" \
	  || echo "❌ commerce-api :3001"
	@curl -sf http://localhost:8000/health \
	  && echo "✅ agent-core   :8000" \
	  || echo "❌ agent-core   :8000"

# ── E2E tests (requires all 3 services running) ───────────────
e2e-test:
	@echo "Checking services before E2E..."
	@curl -sf http://localhost:3001/health >/dev/null 2>&1 \
	  || (echo "❌ Start commerce-api first: make dev-api" && exit 1)
	@curl -sf http://localhost:8000/health >/dev/null 2>&1 \
	  || (echo "❌ Start agent-core first: make dev-agent" && exit 1)
	@curl -sf http://localhost:3000/ >/dev/null 2>&1 \
	  || (echo "❌ Start web first: make dev-web" && exit 1)
	@echo "✅ All services up — running E2E tests"
	pnpm --filter @smart-commerce/web vitest run tests/e2e/smoke.test.ts \
	  --reporter=verbose

# ── Full test suite (unit + integration where possible) ────────
test-all:
	@echo "Running unit tests (no services needed)..."
	pnpm --filter @smart-commerce/web vitest run tests/unit/ --reporter=dot
	@echo ""
	@echo "═══════════════════════════════════════════════════════"
	@echo "Unit tests complete. For integration/E2E tests:"
	@echo "  1. make infra-up"
	@echo "  2. make dev-api  (in terminal 2)"
	@echo "  3. make dev-agent (in terminal 3)"
	@echo "  4. make e2e-test"
	@echo "═══════════════════════════════════════════════════════"

# ── Cleanup ─────────────────────────────────────────────────
prune:
	docker system prune -f
	@echo "✅ Docker layers cleaned"

clean: prune
	find . -name "__pycache__" -type d \
	  -exec rm -rf {} + 2>/dev/null; true
	find . -name ".next" -type d \
	  -exec rm -rf {} + 2>/dev/null; true

# ─── Individual Container Management ───────────────────────────

# PostgreSQL
start-postgres:
	./scripts/start-postgres.sh

stop-postgres:
	./scripts/stop-postgres.sh

test-postgres: start-postgres
	@echo "📊 Testing PostgreSQL..."
	docker exec smart-commerce-postgres psql -U postgres -d techtrend -c "SELECT version();"
	docker exec smart-commerce-postgres psql -U postgres -d techtrend -c "\dt"
	@echo "✅ PostgreSQL test complete"
	@echo "🛑 Stopping PostgreSQL..."
	./scripts/stop-postgres.sh

# Redis
start-redis:
	./scripts/start-redis.sh

stop-redis:
	./scripts/stop-redis.sh

test-redis: start-redis
	@echo "📊 Testing Redis..."
	docker exec smart-commerce-redis redis-cli ping
	docker exec smart-commerce-redis redis-cli DBSIZE
	@echo "✅ Redis test complete"
	@echo "🛑 Stopping Redis..."
	./scripts/stop-redis.sh

# Langfuse (requires PostgreSQL)
start-langfuse:
	@echo "⚠️  Langfuse requires PostgreSQL. Starting postgres first..."
	./scripts/start-postgres.sh
	docker exec smart-commerce-postgres psql -U postgres -c "CREATE DATABASE langfuse;" 2>/dev/null || echo "Database already exists"
	@echo "⚠️  Keeping PostgreSQL running for Langfuse..."
	./scripts/start-langfuse.sh

stop-langfuse:
	./scripts/stop-langfuse.sh

test-langfuse: start-langfuse
	@echo "📊 Testing Langfuse..."
	curl -sf http://localhost:3001/api/public/health && echo "✅ Langfuse healthy" || echo "❌ Langfuse unhealthy"
	@echo "✅ Langfuse test complete"
	@echo "🛑 Stopping Langfuse..."
	./scripts/stop-langfuse.sh

# ─── Sequential Testing (One at a Time) ────────────────────────

test-all-sequential:
	@echo "\n🧪 SEQUENTIAL CONTAINER TESTING"
	@echo "================================"
	@echo "Testing each container ONE at a time (no parallel execution)"
	@echo ""
	@$(MAKE) test-postgres
	@echo ""
	@$(MAKE) test-redis
	@echo ""
	@$(MAKE) test-langfuse
	@echo "\n✅ ALL CONTAINERS TESTED SEQUENTIALLY"

# ─── Cleanup ───────────────────────────────────────────────────

clean-all:
	@echo "🧹 Cleaning all containers..."
	./scripts/stop-postgres.sh 2>/dev/null || true
	./scripts/stop-redis.sh 2>/dev/null || true
	./scripts/stop-langfuse.sh 2>/dev/null || true
	@echo "✅ All containers stopped and removed"

# ─── Health Check (Individual) ─────────────────────────────────

health-postgres:
	@echo "Postgres:" && docker exec smart-commerce-postgres pg_isready -U postgres 2>/dev/null || echo "❌ Not running"

health-redis:
	@echo "Redis:" && docker exec smart-commerce-redis redis-cli ping 2>/dev/null || echo "❌ Not running"

health-langfuse:
	@echo "Langfuse:" && curl -sf http://localhost:3001/api/public/health 2>/dev/null && echo "✅" || echo "❌ Not running"

health-all-sequential:
	@echo "=== Individual Container Health ==="
	@$(MAKE) health-postgres
	@$(MAKE) health-redis
	@$(MAKE) health-langfuse
