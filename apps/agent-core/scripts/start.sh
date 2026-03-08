#!/bin/bash
# Agent Core Startup Script
# Usage: ./scripts/start.sh [--reload] [--background]

set -e

cd "$(dirname "$0")/.."

# Default values
RELOAD=""
BACKGROUND=false
PORT=${PORT:-8000}
HOST=${HOST:-0.0.0.0}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --reload)
            RELOAD="--reload"
            shift
            ;;
        --background)
            BACKGROUND=true
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--reload] [--background] [--port PORT]"
            exit 1
            ;;
    esac
done

# Check virtual environment
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Check required environment variables
echo "🔍 Checking environment variables..."
required_vars=("DATABASE_URL" "JWT_SECRET" "OPENAI_BASE_URL" "OPENAI_MODEL")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "⚠️  Warning: Missing environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo "   Set them or use defaults (some features may not work)"
fi

# Check if port is already in use
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "❌ Port $PORT is already in use"
    lsof -i :$PORT
    exit 1
fi

# Start server
echo "🚀 Starting Agent Core on http://$HOST:$PORT"
echo "   Reload mode: ${RELOAD:-disabled}"
echo "   Background: $BACKGROUND"
echo ""

if [ "$BACKGROUND" = true ]; then
    nohup uvicorn main:app \
        --host "$HOST" \
        --port "$PORT" \
        $RELOAD \
        > /tmp/agent-core.log 2>&1 &
    
    PID=$!
    echo "✅ Started in background (PID: $PID)"
    echo "   Logs: tail -f /tmp/agent-core.log"
    echo "   Stop: kill $PID"
    
    # Wait for startup
    sleep 3
    if curl -s http://localhost:$PORT/health > /dev/null 2>&1; then
        echo "✅ Health check passed"
        curl -s http://localhost:$PORT/health | python3 -m json.tool
    else
        echo "⚠️  Health check pending... check logs: tail -f /tmp/agent-core.log"
    fi
else
    uvicorn main:app \
        --host "$HOST" \
        --port "$PORT" \
        $RELOAD
fi
