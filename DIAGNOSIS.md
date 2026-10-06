# Why the original ERP freezes

## Executive diagnosis

The freeze is a browser main-thread problem caused by an unbounded read model. The original client downloads a document-tree export containing masters, documents, embedded lines, stock batches, and movement history, then parses and repeatedly traverses that tree to derive screen values. Network and database latency make the wait longer, but they do not explain the frozen tab: a tab freezes when synchronous parse, transformation, formula, and rendering work occupies the main thread for more than one frame, with tasks over 50 ms classified as long tasks.

The supplied export is 11,696,988 bytes uncompressed and 1,857,828 bytes gzipped. It contains 2,869 invoices, 5,211 invoice lines, 2,656 batches, and 7,761 movements. A measured parse plus complete traversal visits 454,324 values and occupies one synchronous task for 89.89 ms at 1×. The same measured operation over a real 10× payload takes 948.34 ms and visits 4,543,241 values. That is a visible freeze before framework reconciliation, formula recomputation, layout, paint, or garbage collection are included.

The 55-second edit freeze is more specific than that baseline. The profile says one click issues about 2,700 local queries and spends 93% of its time in the realtime database client. Each query asks for batches for one material, and the client re-sorts its cached stock list for every query. The browser is therefore using a general database query engine thousands of times as an inner loop over the same 2,656-row batch collection.

## Accounting for the awkward measurements

- **No network during the freeze:** the realtime client already subscribed to the whole stock tree and retained it in memory. The queries are answered locally. The roughly 10 KB of traffic is incidental; removing the network would not remove the 55-second task.
- **Five-line and 35-line invoices take the same time:** initialization is not proportional to the selected invoice. The application must be precomputing availability or query-backed controls across the material catalogue/form state. Roughly 2,700 is almost twice the 1,346-material catalogue, which is consistent with two stock-related query passes per material. This is an inference; source instrumentation is needed to prove the exact loop.
- **Read-only is quick:** it renders stored snapshots and lines without constructing the editable material/batch controls and their stock queries.
- **New purchase order takes about two thirds as long:** it shares the expensive material-picker/stock initialization but omits sales-only work such as customer, invoice allocation, tax/payment, or outbound-stock state. Calibrated from 38/55, it likely executes about 1,865 equivalent local queries versus roughly 2,700 for invoice edit. Again, the call count is the confirmation measurement.
- **Four-times CPU turns 38 seconds into 164 seconds:** 164/38 = 4.32, close to CPU scaling and far from a network-bound signature. The small excess is consistent with garbage collection and browser scheduling.
- **Dashboard downloads 22 MB from an 11.7 MB database:** it reads the full invoice list four times plus other lists instead of sharing one bounded aggregate result. Multiple subscriptions and protocol overhead can exceed the unique database size.
- **Dashboard, stock list, and later navigation are generally slow but not the same bug:** wholesale transfers, unreleased subscriptions, 19,600 DOM nodes, and client aggregates waste bandwidth/memory/rendering. The minute-long hang is the nested local-query loop. Pagination and server aggregates fix general slowness; replacing the per-material local-query loop fixes the hang.

## Cost model

For the legacy screen:

```text
T_ready ≈ N_requests × RTT
        + transferred_bytes / connection_throughput
        + JSON_bytes / parse_throughput
        + visited_nodes × transform_cost
        + rendered_nodes × reconciliation_and_layout_cost
        + garbage_collection
```

The key failure is that `JSON_bytes`, `visited_nodes`, and often `rendered_nodes` grow with the entire ERP history instead of with the visible screen. At 10 Mbit/s, even the current 1.86 MB compressed export has a theoretical transfer floor near 1.49 seconds before RTT and server time. A roughly linear 10× payload raises that floor to about 14.9 seconds; the measured client-side synchronous task then adds almost one second of complete unresponsiveness.

For the edit hang itself, let `Q` be local stock queries, `S` retained batch rows, `c_filter` the per-row match cost, and `c_sort` the comparison cost:

```text
T_edit ≈ Q × [S × c_filter + S × log2(S) × c_sort] + T_form + T_GC
```

Today `Q ≈ 2,700` and `S = 2,656`. The reported rough average of 28 ms/query would imply 75.6 seconds; the observed 55 seconds implies about 20.4 ms/query after accounting for sampling, query variation, and the word “roughly.” Both support the same order of magnitude and profile attribution.

The export spans 18 active months. Receipt lines have accumulated at about 149 per month, so another year adds about 1,787 batch rows and takes `S` to approximately 4,443 if cleanup behavior remains unchanged. With `Q` fixed and sort-dominated cost, `(4,443 log 4,443)/(2,656 log 2,656) ≈ 1.78`, predicting about **98 seconds** on the fast laptop. At literal 10× batch volume with the current catalogue, the ratio is about 12.9, predicting roughly **710 seconds (11.8 minutes)**. If “10×” also means 10× materials and thus 10× initialization queries, the upper-bound model is about 129×, or nearly two hours. These are scenario predictions, not false precision; instrumenting `Q`, scan counts, and sort counts is the next step.

This separates three symptoms:

