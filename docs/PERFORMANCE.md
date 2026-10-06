# Performance verification

## Method

Run:

```powershell
npm run benchmark -- data/export/cora-erp-masked.json --output=docs/benchmarks/phase4-results.json
npm run benchmark:browser -- --output=docs/benchmarks/browser-results.json
```

The benchmark uses the real confidential export locally but writes only aggregate counts and timing results. It measures a real 1× and 10× JSON parse/traversal workload, then loads normalized projections into an isolated PostgreSQL-compatible PGlite database. The 10× database contains physical duplicated rows with unique IDs, not a multiplied timing estimate. Each query receives three warmups and 20 measured iterations; the report uses nearest-rank p95. No benchmark records are written to Neon.

The browser measurement launches real headless Chrome, applies DevTools 4× CPU throttling, and takes the median of five cold traces per screen. It records the bounded data response bytes, data round trips, usable time, and longest traced main-thread task. The harness renders the real screen cardinalities with generated masked-shaped rows; it does not expose the confidential dataset to Chrome or pretend to measure WAN/database latency. Database growth cost is measured separately by the physical 1×/10× benchmark above.

Machine and runtime results vary, so the checked-in JSON is evidence for this run rather than a universal SLA.

## Results

### Browser screens at 4× CPU

| Screen | 1× bytes / trips | 1× longest task | 10× bytes / trips | 10× longest task | 10× usable |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dashboard | 2,896 / 1 | 15.29 ms | 2,912 / 1 | 14.04 ms | 20.9 ms |
| Invoice list, 25 rows | 5,087 / 1 | 46.44 ms | 5,114 / 1 | 11.37 ms | 22.3 ms |
| Editor material results, 20 rows | 3,999 / 1 | 23.12 ms | 4,021 / 1 | 48.09 ms | 24.9 ms |
| Movement list, 25 rows | 5,138 / 1 | 12.14 ms | 5,165 / 1 | 10.97 ms | 23.4 ms |

Every screen is below the 200 ms task target and the editor becomes usable well under one second. Response growth is below 1%, and round trips do not grow. The editor trace’s longest task is 2.08× its 1× result, narrowly missing the “no more than 2× worse” target by 0.08× even though it remains only 48.09 ms; this is reported rather than rounded away. Cold-trace scheduling noise is visible in cases where 10× is faster than 1×.

### Database read paths

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
