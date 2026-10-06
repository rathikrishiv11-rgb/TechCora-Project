import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  childRecords,
  collectionCounts,
  entries,
  isRecord,
  loadExport,
  numericValue,
  textValue,
} from "./lib/source.ts";

type TypeHistogram = Record<string, Record<string, number>>;

function addType(histogram: TypeHistogram, field: string, value: unknown): void {
  const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  histogram[field] ??= {};
  histogram[field][type] = (histogram[field][type] ?? 0) + 1;
}

function typeProfile(records: Array<[string, Record<string, unknown>]>): TypeHistogram {
  const result: TypeHistogram = {};
  for (const [, record] of records) {
    for (const [field, value] of Object.entries(record)) addType(result, field, value);
  }
  return result;
}

const { absolutePath, data, sha256 } = await loadExport();
const materialIds = new Set(Object.keys(data.inventory.materials));
const invoiceByNumber = new Map(entries(data.sales.invoices).map(([id, invoice]) => [textValue(invoice.invoiceNumber), id]));
const invoiceLineRecords = entries(data.sales.invoices).flatMap(([invoiceId, invoice]) => childRecords(invoice, "items").map((line, index) => [`${invoiceId}:${index}`, line] as const));
const stockRecords = entries(data.inventory.stockLevels);
const movementRecords = entries(data.inventory.transactions);

const salesMovements = movementRecords.filter(([, movement]) => textValue(movement.transactionType).toLowerCase() === "sales");
const unresolvedSales = salesMovements.filter(([, movement]) => textValue(movement.relatedDocumentId) === "new");
let recoverableSalesLinks = 0;
for (const [, movement] of unresolvedSales) {
  const match = textValue(movement.notes).match(/Invoice\s+#(.+?)\s+-\s+Batch:/i);
  if (match && invoiceByNumber.has(match[1])) recoverableSalesLinks += 1;
}

const movementCountsByMaterial = new Map<string, number>();
for (const [, movement] of movementRecords) {
  const materialId = textValue(movement.itemId);
  movementCountsByMaterial.set(materialId, (movementCountsByMaterial.get(materialId) ?? 0) + 1);
}
const batchCountsByMaterial = new Map<string, number>();
for (const [, batch] of stockRecords) {
  const materialId = textValue(batch.itemId);
  batchCountsByMaterial.set(materialId, (batchCountsByMaterial.get(materialId) ?? 0) + 1);
}

const customerDrift = entries(data.sales.invoices).filter(([, invoice]) => {
  const customerId = textValue(invoice.customerId);
  const current = data.sales.customers[customerId];
  const snapshot = isRecord(invoice.customer) ? invoice.customer : undefined;
  return current && snapshot && JSON.stringify(current) !== JSON.stringify(snapshot);
}).length;

const report = {
  generatedAt: new Date().toISOString(),
  source: { path: absolutePath, sha256 },
  counts: collectionCounts(data),
  evidence: {
    zeroQuantityBatches: stockRecords.filter(([, batch]) => numericValue(batch.quantity) === 0).length,
    salesMovements: salesMovements.length,
    salesMovementsWithPlaceholderDocumentId: unresolvedSales.length,
    placeholderLinksRecoverableFromNotes: recoverableSalesLinks,
    movementReferencesToMissingMaterials: movementRecords.filter(([, movement]) => !materialIds.has(textValue(movement.itemId))).length,
    distinctMissingMaterialIdsInMovements: new Set(movementRecords.filter(([, movement]) => !materialIds.has(textValue(movement.itemId))).map(([, movement]) => textValue(movement.itemId))).size,
    vendorKeyIdMismatches: entries(data.purchasing.vendors).filter(([key, vendor]) => key !== textValue(vendor.id)).length,
    embeddedCustomerSnapshotsDifferentFromMaster: customerDrift,
    timestampMaterialIds: [...materialIds].filter((id) => /^\d{13}$/.test(id)).length,
    nonTimestampMaterialIds: [...materialIds].filter((id) => !/^\d{13}$/.test(id)).length,
    maxInvoiceLines: Math.max(...entries(data.sales.invoices).map(([, invoice]) => childRecords(invoice, "items").length)),
    oneLineInvoices: entries(data.sales.invoices).filter(([, invoice]) => childRecords(invoice, "items").length === 1).length,
    maxMovementsForOneMaterial: Math.max(...movementCountsByMaterial.values()),
    maxBatchesForOneMaterial: Math.max(...batchCountsByMaterial.values()),
  },
  fieldTypes: {
    movements: typeProfile(movementRecords),
    invoiceLines: typeProfile(invoiceLineRecords.map(([key, line]) => [key, line])),
    stockBatches: typeProfile(stockRecords),
  },
};

const outputArg = process.argv.find((argument) => argument.startsWith("--output="));
const outputPath = resolve(outputArg?.slice("--output=".length) ?? "data/reports/profile.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ outputPath, counts: report.counts, evidence: report.evidence }, null, 2));
