import { randomUUID } from "node:crypto";

import { PGlite } from "@electric-sql/pglite";
import { count, sql as drizzleSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgTable } from "drizzle-orm/pg-core";

import * as schema from "../src/db/schema.ts";
import { anomalyRows, transformExport } from "./lib/transform.ts";
import { loadExport } from "./lib/source.ts";

const { absolutePath, data, sha256 } = await loadExport();
const transformed = transformExport(data);
const client = new PGlite();
const db = drizzle(client, { schema });

await migrate(db, { migrationsFolder: "drizzle" });
const importRunId = randomUUID();
await db.insert(schema.importRuns).values({ id: importRunId, sourceFile: absolutePath, sourceSha256: sha256, status: "running", sourceCounts: transformed.counts });

await db.transaction(async (tx) => {
  await insertChunks(transformed.units, (rows) => tx.insert(schema.units).values(rows));
  await insertChunks(transformed.storageLocations, (rows) => tx.insert(schema.storageLocations).values(rows));
  await insertChunks(transformed.materials, (rows) => tx.insert(schema.materials).values(rows));
  await insertChunks(transformed.customers, (rows) => tx.insert(schema.customers).values(rows));
  await insertChunks(transformed.vendors, (rows) => tx.insert(schema.vendors).values(rows));
  await insertChunks(transformed.purchaseOrders, (rows) => tx.insert(schema.purchaseOrders).values(rows));
  await insertChunks(transformed.purchaseOrderLines, (rows) => tx.insert(schema.purchaseOrderLines).values(rows));
  await insertChunks(transformed.purchaseReceipts, (rows) => tx.insert(schema.purchaseReceipts).values(rows));
  await insertChunks(transformed.purchaseReceiptLines, (rows) => tx.insert(schema.purchaseReceiptLines).values(rows));
  await insertChunks(transformed.invoices, (rows) => tx.insert(schema.invoices).values(rows));
  await insertChunks(transformed.invoiceLines, (rows) => tx.insert(schema.invoiceLines).values(rows));
  await insertChunks(transformed.stockBatches, (rows) => tx.insert(schema.stockBatches).values(rows));
  await insertChunks(transformed.stockMovements, (rows) => tx.insert(schema.stockMovements).values(rows));
  await insertChunks(transformed.stockAdjustments, (rows) => tx.insert(schema.stockAdjustments).values(rows));
  await insertChunks(transformed.directDeliveries, (rows) => tx.insert(schema.directDeliveries).values(rows));
  await insertChunks(transformed.directDeliveryLines, (rows) => tx.insert(schema.directDeliveryLines).values(rows));
  await insertChunks(anomalyRows(transformed.anomalies, importRunId), (rows) => tx.insert(schema.importAnomalies).values(rows));
  await tx.execute(drizzleSql`
    insert into material_stock_summary (material_id, location_id, available_quantity, inventory_value, version, updated_at)
    select material_id, coalesce(location_id, 'UNSPECIFIED'), sum(quantity_remaining), sum(quantity_remaining * coalesce(unit_cost, 0)), 1, now()
    from stock_batches where material_id is not null group by material_id, coalesce(location_id, 'UNSPECIFIED')
  `);
});

const databaseCounts = {
  materials: await rowCount(schema.materials), invoices: await rowCount(schema.invoices), invoiceLines: await rowCount(schema.invoiceLines),
  purchaseOrders: await rowCount(schema.purchaseOrders), purchaseOrderLines: await rowCount(schema.purchaseOrderLines), purchaseReceipts: await rowCount(schema.purchaseReceipts),
  purchaseReceiptLines: await rowCount(schema.purchaseReceiptLines), stockBatches: await rowCount(schema.stockBatches), stockMovements: await rowCount(schema.stockMovements),
  stockAdjustments: await rowCount(schema.stockAdjustments), customers: await rowCount(schema.customers), vendors: await rowCount(schema.vendors), units: await rowCount(schema.units),
};

const expected = transformed.counts;
const mismatches = Object.entries(databaseCounts).filter(([name, actual]) => actual !== expected[name]);
console.log(JSON.stringify({ migrated: true, imported: true, databaseCounts, anomalyRows: await rowCount(schema.importAnomalies), mismatches }, null, 2));
await client.close();
if (mismatches.length > 0) process.exitCode = 1;

async function rowCount(table: PgTable): Promise<number> {
  const [row] = await db.select({ value: count() }).from(table);
  return row.value;
}

async function insertChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>, chunkSize = 500): Promise<void> {
  for (let index = 0; index < rows.length; index += chunkSize) await insert(rows.slice(index, index + chunkSize));
}
