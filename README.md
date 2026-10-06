# StockERP

StockERP is a performance-focused ERP prototype for batch-based inventory. It is being built from the masked production export supplied for the TechCora internship exercise.

## Project status

Phases 1 and 2 are complete:

- Next.js and TypeScript application shell
- PostgreSQL access through Drizzle ORM
- Runtime environment validation
- Local PostgreSQL configuration
- Health endpoint at `/api/health`
- Lint, type-check, test, and production-build scripts
- Git exclusions for secrets and the confidential dataset
- Full masked-export profiler and transformation pipeline
- Normalized relational ERP schema and indexes
- Explicit anomaly ledger for broken or ambiguous source relationships
- Count, invoice-total, and stock-quantity reconciliation
- Transactional PostgreSQL importer (dry-run unless `--write` is supplied)

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

## Analyze and import the export

Extract the supplied ZIP outside Git, then run:

```powershell
npm run data:analyze -- C:\absolute\path\cora-erp-masked.json
npm run data:import -- C:\absolute\path\cora-erp-masked.json
npm run data:reconcile -- C:\absolute\path\cora-erp-masked.json
npm run data:verify-db -- C:\absolute\path\cora-erp-masked.json
```

`data:import` is a dry run unless `--write` is explicitly provided. To write after migrations have run:

```powershell
$env:DATABASE_URL = "postgresql://..."
npm run db:migrate
npm run data:import -- C:\absolute\path\cora-erp-masked.json --write
```

Generated reports go under the ignored `data/reports/` directory. Design decisions and reproducible findings are committed in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DATA_PROFILE.md`](docs/DATA_PROFILE.md).

`data:verify-db` creates an isolated embedded PostgreSQL instance, applies the real migrations, loads the entire export, and compares database row counts. It does not replace the production Neon deployment, but it catches real constraints and SQL incompatibilities without needing cloud credentials.

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

1. Complete — foundation and safe local environment
2. Complete — export analysis, relational model, import, and reconciliation
3. Next — invoice list, material picker, invoice save, and aggregate view
4. Concurrency demo, 10× dataset, measurements, documentation, and deployment
