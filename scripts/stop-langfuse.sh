#!/bin/bash
echo "🛑 Stopping Langfuse..."
docker stop smart-commerce-langfuse
docker rm smart-commerce-langfuse
echo "✅ Langfuse stopped and removed"
