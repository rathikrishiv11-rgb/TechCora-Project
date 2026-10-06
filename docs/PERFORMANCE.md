# Performance verification

## Method

Run:

```powershell
npm run benchmark -- data/export/cora-erp-masked.json --output=docs/benchmarks/phase4-results.json
```

The benchmark uses the real confidential export locally but writes only aggregate counts and timing results. It measures a real 1× and 10× JSON parse/traversal workload, then loads normalized projections into an isolated PostgreSQL-compatible PGlite database. The 10× database contains physical duplicated rows with unique IDs, not a multiplied timing estimate. Each query receives three warmups and 20 measured iterations; the report uses nearest-rank p95. No benchmark records are written to Neon.

Machine and runtime results vary, so the checked-in JSON is evidence for this run rather than a universal SLA.

## Results

| Read path | 1× p95 | 10× p95 | 1× bytes | 10× bytes | Round trips |
| --- | ---: | ---: | ---: | ---: | ---: |
| Invoice page, 25 rows | 1.77 ms | 2.13 ms | 5,413 | 5,502 | 1 |
| Invoice substring search | 8.16 ms | 63.52 ms | 4,917 | 5,021 | 1 |
| Material picker, 20 rows | 4.14 ms | 24.93 ms | 2,415 | 2,537 | 1 |
| Movement page, 25 rows | 1.81 ms | 2.29 ms | 5,929 | 6,027 | 1 |
| Dashboard lifetime aggregate | 1.63 ms | 8.47 ms | 48 | 50 | 1 |

| Legacy workload | 1× | 10× |
| --- | ---: | ---: |
| Raw bytes | 11,696,988 | 116,969,891 |
| Values visited | 454,324 | 4,543,241 |
| JSON parse | 63.68 ms | 673.60 ms |
| Walk/derive | 26.21 ms | 274.74 ms |
| Longest synchronous task | 89.89 ms | 948.34 ms |

The bounded application transfers about 0.02%–0.05% of the 1× legacy raw payload for its primary list/search calls. More importantly, visible response size remains approximately constant at 10×.

## Dynamic correctness evidence

Phase 3 deliberately raced two quantity-2 invoices against a quantity-3 batch. One transaction committed, the other returned HTTP 409 with one unit available, and the final batch quantity was exactly one. A separate 60-line receipt committed all of its lines, batches, movements, and summary increments in one transaction. See `PHASE3_VERIFICATION.md`.

## Interpretation

Invoice and movement pagination use date/ID indexes and are effectively insensitive to 10× cardinality at this scale. Substring searches intentionally trade more CPU for flexible matching; their 10× p95 remains interactive but is the first candidate for trigram indexing. The dashboard currently favors an accurate lifetime aggregate; the included summary-rebuild tool enables the constant-size daily-summary path after its backfill has been verified on the target database.
