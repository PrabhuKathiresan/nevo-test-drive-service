# Hosting Guide

## Recommended: AWS ECS Fargate + RDS

The application is fully containerised (Docker Compose locally), which makes ECS Fargate the natural production target - no EC2 instances to manage, containers scale independently, and the same Docker images used locally run in production.

```
                        ┌─────────────────────────────────┐
                        │           AWS Cloud             │
                        │                                 │
  Users ──► Route 53 ──► ALB ──► ECS Fargate              │
                        │         ├── Backend Task        │
                        │         └── Frontend Task       │
                        │              │                  │
                        │         RDS PostgreSQL          │
                        │         (Multi-AZ)              │
                        └─────────────────────────────────┘
```

### Components

| Component | Service | Notes |
|---|---|---|
| Backend API | ECS Fargate (task) | `backend/Dockerfile`, port 3000 |
| Frontend | ECS Fargate (task) | `frontend/Dockerfile`, port 5173 |
| Database | RDS PostgreSQL 16 | Multi-AZ for production, single-AZ for staging |
| Load Balancer | Application Load Balancer | Routes `/api/*` to backend, `/*` to frontend |
| DNS | Route 53 | Maps domain to ALB |
| Secrets | AWS Secrets Manager | `DATABASE_URL`, any future API keys |
| Container Registry | ECR | Stores built Docker images |
| CI/CD | GitHub Actions | Build → push to ECR → deploy to ECS |

---

### Why ECS Fargate over EC2

- No instance management - AWS handles patching, scaling, placement
- Pay per task second, not per idle instance
- Native Docker support - same image runs locally and in production
- Auto-scaling per service (backend scales independently of frontend)

### Why RDS over self-managed PostgreSQL

- Automated backups and point-in-time recovery
- Multi-AZ failover with no application changes
- Managed minor version upgrades
- Storage autoscaling

---

## Deployment Pipeline

```
git push → GitHub Actions
  1. Build Docker images
  2. Push to ECR
  3. Run prisma migrate deploy (migration job, single task)
  4. Update ECS service (rolling deployment)
  5. Health check on /health before marking deploy complete
```

Migrations run as a **separate ECS task before the rolling deploy** - ensures schema is updated before new code instances start, and prevents concurrent migration attempts from multiple tasks.

---

## Scaling Strategy

| Layer | Approach |
|---|---|
| Frontend | Scale ECS tasks horizontally (stateless) |
| Backend | Scale ECS tasks horizontally (stateless, advisory lock is per-DB not per-instance) |
| Database | Scale vertically first; add read replicas for read-heavy load; shard by `(type, location)` for write-heavy load |

The advisory lock (`pg_try_advisory_xact_lock`) works correctly across multiple backend instances because the lock lives in PostgreSQL, not in application memory.

---

## Environment Variables

| Variable | Where | How |
|---|---|---|
| `DATABASE_URL` | Backend task | Injected from Secrets Manager at task startup |
| `NODE_ENV` | Backend task | Set in task definition (`production`) |
| `VITE_API_TARGET` | Frontend build arg | Set to ALB backend URL at build time |

---

## Staging vs Production

Run two ECS clusters - `staging` and `production` - backed by separate RDS instances. GitHub Actions deploys to staging on merge to `main`, and to production on a tagged release. This mirrors the same Docker images across environments with only environment variables differing.
