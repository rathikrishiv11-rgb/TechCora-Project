# Final task audit

Audited against the full “The ERP That Freezes” brief on 2026-10-06.

## Before-you-send checklist

| Brief checkpoint | Result | Evidence |
| --- | --- | --- |
| Diagnosis explains the freeze and every odd measurement | Pass | `DIAGNOSIS.md` covers no network, invoice-line independence, read-only behavior, 2,700 local queries, purchase order at two thirds, 4× CPU scaling, dashboard duplication, and retained subscriptions. |
| Cost formula predicts growth | Pass | `Q × (S + S log S)` edit model, calibrated current cost, approximately 98-second twelve-month prediction, and 10× scenarios in `DIAGNOSIS.md`. |
| Prototype uses the full masked dataset | Pass | 2,869 invoices, 5,211 lines, 7,761 movements, 2,656 batches, and all other source counts imported and reconciled against Neon; source SHA-256 is recorded. |
| Dynamic event is handled while running | Pass in implementation; record it for submission | `npm run demo:dynamic -- --pause` creates exactly 12 units across two batches, concurrently sells 10 and posts a 60-line receipt, and asserts 62 final units and 61 new movements. The editor refreshes all selected summaries/batches in one bounded round trip and the save transaction rechecks locks. |
| Bytes, round trips, longest task at 1×/10× | Pass | `docs/PERFORMANCE.md`, `phase4-results.json`, `browser-results.json`, `benchmark.ts`, and `measure-browser.ts`. Chrome runs at 4× CPU, median of five cold traces. |
| README and DIAGNOSIS are present; dataset absent | Pass | Dataset patterns are ignored; secret/dataset scan is part of final verification. README includes all run commands. |
| Failures, trade-offs, limitations can be explained | Pass | `DIAGNOSIS.md`, `ARCHITECTURE.md`, `DATA_PROFILE.md`, anomaly ledger, transaction/idempotency design, and explicit limitations. |
| Email sent before deadline | Human action required | Record/upload the demo, then email the GitHub repository and video link to `info@techcoracorp.com` by 2026-10-07 23:59 IST. |

## Build minimum

| Required prototype capability | Result |
| --- | --- |
| Invoice list: page, sort, search | Pass: 25-row server pages; number/customer/date/due date/status/total/balance sorting; status filter; invoice/customer search. |
| Material picker with availability and batches | Pass: debounced name/model search, location summary, positive batches, unit costs, explicit batch choice, FIFO fallback. |
| Save invoice | Pass: one transaction for invoice, lines, allocations, one movement per line, batches, stock summary, and daily summary; idempotent retry. |
| Aggregate view | Pass: dashboard and bounded movement report are both present. |
| Transform script | Pass: dry-run-by-default importer, anomaly ledger, live importer, and embedded-PostgreSQL verification. |

## Targets

| Target | Result |
| --- | --- |
| No task over 200 ms at 4× CPU | Pass: worst measured median is 48.09 ms. |
| Usable editor/material search under 1 second | Pass in isolated browser workload: 24.9 ms at 10×, excluding WAN/database latency; live latency remains environment-dependent. |
| List bytes proportional to visible rows | Pass: 25-row pages remain about 5–6 KB. |
| 10× no more than 2× worse | Mostly pass: bytes and trips are flat; editor longest task measured 2.08× while remaining 48.09 ms, explicitly reported. Database substring search grows more than 2× but stays 63.52 ms p95 and is identified for trigram indexing. |
| Stock never negative; derived values not silently wrong | Pass by design and proof: locks reject oversell; synchronous values share the transaction; rebuild/reconciliation tooling covers reporting summaries. |

## Submission decision

Vercel deployment is **not a requirement**. Do not expose the unauthenticated prototype or transmit the Neon credential merely for submission. The required deliverables are the repository and demo video.

## Verification caveat

The locking/idempotency and 60-line receipt paths were proved live during Phase 3. The combined final demo is packaged as `npm run demo:dynamic -- --pause`, but could not be re-recorded during this audit because the supplied Neon endpoint was temporarily unreachable from the audit machine. Run it once while recording when connectivity is available; it fails unless availability is 62, exactly 60 receipt lines were accepted, and 61 new movements were written.
