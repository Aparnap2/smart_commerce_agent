#!/bin/bash
# Agent Core Stop Script
# Usage: ./scripts/stop.sh

set -e

cd "$(dirname "$0")/.."

echo "🛑 Stopping Agent Core..."

# Find and kill uvicorn processes
pids=$(lsof -t -i :8000 2>/dev/null || true)

if [ -z "$pids" ]; then
    echo "✅ No Agent Core process running on port 8000"
else
    echo "   Found processes: $pids"
    kill $pids 2>/dev/null || true
    sleep 2
    
    # Force kill if still running
    if lsof -i :8000 > /dev/null 2>&1; then
        echo "   Force killing..."
        kill -9 $pids 2>/dev/null || true
    fi
    
    echo "✅ Agent Core stopped"
fi

# Clean up log file (optional)
if [ "$1" = "--clean" ]; then
    rm -f /tmp/agent-core.log
    echo "✅ Logs cleaned"
fi
