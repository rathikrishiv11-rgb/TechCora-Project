import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type JsonRecord = Record<string, unknown>;
export type RecordMap = Record<string, JsonRecord>;

export interface SourceExport {
  inventory: {
    materials: RecordMap;
    stockAdjustments: RecordMap;
    stockLevels: RecordMap;
    storageLocations: RecordMap;
    storage_locations: RecordMap;
    transactions: RecordMap;
  };
  purchasing: {
    purchaseOrders: RecordMap;
    purchaseReceipts: RecordMap;
    vendors: RecordMap;
  };
  sales: {
    customers: RecordMap;
    "direct-deliveries": RecordMap;
    invoices: RecordMap;
  };
  units: RecordMap;
}

export interface LoadedExport {
  absolutePath: string;
  data: SourceExport;
  sha256: string;
}

export interface Anomaly {
  severity: "info" | "warning" | "error";
  code: string;
  sourcePath: string;
  sourceId?: string;
  message: string;
  details?: Record<string, unknown>;
}

export function sourcePathFromArgs(): string {
  const cliPath = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  const configuredPath = cliPath ?? process.env.ERP_EXPORT_PATH;

  if (!configuredPath) {
    throw new Error("Provide a JSON export path as the first argument or set ERP_EXPORT_PATH.");
  }

  if (configuredPath.toLowerCase().endsWith(".zip")) {
    throw new Error("Extract cora-erp-masked.zip first and provide the contained JSON file.");
  }

  return configuredPath;
}

export async function loadExport(inputPath = sourcePathFromArgs()): Promise<LoadedExport> {
  const absolutePath = resolve(inputPath);
  const raw = await readFile(absolutePath);
  const parsed = JSON.parse(raw.toString("utf8")) as SourceExport;
  assertShape(parsed);

  return {
    absolutePath,
    data: parsed,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function assertShape(value: SourceExport): void {
  const requiredCollections: Array<[string, unknown]> = [
    ["inventory/materials", value?.inventory?.materials],
    ["inventory/stockLevels", value?.inventory?.stockLevels],
    ["inventory/transactions", value?.inventory?.transactions],
    ["purchasing/purchaseOrders", value?.purchasing?.purchaseOrders],
    ["purchasing/purchaseReceipts", value?.purchasing?.purchaseReceipts],
    ["purchasing/vendors", value?.purchasing?.vendors],
    ["sales/customers", value?.sales?.customers],
    ["sales/invoices", value?.sales?.invoices],
    ["units", value?.units],
  ];

  for (const [path, collection] of requiredCollections) {
    if (!collection || typeof collection !== "object" || Array.isArray(collection)) {
      throw new Error(`The export is missing the expected record map at ${path}.`);
    }
  }
}

export function entries(collection: RecordMap): Array<[string, JsonRecord]> {
  return Object.entries(collection);
}

export function childRecords(record: JsonRecord, field: string): JsonRecord[] {
  const value = record[field];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function textValue(value: unknown, fallback = ""): string {
  return value === null || value === undefined ? fallback : String(value);
}

export function nullableText(value: unknown): string | null {
  const valueAsText = textValue(value).trim();
  return valueAsText.length > 0 ? valueAsText : null;
}

export function numericValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function numericText(value: unknown, fallback = 0): string {
  return numericValue(value, fallback).toFixed(4).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

export function moneyText(value: unknown, fallback = 0): string {
  return numericValue(value, fallback).toFixed(2);
}

export function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

export function dateValue(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(typeof value === "number" ? value : String(value));
  if (Number.isNaN(date.valueOf()) || date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2100) return null;
  return date;
}

export function dateOnly(value: unknown): Date {
  return dateValue(value) ?? new Date(0);
}

export function searchKey(...values: unknown[]): string {
  return values.map((value) => textValue(value).toLowerCase().trim()).filter(Boolean).join(" ");
}

export function stableLineId(parentId: string, line: JsonRecord, index: number): string {
  const embeddedId = nullableText(line.id);
  return embeddedId ? `${parentId}:${embeddedId}` : `${parentId}:line:${index + 1}`;
}

export function movementDirectionFor(type: unknown, movementQuantity: unknown): "in" | "out" | "neutral" {
  const normalizedType = textValue(type).toLowerCase();
  if (normalizedType === "purchase" || normalizedType === "receipt" || normalizedType === "increase") return "in";
  if (normalizedType === "sales" || normalizedType === "sale" || normalizedType === "decrease") return "out";
  const value = numericValue(movementQuantity);
  return value > 0 ? "in" : value < 0 ? "out" : "neutral";
}

export function collectionCounts(data: SourceExport): Record<string, number> {
  const invoiceLines = entries(data.sales.invoices).reduce((sum, [, record]) => sum + childRecords(record, "items").length, 0);
  const purchaseOrderLines = entries(data.purchasing.purchaseOrders).reduce((sum, [, record]) => sum + childRecords(record, "items").length, 0);
  const purchaseReceiptLines = entries(data.purchasing.purchaseReceipts).reduce((sum, [, record]) => sum + childRecords(record, "items").length, 0);

  return {
    materials: entries(data.inventory.materials).length,
    stockAdjustments: entries(data.inventory.stockAdjustments).length,
    stockBatches: entries(data.inventory.stockLevels).length,
    stockMovements: entries(data.inventory.transactions).length,
    storageLocations: entries(data.inventory.storageLocations).length + entries(data.inventory.storage_locations).length,
    purchaseOrders: entries(data.purchasing.purchaseOrders).length,
    purchaseOrderLines,
    purchaseReceipts: entries(data.purchasing.purchaseReceipts).length,
    purchaseReceiptLines,
    vendors: entries(data.purchasing.vendors).length,
    customers: entries(data.sales.customers).length,
    invoices: entries(data.sales.invoices).length,
    invoiceLines,
    directDeliveries: entries(data.sales["direct-deliveries"]).length,
    units: entries(data.units).length,
  };
}
