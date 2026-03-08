#!/bin/bash
echo "🐘 Starting PostgreSQL + pgvector..."

# Clean up existing container if present
if docker ps -a --format '{{.Names}}' | grep -q "^smart-commerce-postgres$"; then
  echo "⚠️  Removing existing container..."
  docker stop smart-commerce-postgres 2>/dev/null
  docker rm smart-commerce-postgres 2>/dev/null
fi

docker run -d \
  --name smart-commerce-postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=techtrend \
  -v vercel_ai_sdk_postgres_data:/var/lib/postgresql/data \
  --health-cmd="pg_isready -U postgres -d techtrend" \
  --health-interval=5s \
  --health-timeout=5s \
  --health-retries=10 \
  pgvector/pgvector:pg16

echo "⏳ Waiting for PostgreSQL to be healthy..."
until docker exec smart-commerce-postgres pg_isready -U postgres -d techtrend; do
  sleep 1
done
echo "✅ PostgreSQL ready at localhost:5432"
echo "📊 Test: docker exec smart-commerce-postgres psql -U postgres -d techtrend -c 'SELECT version();'"
