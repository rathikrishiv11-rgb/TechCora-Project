# Demo video runbook

The task requires a demo video, not a hosted deployment. Record a concise walkthrough using the full Neon-backed application and this order.

## 1. Problem and diagnosis

- Show the figures in `DIAGNOSIS.md`: 2,700 local stock queries, 2,656 retained batch rows, no network during the 55-second task, and the `Q × S log S` cost model.
- Explain why equal timing across 5–35 invoice lines points to catalogue/editor initialization, and why purchase order is roughly two thirds of invoice edit.
- Explain why batches cannot be flattened: actual-cost COGS and receipt traceability depend on them.

## 2. Architecture and normal workflows

- Dashboard: bounded aggregates and small alert lists.
- Invoice list: page, sort, and search while showing that only 25 rows are returned.
- Invoice editor: debounced material search, location availability, positive batches with unit cost, explicit batch choice, and FIFO fallback.
- Movement report: bounded audit rows.
- Explain server ownership of transactions, advisory locks, batch row locks, allocations, idempotent retry, and rebuildable summaries.

## 3. Dynamic event live

Start the production build, then run:

```powershell
$env:STOCKERP_BASE_URL = "http://localhost:3000"
npm run demo:dynamic -- --pause
```

The script chooses a zero-stock masked material and atomically receives two batches of six. While it pauses:

1. Open `/invoices/new`.
2. Select the reported location and material.
3. Show 12 available units, two positive batches, their unit costs, and the batch selector.
4. Resume the script. It concurrently saves a colleague’s quantity-10 invoice and a 60-line receipt.
5. Keep the editor visible. Its bounded five-second refresh changes availability without reloading the database tree.
6. Show the script’s assertions: availability `62`, receipt line count `60`, and exactly `61` new movements—one sales movement plus 60 receipt movements.
7. Attempt to sell more than the displayed availability and show HTTP/UI rejection with no partial stock change.

## 4. Measurements and limitations

- Show both JSON artifacts under `docs/benchmarks` and the tables in `docs/PERFORMANCE.md`.
- State plainly that the browser harness uses actual screen cardinalities and Chrome tracing but synthetic masked-shaped rows; database timings use the transformed full dataset and a physical 10× copy.
- Call out the one near-miss if present in the recorded run and the future trigram-index threshold.
- State limitations: no production authentication/authorization, historical batch allocations cannot be reconstructed, and background polling is eventual UI freshness while transaction locks provide correctness.

Finish with the GitHub repository URL. Upload the recording to a shareable location and email the repository link plus video link to `info@techcoracorp.com` before the deadline.
