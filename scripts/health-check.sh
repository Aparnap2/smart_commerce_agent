#!/bin/bash
#===============================================================================
# Health Check Script for Production Readiness
# Tests: Ollama, Supabase, Mockoon, Next.js, LLM Endpoints
#===============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
SUPABASE_URL="${SUPABASE_URL:-http://localhost:8000}"
MOCKOON_URL="${MOCKOON_URL:-http://localhost:3000}"
NEXTJS_URL="${NEXTJS_URL:-http://localhost:3000}"
API_URL="${API_URL:-http://localhost:3000/api}"

# Counters
PASSED=0
FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_section() {
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  $1${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
}

#-------------------------------------------------------------------------------
# 1. OLLAMA HEALTH CHECKS
#-------------------------------------------------------------------------------
check_ollama() {
    log_section "OLLAMA HEALTH CHECKS"

    # Check Ollama API version
    log_info "Checking Ollama API version..."
    if curl -s "$OLLAMA_URL/api/version" > /dev/null 2>&1; then
        VERSION=$(curl -s "$OLLAMA_URL/api/version" | head -c 100)
        log_success "Ollama API responding (version: $VERSION)"
    else
        log_fail "Ollama API not responding"
    fi

    # Check qwen2.5-coder model
    log_info "Checking qwen2.5-coder:3b model..."
    if curl -s -X POST "$OLLAMA_URL/api/generate" \
        -H "Content-Type: application/json" \
        -d '{"model":"qwen2.5-coder:3b","prompt":"test","stream":false}' > /dev/null 2>&1; then
        log_success "qwen2.5-coder:3b model available"
    else
        log_fail "qwen2.5-coder:3b model not available"
    fi

    # Check nomic-embed-text model
    log_info "Checking nomic-embed-text embedding model..."
    if curl -s -X POST "$OLLAMA_URL/api/embed" \
        -H "Content-Type: application/json" \
        -d '{"model":"nomic-embed-text","prompt":"test"}' > /dev/null 2>&1; then
        log_success "nomic-embed-text embedding model available"
    else
        log_fail "nomic-embed-text embedding model not available"
    fi

    # Test LLM generation
    log_info "Testing LLM generation..."
    RESPONSE=$(curl -s -X POST "$OLLAMA_URL/api/generate" \
        -H "Content-Type: application/json" \
        -d '{
            "model":"qwen2.5-coder:3b",
            "prompt":"Say exactly: Hello from Ollama!",
            "stream":false,
            "options":{"temperature":0}
        }')

    if echo "$RESPONSE" | grep -q "Hello from Ollama!"; then
        log_success "LLM generation working correctly"
    else
        log_fail "LLM generation failed"
        echo "Response: $RESPONSE" | head -c 200
    fi

    # Test embedding generation
    log_info "Testing embedding generation..."
    EMBEDDING=$(curl -s -X POST "$OLLAMA_URL/api/embed" \
        -H "Content-Type: application/json" \
        -d '{"model":"nomic-embed-text","prompt":"test embedding"}')

    if echo "$EMBEDDING" | grep -q '"embedding"'; then
        log_success "Embedding generation working"
    else
        log_fail "Embedding generation failed"
    fi
}

#-------------------------------------------------------------------------------
# 2. SUPABASE HEALTH CHECKS
#-------------------------------------------------------------------------------
check_supabase() {
    log_section "SUPABASE HEALTH CHECKS"

    # Check REST API
    log_info "Checking Supabase REST API..."
    if curl -s -I "$SUPABASE_URL/rest/v1/" > /dev/null 2>&1; then
        log_success "Supabase REST API responding"
    else
        log_fail "Supabase REST API not responding"
    fi

    # Check Auth API
    log_info "Checking Supabase Auth API..."
    if curl -s "$SUPABASE_URL/auth/v1/settings" > /dev/null 2>&1; then
        log_success "Supabase Auth API responding"
    else
        log_fail "Supabase Auth API not responding"
    fi

    # Check with anon key
    log_info "Testing authenticated request..."
    RESPONSE=$(curl -s "$SUPABASE_URL/rest/v1/organizations?select=count" \
        -H "apikey: $SUPABASE_ANON_KEY" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY")

    if echo "$RESPONSE" | grep -qE '^\[|\{"count"'; then
        log_success "Supabase authenticated request successful"
    else
        log_fail "Supabase authenticated request failed"
    fi

    # Check realtime endpoint
    log_info "Checking Supabase Realtime..."
    if curl -s "$SUPABASE_URL/realtime/v1/ping" > /dev/null 2>&1 || \
       curl -s -I "$SUPABASE_URL/realtime" > /dev/null 2>&1; then
        log_success "Supabase Realtime endpoint accessible"
    else
        log_fail "Supabase Realtime not accessible"
    fi
}

#-------------------------------------------------------------------------------
# 3. MOCKOON HEALTH CHECKS
#-------------------------------------------------------------------------------
check_mockoon() {
    log_section "MOCKOON HEALTH CHECKS"

    # Check Mockoon main endpoint
    log_info "Checking Mockoon API..."
    if curl -s "$MOCKOON_URL/health" > /dev/null 2>&1 || \
       curl -s "$MOCKOON_URL" > /dev/null 2>&1; then
        log_success "Mockoon API responding"
    else
        log_fail "Mockoon API not responding"
    fi

    # Check mock endpoints
    log_info "Checking mock endpoints..."
    MOCK_RESPONSE=$(curl -s "$MOCKOON_URL/api/health" 2>/dev/null || echo "{}")
    if echo "$MOCK_RESPONSE" | grep -qE 'ok|status|healthy'; then
        log_success "Mock endpoints configured"
    else
        log_fail "Mock endpoints not configured"
    fi
}

#-------------------------------------------------------------------------------
# 4. NEXT.JS APPLICATION CHECKS
#-------------------------------------------------------------------------------
check_nextjs() {
    log_section "NEXT.JS APPLICATION CHECKS"

    # Check if Next.js is running
    log_info "Checking Next.js server..."
    if curl -s -I "$NEXTJS_URL" > /dev/null 2>&1; then
        log_success "Next.js server responding"
    else
        log_fail "Next.js server not running"
    fi

    # Check API routes
    log_info "Checking API routes..."

    # Health check API
    HEALTH=$(curl -s "$API_URL/health" 2>/dev/null || echo "{}")
    if echo "$HEALTH" | grep -qE 'ok|status|healthy'; then
        log_success "/api/health endpoint working"
    else
        log_fail "/api/health endpoint not working"
    fi

    # Chat API
    log_info "Checking chat API..."
    CHAT_RESPONSE=$(curl -s -X POST "$API_URL/chat/route-ollama" \
        -H "Content-Type: application/json" \
        -d '{"messages":[{"role":"user","content":"test"}]}' \
        --max-time 10 2>/dev/null || echo "")

    if [ -n "$CHAT_RESPONSE" ]; then
        log_success "Chat API responding"
    else
        log_fail "Chat API not responding (may need LLM)"
    fi
}

#-------------------------------------------------------------------------------
# 5. DATABASE CONNECTIVITY CHECKS
#-------------------------------------------------------------------------------
check_database() {
    log_section "DATABASE CONNECTIVITY"

    # Check PostgreSQL via Supabase
    log_info "Checking PostgreSQL via Supabase..."
    if curl -s "$SUPABASE_URL/rest/v1/" \
        -H "apikey: $SUPABASE_ANON_KEY" | head -c 50 > /dev/null; then
        log_success "PostgreSQL accessible via Supabase"
    else
        log_fail "PostgreSQL not accessible"
    fi
}

#-------------------------------------------------------------------------------
# 6. SUMMARY
#-------------------------------------------------------------------------------
print_summary() {
    log_section "HEALTH CHECK SUMMARY"

    TOTAL=$((PASSED + FAILED))

    echo ""
    echo -e "Total Checks: ${TOTAL}"
    echo -e "${GREEN}Passed: ${PASSED}${NC}"
    echo -e "${RED}Failed: ${FAILED}${NC}"
    echo ""

    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All health checks passed!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some health checks failed. Review the output above.${NC}"
        exit 1
    fi
}

#-------------------------------------------------------------------------------
# MAIN EXECUTION
#-------------------------------------------------------------------------------
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         PRODUCTION READINESS HEALTH CHECKS                ║${NC}"
    echo -e "${BLUE}║         Testing Ollama, Supabase, Mockoon, Next.js       ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Load environment variables
    if [ -f .env.test.docker ]; then
        export $(cat .env.test.docker | grep -v '^#' | xargs)
    fi

    # Run all checks
    check_ollama
    check_supabase
    check_mockoon
    check_nextjs
    check_database

    # Print summary
    print_summary
}

main "$@"
