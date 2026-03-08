#!/bin/bash
echo "🛑 Stopping PostgreSQL..."
docker stop smart-commerce-postgres
docker rm smart-commerce-postgres
echo "✅ PostgreSQL stopped and removed"
