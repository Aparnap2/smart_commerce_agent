#!/bin/bash
# Test each container one by one (sequential, not parallel)

echo "🧪 SEQUENTIAL CONTAINER TESTING"
echo "================================"

# Test PostgreSQL
echo -e "\n🐘 1/3: Testing PostgreSQL..."
./scripts/start-postgres.sh
docker exec smart-commerce-postgres psql -U postgres -d techtrend -c "SELECT version();"
docker exec smart-commerce-postgres psql -U postgres -d techtrend -c "SELECT COUNT(*) FROM \"Product\";" 2>/dev/null || echo "⚠️  No Product table yet (run migrate first)"
./scripts/stop-postgres.sh

# Test Redis
echo -e "\n🔴 2/3: Testing Redis..."
./scripts/start-redis.sh
docker exec smart-commerce-redis redis-cli DBSIZE
./scripts/stop-redis.sh

# Test Langfuse (requires PostgreSQL)
echo -e "\n📊 3/3: Testing Langfuse..."
./scripts/start-postgres.sh  # Need postgres for langfuse - keep it running
docker exec smart-commerce-postgres psql -U postgres -c "CREATE DATABASE langfuse;" 2>/dev/null || echo "Database already exists"

./scripts/start-langfuse.sh

./scripts/stop-langfuse.sh
./scripts/stop-postgres.sh  # Now stop postgres

echo -e "\n✅ ALL CONTAINERS TESTED SEQUENTIALLY"
