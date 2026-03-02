# Smart Commerce Agent - Makefile
#
# Docker-First Development with Azure AI Foundry
# Agentic Coding System: CLAUDE.md + AGENTS.md + TASKS.md + .cursor/rules
#
# Prerequisites:
# - Docker installed and running
# - pnpm for package management
# - Azure CLI (optional, for deployment)
#
# Architecture:
# - Local: PostgreSQL + Redis + Langfuse (Docker)
# - Remote LLM: Azure AI Foundry (via .env.local)
# - Same docker-compose.yml works for dev AND Azure Container Apps deployment
#
# Agent System:
# - CLAUDE.md: Agent brain (reads FIRST every session)
# - AGENTS.md: Shared architecture context
# - TASKS.md: Living task board (agent updates after each task)
# - .cursor/rules/: TDD + infra enforcement

# Colors for output
GREEN=\033[0;32m
BLUE=\033[0;34m
YELLOW=\033[1;33m
RED=\033[0;31m
NC=\033[0m

.PHONY: help
help:
	@echo ""
	@echo -e "$(BLUE)Smart Commerce Agent - Available Commands$(NC)"
	@echo ""
	@echo -e "$(YELLOW)🤖 Agent Commands (NEW):$(NC)"
	@echo "  make context        Print full project context for agent"
	@echo "  make plan           Show next active task from TASKS.md"
	@echo "  make agent-briefing Full briefing to paste into agent"
	@echo ""
	@echo -e "$(YELLOW)Development (Docker-First):$(NC)"
	@echo "  make dev-up         Start full dev stack (Docker + watch)"
	@echo "  make dev-down       Stop dev stack"
	@echo "  make dev-reset      Reset DB + reseed"
	@echo "  make dev-logs       Tail all service logs"
	@echo "  make dev-shell-db   Open psql shell"
	@echo "  make dev-shell-app  Open app container shell"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make infra-up       Start core infrastructure only"
	@echo "  make infra-down     Stop infrastructure"
	@echo "  make infra-status   Show service status"
	@echo ""
	@echo "Development (Local):"
	@echo "  make install        Install dependencies"
	@echo "  make dev            Start Next.js dev server"
	@echo "  make build          Build for production"
	@echo "  make lint           Run ESLint"
	@echo "  make test           Run test suite"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate     Run migrations"
	@echo "  make db-seed        Seed database"
	@echo "  make db-reset       Reset database (DELETES DATA)"
	@echo "  make db-check       Full DB health check"
	@echo ""
	@echo "Testing (TDD):"
	@echo "  make test-llm       Test Azure AI Foundry connection"
	@echo "  make test-db        Test database connection"
	@echo "  make test-watch     TDD watch mode (FILE=filename)"
	@echo ""
	@echo "Deployment:"
	@echo "  make azure-deploy   Deploy to Azure Container Apps"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean          Clean build artifacts"
	@echo "  make docker-prune   Remove unused Docker resources"
	@echo ""

# ── Context & Planning (Agent System) ─────────────────────────────────────────

.PHONY: context plan agent-briefing

context:         ## Print full project context for agent
	@echo "=== Docker Status ==="
	@docker ps -a 2>/dev/null || echo "Docker not running"
	@echo "\n=== DB Tables ==="
	@docker exec smart-commerce-postgres psql -U postgres -d smart_commerce -c "\dt" 2>/dev/null || echo "Postgres not running"
	@echo "\n=== Product Count ==="
	@docker exec smart-commerce-postgres psql -U postgres -d smart_commerce -c "SELECT COUNT(*) FROM \"Product\";" 2>/dev/null
	@echo "\n=== Redis Keys ==="
	@docker exec smart-commerce-redis redis-cli dbsize 2>/dev/null || echo "Redis not running"
	@echo "\n=== Pending Migrations ==="
	@pnpm prisma migrate status 2>/dev/null || echo "Prisma not available"
	@echo "\n=== Test Status ==="
	@pnpm test --passWithNoTests 2>&1 | tail -5

plan:            ## Agent: read TASKS.md and print next task
	@echo "=== Active Tasks ==="
	@grep -A 5 "^- \[ \]" TASKS.md | head -20

agent-briefing:  ## Full briefing to paste into agent at start of session
	@echo "## Agent Briefing — $$(date)"
	@echo ""
	@make context
	@echo "\n=== Active Task ==="
	@make plan
	@echo "\n=== Recent Git Log ==="
	@git log --oneline -5 2>/dev/null || echo "Not a git repo"
	@echo "\n=== Files to Read First ==="
	@echo "1. CLAUDE.md (agent instructions)"
	@echo "2. AGENTS.md (architecture context)"
	@echo "3. TASKS.md (current task)"
	@echo "4. .cursor/rules/tdd.mdc (TDD workflow)"
	@echo "5. .cursor/rules/infra.mdc (infra rules)"

# Infrastructure targets
.PHONY: infra-up infra-down infra-status
infra-up:
	@echo -e "$(YELLOW)Starting core infrastructure...$(NC)"
	@docker compose up -d postgres redis langfuse
	@echo -e "$(GREEN)Infrastructure started!$(NC)"
	@docker compose ps

infra-down:
	@echo -e "$(YELLOW)Stopping infrastructure...$(NC)"
	@docker compose down

infra-status:
	@docker compose ps

# Docker-First Development Targets
.PHONY: dev-up dev-down dev-reset dev-logs dev-shell-db dev-shell-app
dev-up:         ## Start full dev stack with watch mode
	@echo -e "$(BLUE)Starting full dev stack with watch mode...$(NC)"
	@docker compose up --watch
	@echo -e "$(GREEN)Dev stack started! Access:$(NC)"
	@echo -e "  - App: http://localhost:3000"
	@echo -e "  - Langfuse: http://localhost:3001"
	@echo -e "  - Database: localhost:5432"
	@echo -e "  - Redis: localhost:6379"

dev-down:       ## Stop dev stack
	@echo -e "$(YELLOW)Stopping dev stack...$(NC)"
	@docker compose down

dev-reset:      ## Reset DB + reseed (WARNING: deletes data)
	@echo -e "$(RED)WARNING: This will delete all database data!$(NC)"
	@read -p "Are you sure? (y/N) " -n 1 -r; echo
	@if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(MAKE) dev-down; \
		docker volume rm smart-commerce-dev_postgres_data 2>/dev/null || true; \
		$(MAKE) dev-up; \
		sleep 5; \
		$(MAKE) db-migrate; \
		$(MAKE) db-seed; \
		echo -e "$(GREEN)Database reset and seeded!$(NC)"; \
	fi

dev-logs:       ## Tail all service logs
	@docker compose logs -f

dev-shell-db:   ## Open psql shell in database container
	@docker exec -it smart-commerce-postgres psql -U postgres -d smart_commerce

dev-shell-app:  ## Open shell in app container
	@docker compose exec app sh

# Test Targets
.PHONY: test-llm test-db
test-llm:       ## Test Azure AI Foundry connection
	@echo -e "$(BLUE)Testing Azure AI Foundry connection...$(NC)"
	@curl -X POST http://localhost:3000/api/chat \
	  -H "Content-Type: application/json" \
	  -d '{"messages":[{"role":"user","content":"ping"}]}' \
	  || echo -e "$(RED)Test failed. Check if app is running and .env.local is configured$(NC)"

test-db:        ## Test database connection
	@echo -e "$(BLUE)Testing database connection...$(NC)"
	@docker exec smart-commerce-postgres pg_isready -U postgres -d smart_commerce \
	  && echo -e "$(GREEN)Database is ready!$(NC)" \
	  || echo -e "$(RED)Database is not ready$(NC)"

# Deployment
.PHONY: azure-deploy
azure-deploy:   ## Deploy to Azure Container Apps
	@echo -e "$(BLUE)Deploying to Azure Container Apps...$(NC)"
	@echo "Prerequisites:"
	@echo "  1. Azure CLI installed: az --version"
	@echo "  2. Logged in: az login"
	@echo "  3. Resource group created: az group create --name smart-commerce --location eastus"
	@echo ""
	@read -p "Ready to deploy? (y/N) " -n 1 -r; echo
	@if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		az containerapp compose create \
		  --compose-file-path docker-compose.yml \
		  --resource-group smart-commerce \
		  --environment smart-commerce-env \
		  --location eastus; \
		echo -e "$(GREEN)Deployment complete!$(NC)"; \
	fi

# Development targets
.PHONY: install dev build lint typecheck test test-watch
install:
	@echo -e "$(BLUE)Installing dependencies...$(NC)"
	@pnpm install

dev:
	@echo -e "$(BLUE)Starting development server...$(NC)"
	@pnpm dev

build:
	@echo -e "$(BLUE)Building for production...$(NC)"
	@pnpm build

lint:
	@echo -e "$(BLUE)Running ESLint...$(NC)"
	@pnpm lint

typecheck:
	@echo -e "$(BLUE)Running TypeScript type check...$(NC)"
	@pnpm typecheck

test:
	@echo -e "$(BLUE)Running tests...$(NC)"
	@pnpm test

test-watch:     ## TDD watch mode for specific file (Usage: make test-watch FILE=cart.test.ts)
	@echo -e "$(BLUE)Running tests in watch mode for $(YELLOW)$(FILE)$(NC)"
	@pnpm vitest run $(FILE) --watch

# Database targets
.PHONY: db-migrate db-seed db-reset db-check
db-check:        ## Full DB health check
	@echo -e "$(BLUE)Checking database health...$(NC)"
	@docker exec smart-commerce-postgres psql -U postgres -d smart_commerce \
	  -c "\dt" \
	  -c "SELECT COUNT(*) as products FROM \"Product\";" \
	  -c "SELECT extname FROM pg_extension WHERE extname='vector';"
db-migrate:
	@echo -e "$(BLUE)Running database migrations...$(NC)"
	@npx prisma migrate deploy

db-seed:
	@echo -e "$(BLUE)Seeding database...$(NC)"
	@npx tsx prisma/seed.ts

db-reset:
	@echo -e "$(YELLOW)WARNING: This will delete all data in the database!$(NC)"
	@read -p "Are you sure? (y/N) " -n 1 -r; echo; if [[ $$REPLY =~ ^[Yy]$$ ]]; then npx prisma migrate reset --force; fi

# AI Services targets
.PHONY: ollama-pull qdrant-init
ollama-pull:
	@echo -e "$(BLUE)Pulling Ollama models...$(NC)"
	@docker exec sca-ollama ollama pull qwen2.5-coder:3b
	@docker exec sca-ollama ollama pull nomic-embed-text
	@echo -e "$(GREEN)Ollama models pulled successfully$(NC)"

qdrant-init:
	@echo -e "$(BLUE)Initializing Qdrant with sample products...$(NC)"
	@pnpm tsx scripts/qdrant-seed.ts

# Utility targets
.PHONY: clean docker-prune quick-start
clean:
	@echo -e "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf .next node_modules/.cache .turbo
	@echo -e "$(GREEN)Cleaned successfully$(NC)"

docker-prune:
	@echo -e "$(YELLOW)Pruning unused Docker resources...$(NC)"
	@docker system prune -f
	@docker volume prune -f
	@echo -e "$(GREEN)Docker pruned successfully$(NC)"

# Composite target for quick start
quick-start: infra-up install db-migrate db-seed
	@echo ""
	@echo -e "$(GREEN)========================================$(NC)"
	@echo -e "$(GREEN)  Quick start complete!$(NC)"
	@echo -e "$(GREEN)  Run 'make dev' to start the app$(NC)"
	@echo -e "$(GREEN)========================================$(NC)"
