#!/bin/bash
echo "📊 Starting Langfuse (requires PostgreSQL + ClickHouse)..."
echo "⚠️  NOTE: Langfuse v3 requires ClickHouse. For local dev without ClickHouse, use langfuse/langfuse:2 or see docs."

# Clean up existing container if present
if docker ps -a --format '{{.Names}}' | grep -q "^smart-commerce-langfuse$"; then
  echo "⚠️  Removing existing container..."
  docker stop smart-commerce-langfuse 2>/dev/null
  docker rm smart-commerce-langfuse 2>/dev/null
fi

# Check if PostgreSQL is running
if ! docker ps --format '{{.Names}}' | grep -q "^smart-commerce-postgres$"; then
  echo "❌ PostgreSQL must be running first. Run: ./scripts/start-postgres.sh"
  exit 1
fi

docker run -d \
  --name smart-commerce-langfuse \
  -p 3001:3000 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/langfuse \
  -e NEXTAUTH_SECRET=local-langfuse-secret-min-32-chars-xx \
  -e NEXTAUTH_URL=http://localhost:3001 \
  -e SALT=local-langfuse-salt-min-32-chars-xxx \
  -e TELEMETRY_ENABLED=false \
  -e CLICKHOUSE_URL=http://localhost:8123 \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD= \
  -e CLICKHOUSE_CLUSTER_ENABLED=false \
  --add-host=host.docker.internal:host-gateway \
  langfuse/langfuse:latest

echo "⏳ Waiting for Langfuse to start (45 seconds)..."
sleep 45

# Check if container is still running
if docker ps --format '{{.Names}}' | grep -q "^smart-commerce-langfuse$"; then
  echo "✅ Langfuse container running at http://localhost:3001"
  echo "📊 Test: curl -sf http://localhost:3001/api/public/health && echo '✅'"
  echo "⚠️  If health check fails, ClickHouse may be required. See Langfuse docs."
else
  echo "❌ Langfuse container exited. Check logs: docker logs smart-commerce-langfuse"
  echo "💡 Langfuse v3 requires ClickHouse. Consider using langfuse/langfuse:2 for local dev."
fi
