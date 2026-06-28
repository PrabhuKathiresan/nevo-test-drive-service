#!/usr/bin/env bash
set -euo pipefail

# Reviewer setup script (Podman) — requires Podman and a running Podman machine.
# Setup instructions: https://podman.io/getting-started/installation
#   macOS: brew install podman && podman machine init && podman machine start

# ── Podman ────────────────────────────────────────────────────────────────────
if ! command -v podman &>/dev/null; then
  echo "Error: Podman not found."
  echo "Install it first and then re-run this script."
  echo "  macOS:  brew install podman"
  echo "  Linux:  https://podman.io/getting-started/installation"
  exit 1
fi

# ── Podman machine (macOS only — Podman needs a Linux VM) ─────────────────────
if [[ "$(uname)" == "Darwin" ]]; then
  if ! podman machine list --format '{{.Running}}' 2>/dev/null | grep -q 'true'; then
    echo "Error: No running Podman machine found."
    echo "Start one first and then re-run this script."
    echo "  podman machine init   # first time only"
    echo "  podman machine start"
    exit 1
  fi
fi

if ! podman info &>/dev/null; then
  echo "Error: Podman daemon is not reachable. Ensure your Podman machine is running."
  exit 1
fi

# ── Build & start ─────────────────────────────────────────────────────────────
echo "Building and starting services..."
podman compose up --build -d

# ── Wait for backend ──────────────────────────────────────────────────────────
echo "Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/health &>/dev/null; then
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "Backend did not start in time. Check logs: podman compose logs backend"
    exit 1
  fi
  sleep 2
done

# ── Migrate & seed ────────────────────────────────────────────────────────────
echo "Running migrations..."
podman compose exec backend npm run db:migrate

echo "Seeding data..."
podman compose exec backend npm run db:seed

echo ""
echo "Nevo Test Drive Service is running"
echo "  API:      http://localhost:3000"
echo "  Frontend: http://localhost:5173"
