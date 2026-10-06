# StockERP architecture and migration design

## Decision

Use PostgreSQL behind the Next.js server. The browser never receives or scans the database tree. PostgreSQL is chosen because invoice creation, FIFO batch consumption, movements, and derived stock must commit atomically; row locks and constraints directly model that requirement. Neon is the deployment target and ordinary PostgreSQL is supported locally.

The current exported document tree is not used as the application read model. Master records and embedded line arrays are normalized, while immutable snapshots and complete source JSON are retained for auditability.

## Stored versus derived

Stored source-of-truth data:

- invoices and invoice lines;
- purchase orders, receipts, and their lines;
- stock batches and immutable stock movements;
- invoice-to-batch allocations containing the historical unit cost;
- material, customer, vendor, unit, and location masters;
- original source JSON and an explicit anomaly ledger.

Synchronous derived data:

- `stock_batches.quantity_remaining`;
- `material_stock_summary` per material and location;
- invoice totals and batch-allocation COGS for newly created invoices.

Rebuildable derived data:

- dashboard daily totals;
- movement running balances, computed by an indexed window query for the requested material and range;
- search keys.

Critical stock values are updated in the same PostgreSQL transaction as their invoice, allocation, and movement. Dashboard summaries may be rebuilt from committed invoices and allocations. Historical COGS is not invented where the export does not identify consumed batches.

## Read paths

| Screen | Query shape | Round trips after initial navigation |
| --- | --- | ---: |
| Invoice list | Keyset/page query over `invoice_date,id`, optional indexed invoice/customer search; returns only requested rows | 1 |
| Invoice detail/editor | Invoice plus lines; material search is a separate debounced request | 1 initial + search requests |
| Material picker | Indexed material search joined to `material_stock_summary`; batches fetched only after selection and only where quantity is positive | 1 search, 1 batch drill-down |
| Stock levels | Summary rows paged by material/location; batch history fetched on drill-down | 1 + optional drill-down |
| Movement report | One material and bounded date range using `(material_id,movement_at,id)` index; running balance via SQL window function | 1 |
| Dashboard | Daily summary range plus small recent-invoice query | 2 parallel |

No screen downloads all invoices, movements, materials, or batches.

## Invoice write path

One server request and one database transaction:

1. Claim a client-generated idempotency key.
2. Validate customer, lines, prices, and positive quantities.
3. Lock eligible positive stock batches for each material in FIFO order with `FOR UPDATE`.
4. Recalculate availability under the lock.
5. Reject the whole request if any line cannot be fulfilled.
6. Insert invoice and lines.
7. Insert batch allocations and immutable outbound movements.
8. Decrement batch quantities and update material/location summaries.
9. Update rebuildable daily totals.
10. Commit, then notify live clients of affected material versions.

A failure before commit changes nothing. A dropped client connection may leave a committed request, so retrying the same idempotency key returns the original result instead of selling twice.

## Dynamic event

Open editors subscribe to small post-commit stock-version events. They refresh only affected material summaries. These events improve the user experience but are not the correctness mechanism. The final row-locked availability check always runs at save time, so a stale editor cannot oversell.

A 60-line receipt is also one transaction: receipt, lines, batches, inbound movements, and summary increments either all commit or all roll back.

## Import and loose ends

`scripts/import-export.ts` supports a safe dry run by default. `--write` is required for database mutation. Each run records the file SHA-256, source counts, outcome, transformed counts, and anomalies.

Rules:

- Parse numeric strings into fixed-precision numeric values.
- Keep all external IDs as opaque text.
- Use map keys as canonical IDs and retain embedded IDs.
- Resolve vendor references through both key and embedded-ID aliases.
- Recover sales movement links only when an invoice number in the note matches exactly.
- Leave unverifiable links null and record an anomaly; never fabricate a foreign key.
- Keep invoice customer snapshots even when the master has changed.
- Keep zero-quantity batches for history but exclude them from picker reads.
- Keep original JSON in every imported source row.

## Live migration plan

1. Deploy the new schema alongside the existing system.
2. Take an initial export and run the importer using its SHA-256 and count reconciliation.
3. Run read-only shadow traffic and compare invoice, stock, and report results.
4. Introduce a short write freeze or dual-write/outbox bridge for the final delta.
5. Import the delta idempotently and run reconciliation again.
6. Switch reads, then writes, to the new server.
7. Keep the old system read-only for rollback and audit.
8. Reconcile stock batches and movements daily during the stabilization period.

Rollback is a routing change while the old system remains read-only-capable. No source export is discarded.

## Known limitations after Phase 2

- The supplied stock rows do not contain an explicit receipt-line key, so historical batch-to-receipt links and exact historical FIFO allocations cannot be proven.
- Historical COGS cannot be reconstructed exactly without the missing consumed-batch allocation or original application logic.
- The migrations and full import have been verified against isolated embedded PostgreSQL. Publishing the data to the deployment database still requires the production Neon `DATABASE_URL`.
