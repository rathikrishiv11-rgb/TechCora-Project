# Why the original ERP freezes

## Executive diagnosis

The freeze is a browser main-thread problem caused by an unbounded read model. The original client downloads a document-tree export containing masters, documents, embedded lines, stock batches, and movement history, then parses and repeatedly traverses that tree to derive screen values. Network and database latency make the wait longer, but they do not explain the frozen tab: a tab freezes when synchronous parse, transformation, formula, and rendering work occupies the main thread for more than one frame, with tasks over 50 ms classified as long tasks.

The supplied export is 11,696,988 bytes uncompressed and 1,857,828 bytes gzipped. It contains 2,869 invoices, 5,211 invoice lines, 2,656 batches, and 7,761 movements. A measured parse plus complete traversal visits 454,324 values and occupies one synchronous task for 89.89 ms at 1×. The same measured operation over a real 10× payload takes 948.34 ms and visits 4,543,241 values. That is a visible freeze before framework reconciliation, formula recomputation, layout, paint, or garbage collection are included.

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

## Evidence and limits

Exact measurements and methodology are in `docs/PERFORMANCE.md` and `docs/benchmarks/phase4-results.json`. The 10× database is synthetic but physical and isolated; it preserves the source cardinalities and query shapes without modifying Neon. Browser/network times vary by device, geography, cold starts, and connection. Historical COGS is incomplete because the export omits consumed-batch allocation links; this limitation is retained instead of inventing costs.
