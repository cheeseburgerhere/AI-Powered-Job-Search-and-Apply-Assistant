#!/usr/bin/env bash

# Start both backend and frontend dev servers.
# Usage: ./dev.sh       (start both)
#        ./dev.sh stop  (kill ports used by both)

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

BACKEND_PORT=8000
FRONTEND_PORT=5173

BACKEND_PID=""
FRONTEND_PID=""

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Killing processes on port $port: $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

cleanup() {
  echo ""
  echo "Stopping servers..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  echo "Done."
  exit 0
}

ensure_backend_env() {
  if [ ! -f "$BACKEND_DIR/venv/bin/activate" ]; then
    echo "Creating backend virtual environment..."
    python3 -m venv "$BACKEND_DIR/venv"
  fi

  if ! "$BACKEND_DIR/venv/bin/python" -c "import uvicorn" >/dev/null 2>&1; then
    echo "Installing backend dependencies..."
    "$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
  fi

  if [ ! -f "$BACKEND_DIR/.env" ] && [ -f "$BACKEND_DIR/.env.example" ]; then
    cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
    echo "Created backend/.env from .env.example"
  fi
}

ensure_frontend_env() {
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd "$FRONTEND_DIR" && npm install)
  fi
}

trap cleanup SIGINT SIGTERM

if [ "${1:-}" = "stop" ]; then
  echo "Stopping backend and frontend ports..."
  kill_port 8000
  kill_port 8001
  kill_port 5173
  kill_port 5174
  kill_port 5175
  echo "Done."
  exit 0
fi

if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
  echo "Could not find backend/frontend folders relative to: $SCRIPT_DIR"
  exit 1
fi

ensure_backend_env
ensure_frontend_env

echo "🚀 Starting AI Job Assistant dev servers..."
echo ""

# Proactively clear the exact ports this script will use.
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

echo "📦 Backend → http://localhost:$BACKEND_PORT"
(
  cd "$BACKEND_DIR" || exit 1
  # shellcheck disable=SC1091
  source venv/bin/activate
  exec uvicorn app.main:app --reload --port "$BACKEND_PORT" --host 0.0.0.0
) &
BACKEND_PID=$!

echo "⚛️  Frontend → http://localhost:$FRONTEND_PORT"
(
  cd "$FRONTEND_DIR" || exit 1
  exec npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" --strictPort
) &
FRONTEND_PID=$!

echo ""
echo "Press Ctrl+C to stop both servers."
wait
