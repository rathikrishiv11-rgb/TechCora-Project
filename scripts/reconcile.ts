import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { transformExport } from "./lib/transform.ts";
import { loadExport, numericValue } from "./lib/source.ts";

const { absolutePath, data, sha256 } = await loadExport();
const transformed = transformExport(data);

interface ReconciliationCheck {
  name: string;
  expected: number | string;
  actual: number | string;
  passed: boolean;
}

const checks: ReconciliationCheck[] = [
  check("materials preserved", transformed.counts.materials, transformed.materials.length),
  check("customers preserved", transformed.counts.customers, transformed.customers.length),
  check("vendors preserved", transformed.counts.vendors, transformed.vendors.length),
  check("invoices preserved", transformed.counts.invoices, transformed.invoices.length),
  check("invoice lines preserved", transformed.counts.invoiceLines, transformed.invoiceLines.length),
  check("purchase orders preserved", transformed.counts.purchaseOrders, transformed.purchaseOrders.length),
  check("purchase order lines preserved", transformed.counts.purchaseOrderLines, transformed.purchaseOrderLines.length),
  check("purchase receipts preserved", transformed.counts.purchaseReceipts, transformed.purchaseReceipts.length),
  check("purchase receipt lines preserved", transformed.counts.purchaseReceiptLines, transformed.purchaseReceiptLines.length),
  check("stock batches preserved", transformed.counts.stockBatches, transformed.stockBatches.length),
  check("stock movements preserved", transformed.counts.stockMovements, transformed.stockMovements.length),
  check("stock adjustments preserved", transformed.counts.stockAdjustments, transformed.stockAdjustments.length),
  check("direct deliveries preserved", transformed.counts.directDeliveries, transformed.directDeliveries.length),
  check("units preserved", transformed.counts.units, transformed.units.length),
];

const sourceInvoiceTotal = Object.values(data.sales.invoices).reduce((sum, invoice) => sum + numericValue(invoice.total), 0);
const transformedInvoiceTotal = transformed.invoices.reduce((sum, invoice) => sum + numericValue(invoice.total), 0);
checks.push({ name: "invoice grand total preserved", expected: sourceInvoiceTotal.toFixed(2), actual: transformedInvoiceTotal.toFixed(2), passed: Math.abs(sourceInvoiceTotal - transformedInvoiceTotal) < 0.005 });

const sourceStockQuantity = Object.values(data.inventory.stockLevels).reduce((sum, batch) => sum + numericValue(batch.quantity), 0);
const transformedStockQuantity = transformed.stockBatches.reduce((sum, batch) => sum + numericValue(batch.quantityRemaining), 0);
checks.push({ name: "stock quantity preserved", expected: sourceStockQuantity.toFixed(4), actual: transformedStockQuantity.toFixed(4), passed: Math.abs(sourceStockQuantity - transformedStockQuantity) < 0.00005 });

const report = {
  generatedAt: new Date().toISOString(), source: { path: absolutePath, sha256 }, passed: checks.every((item) => item.passed),
  checks, anomalySummary: Object.fromEntries([...new Set(transformed.anomalies.map((item) => item.code))].sort().map((code) => [code, transformed.anomalies.filter((item) => item.code === code).length])),
};

const outputPath = resolve("data/reports/reconciliation.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, passed: report.passed, checks: report.checks, anomalySummary: report.anomalySummary }, null, 2));
if (!report.passed) process.exitCode = 1;

function check(name: string, expected: number, actual: number): ReconciliationCheck {
  return { name, expected, actual, passed: expected === actual };
}
