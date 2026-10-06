# Task requirements matrix

| Brief requirement | Phase 2 status | Evidence / next phase |
| --- | --- | --- |
| Diagnose the freeze and account for every measurement | Complete | `DIAGNOSIS.md`, `docs/PERFORMANCE.md`, and the checked-in machine-readable benchmark. |
| Cost formula and 12-month/10× prediction | Complete | Formula, measured 10× workload, and linear twelve-month projection are in `DIAGNOSIS.md`. |
| Separate freeze from general slowness | Complete | Diagnosis separates wait latency, synchronous main-thread work, and excessive rendering. |
| Data model and indexed read paths | Complete | `src/db/schema.ts` and `ARCHITECTURE.md`. |
| Derived data ownership and partial-failure behavior | Complete | Same-transaction critical summaries; rebuildable reporting summaries documented. |
| Keep or replace database and server decision | Complete | PostgreSQL plus Next.js server, with rationale. |
| Survivable migration with loose ends | Complete as design and tooling | Dry-run importer, anomaly ledger, embedded-PostgreSQL full import, reconciliation, and live cutover/rollback plan. Cloud execution awaits deployment credentials. |
| Full masked dataset transformation script | Complete and database verified | All source and nested-line counts reconcile after applying the generated SQL migrations; dataset remains uncommitted. |
| Invoice list, picker, save, aggregate view | Complete | `/invoices`, `/invoices/new`, `/`, `/movements`, and their bounded API routes run against Neon. |
| Dynamic concurrent-sale and 60-line receipt demo | Complete | Live locking proof plus `npm run demo:dynamic -- --pause`, which packages the exact 12 units/two batches, concurrent quantity-10 sale, and 60-line receipt scenario for recording. |
| 1× and 10× performance measurements | Complete | Physical data benchmark plus real Chrome traces at 4× CPU for every built screen; scripts and JSON artifacts are checked in. |
| README and DIAGNOSIS.md | Complete | Includes architecture, formulas, caveats, exact evidence, and deployment instructions. |
