#!/bin/bash
# Start all infrastructure services for e-commerce agent

echo "🚀 Starting infrastructure services..."

# PostgreSQL with pgvector
docker run -d --name postgres-pgvector \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ecommerce \
  -p 5432:5432 \
  pgvector/pgvector:pg17

# Redis Stack (includes Redis UI on port 8001)
docker run -d --name redis-stack \
  -p 6379:6379 \
  -p 8001:8001 \
  redis/redis-stack-server:7.2.0-v10

# Ollama (if not running)
docker run -d --name ollama \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama

echo "✅ All services started!"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo "  - Redis UI: localhost:8001"
echo "  - Ollama: localhost:11434"