- Database or network slowness: the page is waiting but the browser can still respond.
- Main-thread freeze: input, scrolling, and paint stop while parse/traversal/formulas run synchronously.
- Excessive rendering: the browser remains busy reconciling and laying out thousands of rows after data processing.

## Formula and consistency risk

The legacy tree also encourages totals and stock to be recomputed independently in multiple clients. That produces both wasted `O(n)` work and correctness risk: two editors can each calculate availability 12, then both sell 10. UI refreshes cannot solve that race.

StockERP moves the authoritative formula to one PostgreSQL transaction:

```text
line_total = round(quantity × unit_price − discount, 2)
invoice_total = sum(line_total)
available(material, location) = sum(positive batch.quantity_remaining)
COGS = sum(allocation.quantity × allocation.unit_cost)
gross_profit = invoice_total − COGS
```

Material/location advisory locks and FIFO batch row locks serialize competing sales. Invoice, lines, allocations, movements, batch decrements, stock summary, and daily summary either all commit or all roll back. The client-generated request ID and payload fingerprint make retries idempotent.

Batch identity must not be flattened away. Two batches of the same material can have different landed costs, receipt dates, vendors, quality, or traceability obligations. A single material quantity could prevent overselling, but it would destroy actual-cost COGS and the ability to trace which receipt was sold. StockERP therefore keeps batches as source of truth, allocations as the historical sales-to-batch link, and a material/location summary only as a rebuildable read model.

## Replacement read model

The browser receives only the visible projection:

- invoice page: 25 rows;
- material search: at most 20 summary rows for one location;
- positive batches: fetched only for a selected material;
- movement page: 25 rows;
- dashboard: daily summaries plus six recent invoices and eight low-stock rows.

At 10× data, measured response bodies remain between 50 bytes and 6.1 KB because the result cardinality is bounded. The worst measured 10× database p95 is 63.52 ms for substring invoice search. Ordinary invoice and movement pages remain near 2 ms p95 in the isolated PostgreSQL-compatible benchmark.

## Twelve-month prediction

The export spans 18 active months, averaging about 159 invoices and 431 movements per month. A linear twelve-month projection adds roughly 1,913 invoices and 5,174 movements, taking the dataset to about 4,782 invoices and 12,935 movements. If the monolithic payload grows proportionally, it reaches approximately 19.5 MB uncompressed and the legacy freeze worsens with every month.

The replacement does not promise that storage or background maintenance is free; it makes interactive cost depend on page size and selected filters. The remaining growth-sensitive path is leading-wildcard search. Its 10× p95 is still below 65 ms in this run, but production growth beyond that should add PostgreSQL trigram indexes or a dedicated search vector.

## What the evidence cannot prove

Without the original source code, bundle, and an instrumented reproduction I cannot prove:

- the exact call stack that creates the 2,700 queries;
- whether it is two passes per material, reactive recomputation, duplicated subscriptions, or all three;
- which fields are used by the repeated comparator and whether the vendor library rebuilds an index;
- how much of the remaining 7% is framework rendering, formulas, or garbage collection;
- whether listeners are accidentally registered more than once during component remounts.

I would wrap the database client query method to record call count, arguments, result count, caller stack, and duration; add User Timing marks around editor initialization phases; record allocation/GC and DOM-node counters; then rerun edit, read-only, and purchase-order flows with stock-query setup selectively disabled. A query count close to two per material, disappearing when the picker is disabled, would confirm the inferred loop.

## Failures, rebuilds, and trade-offs

- **Two people sell the last units:** deterministic material/location advisory locks and `FOR UPDATE` batch locks make the second transaction observe the first transaction’s committed remainder. Insufficient stock rejects the whole invoice.
- **Derived update fails halfway:** stock summary and daily summary writes share the invoice transaction, so an exception rolls everything back. Reporting summaries can also be rebuilt from invoices, allocations, batches, and movements.
- **Connection drops after commit:** retrying the same request ID and identical fingerprint returns the original invoice instead of selling again. Reusing the ID with different content returns a conflict.
- **Bad export record:** the importer retains source JSON, uses nullable foreign keys for unverifiable links, records an anomaly, and never invents a relationship.
- **A summary is wrong:** reconciliation compares batch sums and document totals to summaries; `data:rebuild-summaries` rebuilds the reporting projection transactionally. The old summary stays available if a rebuild cannot start.
- **What became harder:** writes now require a server and database transaction; schema changes require migrations; offline direct-database editing is gone; flexible substring search will eventually need trigram/search infrastructure.
- **What may be briefly stale:** dashboard/reporting projections and an open editor’s displayed availability. **What may never be stale at commit:** locked batch availability, allocations, movements, invoice totals, and stock decrements.

## Evidence and limits

Exact measurements and methodology are in `docs/PERFORMANCE.md` and `docs/benchmarks/phase4-results.json`. The 10× database is synthetic but physical and isolated; it preserves the source cardinalities and query shapes without modifying Neon. Browser/network times vary by device, geography, cold starts, and connection. Historical COGS is incomplete because the export omits consumed-batch allocation links; this limitation is retained instead of inventing costs.
