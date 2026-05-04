#!/bin/bash
set -e

echo "=== Starting services for E2E test ==="

# Start agent in background
cd /home/aparna/Desktop/vercel-ai-sdk/apps/agent-core
uv run --with uvicorn python3 -m uvicorn main:app --port 8000 &
AGENT_PID=$!
echo "Agent started: $AGENT_PID"

# Start web in background
cd /home/aparna/Desktop/vercel-ai-sdk/apps/web
pnpm dev &
WEB_PID=$!
echo "Web started: $WEB_PID"

# Wait for services
echo "Waiting for services..."
sleep 15

# Verify
echo "Checking services..."
curl -s http://localhost:8000/health || echo "Agent failed"
curl -s -o /dev/null -w "Web: %{http_code}\n" http://localhost:3000/ || echo "Web failed"

# Run Cypress
echo "Running Cypress..."
cd /home/aparna/Desktop/vercel-ai-sdk/apps/web
npx cypress run --spec "cypress/e2e/b2b-approval.cy.ts" --browser chrome --headless

# Cleanup
kill $AGENT_PID $WEB_PID 2>/dev/null || true