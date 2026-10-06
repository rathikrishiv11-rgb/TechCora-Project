# Masked export profile

Generated from `cora-erp-masked.json` with `npm run data:analyze -- <path>`. The dataset itself and generated JSON reports remain Git-ignored.

Source SHA-256: `2e48d531a20a5a7e314be0a24c1b04d3854bd819807aa7d46eaed0bd5e596044`

## Record counts

| Collection | Records |
| --- | ---: |
| Materials | 1,346 |
| Customers | 203 |
| Vendors | 59 |
| Units | 20 |
| Storage locations across both paths | 3 |
| Invoices | 2,869 |
| Invoice lines | 5,211 |
| Purchase orders | 1,053 |
| Purchase-order lines | 3,050 |
| Purchase receipts | 1,068 |
| Receipt lines | 2,680 |
| Stock batches | 2,656 |
| Stock movements | 7,761 |
| Stock adjustments | 22 |
| Direct deliveries | 2 |

## Evidence affecting the design

- 1,558 of 2,656 stock batches have zero remaining quantity. Batch history cannot be fetched wholesale for the material picker.
- 4,637 of 5,240 sales movements use `relatedDocumentId: "new"`. The importer recovered 4,635 through the invoice number in the note; two refer to an invoice number absent from the export.
- 22 movements point to seven deleted or absent materials. Their source material IDs are retained and their relational foreign keys are left null.
- 1,002 material IDs are 13-digit timestamps; 344 use another generated-ID format. IDs therefore remain opaque text.
- 39 vendor records have an embedded ID different from their map key. The importer uses the key as canonical and resolves both values as aliases.
- Three invoice customer snapshots differ from the current customer master. Both the canonical customer reference and immutable invoice snapshot are retained.
- The largest invoice has 100 lines; 1,863 invoices have one line.
- The busiest material has 525 movements. The material with the most batches has 137.
- Storage locations occur under `inventory/storageLocations` and `inventory/storage_locations`; the source path is retained.
- Nineteen of 20 unit records have an empty code, so unit codes are nullable and indexed rather than treated as unique identifiers.
- At least one purchase order has an out-of-range `+082026` expected-delivery year. It is retained in `source_data`, omitted from the typed date column, and recorded as an anomaly.
- Ten purchase-order numbers and two receipt numbers are duplicated. Document numbers are indexed for lookup but are not used as identifiers; source record IDs remain the primary keys.
- Quantity and price fields contain both numbers and numeric strings. They are parsed into fixed-precision PostgreSQL numeric columns.

## Transformation result

Dry-run transformation produces exactly the expected count for every top-level and line collection. Reconciliation also preserves:

- Invoice grand total: `19,359,055.67`
- Current stock quantity: `29,891.5500`

The current anomaly ledger contains 466 entries. It includes 337 movements whose source document cannot be established without inventing a relationship, 39 vendor key/ID mismatches, broken material references, four genuinely missing vendors, three customer-snapshot drifts, duplicate purchasing document numbers, one invalid date, and one aggregate note explaining the absent historical batch-to-receipt key.

The generated migrations were applied to an isolated embedded PostgreSQL instance and the full transformed dataset was inserted successfully. All verified table counts matched the source counts with zero mismatches.
