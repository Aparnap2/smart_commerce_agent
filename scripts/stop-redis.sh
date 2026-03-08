#!/bin/bash
echo "🛑 Stopping Redis..."
docker stop smart-commerce-redis
docker rm smart-commerce-redis
echo "✅ Redis stopped and removed"
