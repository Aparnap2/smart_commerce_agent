#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

[ -f .venv/bin/activate ] && source .venv/bin/activate

uvicorn src.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --reload-dir src
