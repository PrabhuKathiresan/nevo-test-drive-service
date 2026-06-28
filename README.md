# Nevo Test Drive Service

On-demand scheduling of EV test drives. Customers check vehicle availability and book a slot in a single flow.

## Quick Start

```bash
./dev.sh
```

Installs Docker if needed, then starts the full stack — PostgreSQL, API, and frontend — in one step.

| Service  | URL                      |
|---------|--------------------------|
| API      | http://localhost:3000    |
| Frontend | http://localhost:5173    |

## Documentation

| Doc | Description |
|-----|-------------|
| [Local Setup Guide](docs/local-setup.md) | Full setup for local development and reviewer setup |
| [Hosting Guide](docs/hosting.md) | Production hosting on AWS ECS Fargate + RDS |
| [High-Level Design](docs/hld.md) | Architecture, data model, availability rules, concurrency, testing strategy |
| [Low-Level Design](docs/lld.md) | Detailed request flow diagrams for each endpoint |
| [API Contracts](docs/api-contracts.md) | Request/response shapes, error codes, constraints |
| [Design Decisions](docs/decisions.md) | Key technology and approach decisions with rationale |

## Tech Stack

| Layer    | Technology                        |
|---------|----------------------------------|
| Frontend | React + TypeScript + Vite        |
| Backend  | Node.js + TypeScript + Express   |
| ORM      | Prisma                           |
| Database | PostgreSQL                       |
| Tests    | Jest (BE) · Vitest + RTL (FE)    |
| Runtime  | Docker / Podman                  |
