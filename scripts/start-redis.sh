#!/bin/bash
echo "🔴 Starting Redis..."

# Clean up existing container if present
if docker ps -a --format '{{.Names}}' | grep -q "^smart-commerce-redis$"; then
  echo "⚠️  Removing existing container..."
  docker stop smart-commerce-redis 2>/dev/null
  docker rm smart-commerce-redis 2>/dev/null
fi

docker run -d \
  --name smart-commerce-redis \
  -p 6379:6379 \
  -v vercel_ai_sdk_redis_data:/data \
  --health-cmd="redis-cli ping" \
  --health-interval=5s \
  --health-timeout=3s \
  --health-retries=10 \
  redis:7-alpine redis-server --appendonly yes

echo "⏳ Waiting for Redis to be healthy..."
until docker exec smart-commerce-redis redis-cli ping; do
  sleep 1
done
echo "✅ Redis ready at localhost:6379"
echo "📊 Test: docker exec smart-commerce-redis redis-cli DBSIZE"
