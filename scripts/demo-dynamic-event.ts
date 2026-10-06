import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

type Location = { id: string; name: string; isDefault: boolean };
type Material = { id: string; name: string; availableQuantity: string; unit: string | null };
type Batch = { id: string; locationId: string; quantityRemaining: string };

const baseUrl = (process.env.STOCKERP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const locations = await get<{ rows: Location[] }>("/api/locations");
const location = locations.rows.find((row) => row.isDefault) ?? locations.rows[0];
if (!location) throw new Error("No storage location is available.");

const catalog = new Map<string, Material>();
for (const query of ["a", "e", "i", "o", "u", "1", "2", "3", "4", "5"]) {
  const result = await get<{ rows: Material[] }>(`/api/materials?q=${query}&locationId=${encodeURIComponent(location.id)}`);
  result.rows.forEach((material) => catalog.set(material.id, material));
}
const material = [...catalog.values()].find((row) => Number(row.availableQuantity) === 0);
if (!material) throw new Error("No zero-stock material was found in the bounded search sample. Re-run against a fresh masked database or expand the queries.");

const runId = randomUUID();
const seedReceipt = await post("/api/receipts", {
  requestId: `demo-seed-${runId}`,
  receiptDate: new Date().toISOString().slice(0, 10),
  locationId: location.id,
  notes: "Dynamic demo: seed exactly 12 units across two batches",
  lines: [
    { materialId: material.id, quantity: 6, unitCost: 10 },
    { materialId: material.id, quantity: 6, unitCost: 12 },
  ],
});
const seededBatches = await batches(material.id, location.id);
const movementBefore = await movementCount(material.name);
console.log(JSON.stringify({ step: "seeded", material, location, seedReceipt, available: sumBatches(seededBatches), positiveBatches: seededBatches.length }, null, 2));

if (process.argv.includes("--pause")) {
  const prompt = createInterface({ input: stdin, output: stdout });
  await prompt.question(`Open ${baseUrl}/invoices/new, select ${location.name}, add “${material.name}”, and show 12 units across two batches. Press Enter to post both colleague events…`);
  prompt.close();
}

const invoiceRequest = post("/api/invoices", {
  requestId: `demo-sale-${runId}`,
  customerId: null,
  invoiceDate: new Date().toISOString().slice(0, 10),
  locationId: location.id,
  notes: "Dynamic demo: colleague sells 10 of 12 units",
  lines: [{ materialId: material.id, quantity: 10, unitPrice: 15, discount: 0 }],
});
const receiptRequest = post("/api/receipts", {
  requestId: `demo-receipt-${runId}`,
  receiptDate: new Date().toISOString().slice(0, 10),
  locationId: location.id,
  notes: "Dynamic demo: storekeeper posts sixty lines",
  lines: Array.from({ length: 60 }, () => ({ materialId: material.id, quantity: 1, unitCost: 11 })),
});
const [invoice, receipt] = await Promise.all([invoiceRequest, receiptRequest]);
const finalBatches = await batches(material.id, location.id);
const movementAfter = await movementCount(material.name);
const receiptLines = Number(receipt.lineCount);
const report = {
  step: "complete",
  invoice,
  receipt,
  expected: { available: 62, newMovements: 61, receiptLines: 60 },
  actual: { available: sumBatches(finalBatches), positiveBatches: finalBatches.length, newMovements: movementAfter - movementBefore, receiptLines },
};
console.log(JSON.stringify(report, null, 2));
if (report.actual.available !== 62 || report.actual.newMovements !== 61 || report.actual.receiptLines !== 60) process.exitCode = 1;

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function post(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(result)}`);
  return result;
}

async function batches(materialId: string, locationId: string) {
  const result = await get<{ rows: Batch[] }>(`/api/materials/${encodeURIComponent(materialId)}/batches`);
  return result.rows.filter((batch) => batch.locationId === locationId);
}

async function movementCount(materialName: string) {
  const result = await get<{ total: number }>(`/api/movements?q=${encodeURIComponent(materialName)}&pageSize=1`);
  return result.total;
}

function sumBatches(rows: Batch[]) {
  return Math.round(rows.reduce((sum, batch) => sum + Number(batch.quantityRemaining), 0) * 10_000) / 10_000;
}
