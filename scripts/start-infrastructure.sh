#!/bin/bash
#
# Smart Commerce Agent - Infrastructure Startup Script
# Starts all required Docker containers for local development
#
# Usage: ./scripts/start-infrastructure.sh [--skip-pull]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NETDATA_PORT=19999
OLLAMA_PORT=11434
QDRANT_PORT=6333
REDIS_PORT=6379
POSTGRES_PORT=5432
LANGFUSE_PORT=3000

# Container name mappings (script name -> actual docker name)
declare -A CONTAINER_NAMES=(
    ["sca-netdata"]="netdata"
    ["sca-ollama"]="ollama"
    ["sca-qdrant"]="echoteam-qdrant"
    ["sca-redis"]="smart-commerce-redis"
    ["sca-postgres"]="smart-commerce-postgres"
    ["sca-langfuse"]="sca-langfuse"
)

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get actual container name
get_container_name() {
    local script_name="$1"
    echo "${CONTAINER_NAMES[$script_name]:-$script_name}"
}

# Check if a container is running
is_running() {
    local name=$(get_container_name "$1")
    docker ps --format '{{.Names}}' | grep -q "^${name}$"
}

# Check if container exists (even if stopped)
exists() {
    local name=$(get_container_name "$1")
    docker ps -a --format '{{.Names}}' | grep -q "^${name}$"
}

# Stop and remove a container
stop_container() {
    local script_name="$1"
    local name=$(get_container_name "$script_name")

    if is_running "$script_name"; then
        log_info "Stopping $name..."
        docker stop "$name" > /dev/null
        docker rm "$name" > /dev/null
        log_success "Stopped $name"
    elif exists "$script_name"; then
        log_info "Removing stopped container $name..."
        docker rm "$name" > /dev/null
        log_success "Removed $name"
    fi
}

# Get port mapping for a container
get_port() {
    local name=$(get_container_name "$1")
    docker port "$name" 2>/dev/null | head -1 | cut -d':' -f2 || echo "unknown"
}

# Start Netdata for monitoring
start_netdata() {
    local name="netdata"
    local script_name="sca-netdata"

    if is_running "$script_name"; then
        log_success "$name is already running on port $(get_port $script_name)"
        return 0
    fi

    log_info "Starting Netdata monitoring..."
    docker run -d \
        --name "$name" \
        --network host \
        --restart unless-stopped \
        -v $(pwd)/docker/netdata:/etc/netdata \
        -e DO_NOT_TRACK=1 \
        netdata/netdata:latest

    log_success "Netdata started on http://localhost:$NETDATA_PORT"
}

# Start Ollama for local LLM inference
start_ollama() {
    local name="ollama"
    local script_name="sca-ollama"

    if is_running "$script_name"; then
        log_success "$name is already running on port $OLLAMA_PORT"
        return 0
    fi

    log_info "Starting Ollama (this may take a moment to pull image)..."
    docker run -d \
        --name "$name" \
        -p ${OLLAMA_PORT}:11434 \
        --restart unless-stopped \
        -v ollama:/root/.ollama \
        ollama/ollama:latest

    log_success "Ollama started on http://localhost:$OLLAMA_PORT"
    log_info "Pulling default model (qwen2.5-coder:3b)..."
    docker exec "$name" ollama pull qwen2.5-coder:3b || log_warn "Model pull failed, will retry on first use"
    log_info "Pulling embedding model (nomic-embed-text)..."
    docker exec "$name" ollama pull nomic-embed-text || log_warn "Embedding model pull failed"
}

# Start Qdrant for vector search
start_qdrant() {
    local name="echoteam-qdrant"
    local script_name="sca-qdrant"

    if is_running "$script_name"; then
        log_success "$name is already running on port $QDRANT_PORT"
        return 0
    fi

    log_info "Starting Qdrant vector database..."
    docker run -d \
        --name "$name" \
        -p ${QDRANT_PORT}:6333 \
        -p ${QDRANT_PORT}:6334 \
        --restart unless-stopped \
        -v qdrant:/qdrant/storage \
        qdrant/qdrant:latest

    log_success "Qdrant started on http://localhost:$QDRANT_PORT"
}

# Start Redis for state caching and LangGraph checkpointing
start_redis() {
    local name="smart-commerce-redis"
    local script_name="sca-redis"

    if is_running "$script_name"; then
        log_success "$name is already running on port $REDIS_PORT"
        return 0
    fi

    log_info "Starting Redis..."
    docker run -d \
        --name "$name" \
        -p ${REDIS_PORT}:6379 \
        --restart unless-stopped \
        -v redis:/data \
        redis:7-alpine \
        redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

    log_success "Redis started on port $REDIS_PORT"
}

# Start PostgreSQL for persistent storage
start_postgres() {
    local name="smart-commerce-postgres"
    local script_name="sca-postgres"

    if is_running "$script_name"; then
        log_success "$name is already running on port $POSTGRES_PORT"
        return 0
    fi

    log_info "Starting PostgreSQL..."
    docker run -d \
        --name "$name" \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD=postgres \
        -e POSTGRES_DB=smart_commerce \
        -p ${POSTGRES_PORT}:5432 \
        --restart unless-stopped \
        -v postgres:/var/lib/postgresql/data \
        pgvector/pgvector:pg16

    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    local retries=30
    while ! docker exec "$name" pg_isready -U postgres > /dev/null 2>&1; do
        retries=$((retries - 1))
        if [ $retries -eq 0 ]; then
            log_error "PostgreSQL failed to start"
            return 1
        fi
        sleep 1
    done

    log_success "PostgreSQL started on port $POSTGRES_PORT (database: smart_commerce)"
}

