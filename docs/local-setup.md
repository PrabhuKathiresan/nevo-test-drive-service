# Local Setup Guide

## Prerequisites

- [Node.js 22](https://nodejs.org) (or use `nvm`: `nvm use`)
- Docker or [Podman Desktop](https://podman-desktop.io)

---

## Option 1 - One-step reviewer setup

Installs Docker if not present, builds all services, runs migrations and seed data.

```bash
./dev.sh
```

| Service  | URL                      |
|---------|--------------------------|
| API      | http://localhost:3000    |
| Frontend | http://localhost:5173    |

---

## Option 2 - Local development (hot reload)

Run only PostgreSQL in a container and start the backend and frontend directly for fast hot reload.

### 1. Start PostgreSQL

```bash
# Docker
docker compose up postgres -d

# Podman
podman compose up postgres -d
```

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:
```
DATABASE_URL=postgresql://nevo:nevo@localhost:5432/nevo_test_drive
```

```bash
npx prisma migrate deploy
npx ts-node prisma/seed.ts
npm run dev
```

Backend available at `http://localhost:3000`.

### 3. Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend available at `http://localhost:5173`.

---

## Running Tests

### Backend

Requires PostgreSQL to be running.

```bash
cd backend
npm test
```

### Frontend

No database required - tests use mocked fetch.

```bash
cd frontend
npm test
```

---

## Configuring the Frontend

Vehicle type and location are passed via URL query parameters:

```
http://localhost:5173?vehicleType=tesla_model3&location=dublin
http://localhost:5173?vehicleType=tesla_modelx&location=cork
http://localhost:5173?vehicleType=tesla_modely&location=dublin
```

Defaults to `tesla_model3` / `dublin` if no params are provided.

---

## Seed Data

The seed script loads from `backend/prisma/data/vehicles.json` and `backend/prisma/data/reservations.json`. Re-running it uses upsert so it is safe to run multiple times.

---

## Stopping Services

```bash
# Docker
docker compose down

# Podman
podman compose down

# Also remove the database volume
docker compose down -v
```
