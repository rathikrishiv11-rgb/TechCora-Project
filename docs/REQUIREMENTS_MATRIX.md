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
| Invoice list, picker, save, aggregate view | Pending Phase 3 | Schema and indexes are ready. |
| Dynamic concurrent-sale and 60-line receipt demo | Pending Phase 3 | Transaction and live-update design is documented. |
| 1× and 10× performance measurements | Pending Phase 4 | Measurement and growth scripts still required. |
| README and DIAGNOSIS.md | In progress | README updated per phase; final diagnosis follows measured reproduction. |
