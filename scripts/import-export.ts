import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql as drizzleSql } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "../src/db/schema.ts";
import { anomalyRows, transformExport } from "./lib/transform.ts";
import { loadExport } from "./lib/source.ts";

const writeToDatabase = process.argv.includes("--write");
const { absolutePath, data, sha256 } = await loadExport();
const transformed = transformExport(data);
const anomalyCounts = Object.fromEntries(
  [...new Set(transformed.anomalies.map((anomaly) => anomaly.code))].sort().map((code) => [code, transformed.anomalies.filter((anomaly) => anomaly.code === code).length]),
);

const report = {
  generatedAt: new Date().toISOString(),
  mode: writeToDatabase ? "database" : "dry-run",
  source: { path: absolutePath, sha256 },
  counts: transformed.counts,
  transformedCounts: tableCounts(transformed),
  anomalies: { total: transformed.anomalies.length, byCode: anomalyCounts },
};

if (writeToDatabase) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required with --write.");
  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client, { schema });
  const importRunId = randomUUID();

  await db.insert(schema.importRuns).values({ id: importRunId, sourceFile: absolutePath, sourceSha256: sha256, status: "running", sourceCounts: transformed.counts });
  try {
    await db.transaction(async (tx) => {
      await insertChunks(transformed.units, (rows) => tx.insert(schema.units).values(rows).onConflictDoNothing());
      await insertChunks(transformed.storageLocations, (rows) => tx.insert(schema.storageLocations).values(rows).onConflictDoNothing());
      await insertChunks(transformed.materials, (rows) => tx.insert(schema.materials).values(rows).onConflictDoNothing());
      await insertChunks(transformed.customers, (rows) => tx.insert(schema.customers).values(rows).onConflictDoNothing());
      await insertChunks(transformed.vendors, (rows) => tx.insert(schema.vendors).values(rows).onConflictDoNothing());
      await insertChunks(transformed.purchaseOrders, (rows) => tx.insert(schema.purchaseOrders).values(rows).onConflictDoNothing());
      await insertChunks(transformed.purchaseOrderLines, (rows) => tx.insert(schema.purchaseOrderLines).values(rows).onConflictDoNothing());
      await insertChunks(transformed.purchaseReceipts, (rows) => tx.insert(schema.purchaseReceipts).values(rows).onConflictDoNothing());
      await insertChunks(transformed.purchaseReceiptLines, (rows) => tx.insert(schema.purchaseReceiptLines).values(rows).onConflictDoNothing());
      await insertChunks(transformed.invoices, (rows) => tx.insert(schema.invoices).values(rows).onConflictDoNothing());
      await insertChunks(transformed.invoiceLines, (rows) => tx.insert(schema.invoiceLines).values(rows).onConflictDoNothing());
      await insertChunks(transformed.stockBatches, (rows) => tx.insert(schema.stockBatches).values(rows).onConflictDoNothing());
      await insertChunks(transformed.stockMovements, (rows) => tx.insert(schema.stockMovements).values(rows).onConflictDoNothing());
      await insertChunks(transformed.stockAdjustments, (rows) => tx.insert(schema.stockAdjustments).values(rows).onConflictDoNothing());
      await insertChunks(transformed.directDeliveries, (rows) => tx.insert(schema.directDeliveries).values(rows).onConflictDoNothing());
      await insertChunks(transformed.directDeliveryLines, (rows) => tx.insert(schema.directDeliveryLines).values(rows).onConflictDoNothing());
      await insertChunks(anomalyRows(transformed.anomalies, importRunId), (rows) => tx.insert(schema.importAnomalies).values(rows));

      await tx.delete(schema.materialStockSummary);
      await tx.execute(drizzleSql`
        insert into material_stock_summary (material_id, location_id, available_quantity, inventory_value, version, updated_at)
        select material_id, coalesce(location_id, 'UNSPECIFIED'), sum(quantity_remaining),
          sum(quantity_remaining * coalesce(unit_cost, 0)), 1, now()
        from stock_batches
        where material_id is not null
        group by material_id, coalesce(location_id, 'UNSPECIFIED')
      `);
    });
    await db.update(schema.importRuns).set({ status: "completed", completedAt: new Date(), importedCounts: report.transformedCounts }).where(eq(schema.importRuns.id, importRunId));
  } catch (error) {
    await db.update(schema.importRuns).set({ status: "failed", completedAt: new Date(), errorMessage: error instanceof Error ? error.message : String(error) }).where(eq(schema.importRuns.id, importRunId));
    throw error;
  } finally {
    await client.end();
  }
}

const outputPath = resolve("data/reports/import-report.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, ...report }, null, 2));

async function insertChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>, chunkSize = 500): Promise<void> {
  for (let index = 0; index < rows.length; index += chunkSize) await insert(rows.slice(index, index + chunkSize));
}

function tableCounts(value: ReturnType<typeof transformExport>): Record<string, number> {
  return {
    units: value.units.length, storageLocations: value.storageLocations.length, materials: value.materials.length,
    customers: value.customers.length, vendors: value.vendors.length, invoices: value.invoices.length, invoiceLines: value.invoiceLines.length,
    purchaseOrders: value.purchaseOrders.length, purchaseOrderLines: value.purchaseOrderLines.length, purchaseReceipts: value.purchaseReceipts.length,
    purchaseReceiptLines: value.purchaseReceiptLines.length, stockBatches: value.stockBatches.length, stockMovements: value.stockMovements.length,
    stockAdjustments: value.stockAdjustments.length, directDeliveries: value.directDeliveries.length, directDeliveryLines: value.directDeliveryLines.length,
  };
}
