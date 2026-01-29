# Smart Commerce Agent - Makefile
#
# One-command operations for development workflow
#
# Prerequisites:
# - Docker installed and running
# - pnpm (or npm/pip) for package management

# Colors for output
GREEN=\033[0;32m
BLUE=\033[0;34m
YELLOW=\033[1;33m
NC=\033[0m

.PHONY: help
help:
	@echo ""
	@echo -e "$(BLUE)Smart Commerce Agent - Available Commands$(NC)"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make infra-up       Start all Docker infrastructure"
	@echo "  make infra-down     Stop all infrastructure"
	@echo "  make infra-status   Show status of all services"
	@echo "  make infra-restart  Restart all infrastructure"
	@echo ""
	@echo "Development:"
	@echo "  make install        Install dependencies (pnpm install)"
	@echo "  make dev            Start development server"
	@echo "  make build          Build for production"
	@echo "  make lint           Run ESLint"
	@echo "  make typecheck      Run TypeScript type checking"
	@echo "  make test           Run test suite"
	@echo "  make test-watch     Run tests in watch mode"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate     Run database migrations"
	@echo "  make db-seed        Seed database with sample data"
	@echo "  make db-reset       Reset database (WARNING: deletes data)"
	@echo ""
	@echo "AI Services:"
	@echo "  make ollama-pull    Pull required Ollama models"
	@echo "  make qdrant-init    Initialize Qdrant with sample products"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean          Clean build artifacts and caches"
	@echo "  make docker-prune   Remove unused Docker resources"
	@echo ""

# Infrastructure targets
.PHONY: infra-up infra-down infra-status infra-restart
infra-up:
	@echo -e "$(YELLOW)Starting infrastructure...$(NC)"
	@./scripts/start-infrastructure.sh start

infra-down:
	@echo -e "$(YELLOW)Stopping infrastructure...$(NC)"
	@./scripts/start-infrastructure.sh stop

infra-status:
	@./scripts/start-infrastructure.sh status

infra-restart:
	@echo -e "$(YELLOW)Restarting infrastructure...$(NC)"
	@./scripts/start-infrastructure.sh restart

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

test-watch:
	@echo -e "$(BLUE)Running tests in watch mode...$(NC)"
	@pnpm test:watch

# Database targets
.PHONY: db-migrate db-seed db-reset
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
