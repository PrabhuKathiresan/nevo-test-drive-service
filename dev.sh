#!/usr/bin/env bash
set -euo pipefail

# Reviewer setup script — installs Docker if not present, then spins up the full stack.

# ── Docker ────────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "Docker not found. Installing..."
  if [[ "$(uname)" == "Darwin" ]]; then
    if ! command -v brew &>/dev/null; then
      echo "Homebrew not found. Install it from https://brew.sh then re-run this script."
      exit 1
    fi
    brew install --cask docker
    echo "Docker installed. Please start Docker Desktop, then re-run this script."
    exit 0
  elif [[ "$(uname)" == "Linux" ]]; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "Docker installed. Log out and back in if you hit permission errors, then re-run."
  else
    echo "Unsupported OS. Install Docker manually: https://docs.docker.com/get-docker/"
    exit 1
  fi
fi

if ! docker info &>/dev/null; then
  echo "Docker is not running. Please start Docker Desktop and re-run this script."
  exit 1
fi

# ── Build & start ─────────────────────────────────────────────────────────────
echo "Building and starting services..."
docker compose up --build -d

# ── Wait for backend ──────────────────────────────────────────────────────────
echo "Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000/health &>/dev/null; then
    break
  fi
  sleep 2
done

# ── Migrate & seed ────────────────────────────────────────────────────────────
echo "Running migrations..."
docker compose exec backend npm run db:migrate

echo "Seeding data..."
docker compose exec backend npm run db:seed

echo ""
echo "Nevo Test Drive Service is running"
echo "  API:      http://localhost:3000"
echo "  Frontend: http://localhost:5173"
