# Task requirements matrix

| Brief requirement | Phase 2 status | Evidence / next phase |
| --- | --- | --- |
| Diagnose the freeze and account for every measurement | Pending Phase 4 | Requires the complete measurement section and browser reproduction; data evidence is now captured in `DATA_PROFILE.md`. |
| Cost formula and 12-month/10× prediction | Pending Phase 4 | Dataset cardinalities and skew required by the formula are now reproducible. |
| Separate freeze from general slowness | Pending Phase 4 | Architecture already removes full-tree browser reads; final diagnosis will distinguish CPU work from network/query latency. |
| Data model and indexed read paths | Complete | `src/db/schema.ts` and `ARCHITECTURE.md`. |
| Derived data ownership and partial-failure behavior | Complete | Same-transaction critical summaries; rebuildable reporting summaries documented. |
| Keep or replace database and server decision | Complete | PostgreSQL plus Next.js server, with rationale. |
| Survivable migration with loose ends | Complete as design and tooling | Dry-run importer, anomaly ledger, embedded-PostgreSQL full import, reconciliation, and live cutover/rollback plan. Cloud execution awaits deployment credentials. |
| Full masked dataset transformation script | Complete and database verified | All source and nested-line counts reconcile after applying the generated SQL migrations; dataset remains uncommitted. |
| Invoice list, picker, save, aggregate view | Complete | `/invoices`, `/invoices/new`, `/`, `/movements`, and their bounded API routes run against Neon. |
| Dynamic concurrent-sale and 60-line receipt demo | Complete | Live proof on 2026-10-06: competing quantity-2 sales against quantity 3 produced one `201`, one `409`, and stock 1; receipt `phase3-receipt-60-20261006` contains exactly 60 committed lines. |
| 1× and 10× performance measurements | Pending Phase 4 | Measurement and growth scripts still required. |
| README and DIAGNOSIS.md | In progress | README is current through Phase 3; final diagnosis follows Phase 4 measurements. |