# Start Langfuse for observability
start_langfuse() {
    local name="sca-langfuse"
    local script_name="sca-langfuse"

    if is_running "$script_name"; then
        log_success "$name is already running on port $LANGFUSE_PORT"
        return 0
    fi

    log_info "Starting Langfuse..."
    docker run -d \
        --name "$name" \
        -p ${LANGFUSE_PORT}:3000 \
        --restart unless-stopped \
        -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/smart_commerce \
        -e REDIS_URL=redis://host.docker.internal:6379 \
        -e NEXTAUTH_SECRET=your-secret-key-change-in-production \
        -e SALT=your-salt-change-in-production \
        -e TRACELOOP_DEVKEY="" \
        langfuse/langfuse:latest

    # Wait for Langfuse to be ready
    log_info "Waiting for Langfuse to be ready..."
    local retries=30
    while ! curl -s http://localhost:$LANGFUSE_PORT/api/health > /dev/null 2>&1; do
        retries=$((retries - 1))
        if [ $retries -eq 0 ]; then
            log_error "Langfuse failed to start"
            return 1
        fi
        sleep 2
    done

    log_success "Langfuse started on http://localhost:$LANGFUSE_PORT"
}

# Stop all containers
stop_all() {
    log_info "Stopping all Smart Commerce Agent containers..."

    for script_name in "${!CONTAINER_NAMES[@]}"; do
        stop_container "$script_name"
    done

    log_success "All containers stopped"
}

# Restart all containers
restart_all() {
    stop_all
    sleep 2
    start_all
}

# Print status of all containers
status() {
    echo ""
    echo "=========================================="
    echo "   Smart Commerce Agent Infrastructure   "
    echo "=========================================="
    echo ""

    local all_running=true
    local display_names=("Netdata" "Ollama" "Qdrant" "Redis" "PostgreSQL" "Langfuse")
    local script_names=("sca-netdata" "sca-ollama" "sca-qdrant" "sca-redis" "sca-postgres" "sca-langfuse")
    local ports=($NETDATA_PORT $OLLAMA_PORT $QDRANT_PORT $REDIS_PORT $POSTGRES_PORT $LANGFUSE_PORT)

    for i in "${!script_names[@]}"; do
        local script_name="${script_names[$i]}"
        local display_name="${display_names[$i]}"
        local expected_port="${ports[$i]}"

        if is_running "$script_name"; then
            local actual_port=$(get_port "$script_name")
            echo -e "${GREEN}●${NC} $display_name ($script_name): RUNNING on port $actual_port"
        elif exists "$script_name"; then
            echo -e "${YELLOW}○${NC} $display_name ($script_name): STOPPED"
            all_running=false
        else
            echo -e "${RED}○${NC} $display_name ($script_name): NOT CREATED"
            all_running=false
        fi
    done

    echo ""
    echo "Endpoints:"
    echo "  Netdata:   http://localhost:$NETDATA_PORT"
    echo "  Ollama:    http://localhost:$OLLAMA_PORT"
    echo "  Qdrant:    http://localhost:$QDRANT_PORT"
    echo "  Redis:     localhost:$REDIS_PORT"
    echo "  PostgreSQL: localhost:$POSTGRES_PORT"
    echo "  Langfuse:  http://localhost:$LANGFUSE_PORT"
    echo ""

    if [ "$all_running" = true ]; then
        echo -e "${GREEN}All services are running!${NC}"
    else
        echo -e "${YELLOW}Some services are not running. Run ./scripts/start-infrastructure.sh to start them.${NC}"
    fi
}

# Print usage
usage() {
    echo "Smart Commerce Agent - Infrastructure Management"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start       Start all infrastructure services"
    echo "  stop        Stop all infrastructure services"
    echo "  restart     Restart all infrastructure services"
    echo "  status      Show status of all services"
    echo "  logs <name> Show logs for a specific service"
    echo "  help        Show this help message"
    echo ""
    echo "Services:"
    echo "  netdata     Monitoring dashboard"
    echo "  ollama      Local LLM inference"
    echo "  qdrant      Vector database"
    echo "  redis       Key-value store"
    echo "  postgres    Relational database"
    echo "  langfuse    Observability platform"
}

# Show logs for a specific container
show_logs() {
    local service="$1"
    local script_name="sca-$service"

    if [ -z "$service" ]; then
        log_error "Please specify a service name"
        usage
        exit 1
    fi

    local name=$(get_container_name "$script_name")

    if ! exists "$script_name"; then
        log_error "Container for $service does not exist"
        exit 1
    fi

    docker logs -f "$name"
}

# Start all services
start_all() {
    echo ""
    echo "=========================================="
    echo "   Starting Smart Commerce Agent        "
    echo "           Infrastructure               "
    echo "=========================================="
    echo ""

    # Order matters: PostgreSQL first (dependencies), then Redis, then others
    start_postgres
    sleep 2
    start_redis
    start_qdrant
    start_ollama
    start_netdata
    start_langfuse

    echo ""
    echo "=========================================="
    echo -e "${GREEN}   All services started successfully!${NC}"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "  1. Copy .env.example to .env.local"
    echo "  2. Update environment variables if needed"
    echo "  3. Run 'pnpm dev' to start the application"
    echo ""
}

# Main entry point
case "${1:-start}" in
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    restart)
        restart_all
        ;;
    status)
        status
        ;;
    logs)
        show_logs "$2"
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac
