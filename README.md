# StockERP

StockERP is a performance-focused ERP prototype for batch-based inventory. It is being built from the masked production export supplied for the TechCora internship exercise.

## Phase 1 status

The foundation is complete:

- Next.js and TypeScript application shell
- PostgreSQL access through Drizzle ORM
- Runtime environment validation
- Local PostgreSQL configuration
- Health endpoint at `/api/health`
- Lint, type-check, test, and production-build scripts
- Git exclusions for secrets and the confidential dataset

## Requirements

- Node.js 22 or newer
- npm 11 or newer
- PostgreSQL 16+ or Docker Desktop

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev
```

Open `http://localhost:3000` and check `http://localhost:3000/api/health`.

If Docker is unavailable, set `DATABASE_URL` in `.env.local` to any PostgreSQL or Neon development database.

## Confidential dataset

Do not copy the export into a tracked directory and do not commit it. Set `ERP_EXPORT_PATH` to its absolute local path. The import tooling added in the next phase will read from that path.

The repository ignores common data directories, ZIP archives, JSONL files, local databases, and files beginning with `cora-erp-masked`.

## Quality commands

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Run all checks with `npm run check`.

The current npm audit warnings are confined to development-only linting and migration CLI dependency trees. `npm audit --omit=dev` reports the deployable dependency set separately; do not apply npm's suggested forced downgrade because it would replace the current Next.js and Drizzle tooling with incompatible older majors.

## Planned phases

1. Foundation and safe local environment
2. Export analysis, relational model, import, and reconciliation
3. Invoice list, material picker, invoice save, and aggregate view
4. Concurrency demo, 10× dataset, measurements, documentation, and deployment
