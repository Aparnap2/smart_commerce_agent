#!/bin/bash
# Stop all infrastructure services

echo "🛑 Stopping infrastructure services..."
docker stop postgres-pgvector redis-stack ollama 2>/dev/null || echo "Some services were not running"
echo "✅ Services stopped"
