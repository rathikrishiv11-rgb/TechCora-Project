import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";

import { PGlite } from "@electric-sql/pglite";

import { loadExport } from "./lib/source.ts";
import { transformExport } from "./lib/transform.ts";

type JsonRecord = Record<string, unknown>;
type QueryResult = { rows: JsonRecord[] };

const outputArg = process.argv.find((value) => value.startsWith("--output="));
const outputPath = resolve(outputArg?.slice("--output=".length) || "data/reports/phase4-benchmark.json");
const { absolutePath, data } = await loadExport();
const raw = await readFile(absolutePath, "utf8");

function visit(value: unknown): number {
  if (value === null || typeof value !== "object") return 1;
  if (Array.isArray(value)) return 1 + value.reduce((sum, child) => sum + visit(child), 0);
  let count = 1;
  for (const child of Object.values(value as JsonRecord)) count += visit(child);
  return count;
}

function legacyRun(payload: string) {
  const started = performance.now();
  const parsed = JSON.parse(payload) as unknown;
  const parsedAt = performance.now();
  const visitedNodes = visit(parsed);
  const finished = performance.now();
  return { parseMs: parsedAt - started, walkAndDeriveMs: finished - parsedAt, longestTaskMs: finished - started, visitedNodes };
}

const oneLegacy = Array.from({ length: 3 }, () => legacyRun(raw));
const expanded = `[${Array.from({ length: 10 }, () => raw).join(",")}]`;
const tenLegacy = legacyRun(expanded);
const transformed = transformExport(data);

const database = new PGlite();
await database.exec(`
  create table customers (id text primary key, name text not null, search_key text not null);
  create table materials (id text primary key, name text not null, model_number text, search_key text not null, is_active boolean not null);
  create table invoices (id text primary key, invoice_number text not null, customer_id text, invoice_date date not null, status text not null, total numeric not null, balance numeric not null);
  create table stock_movements (id text primary key, material_id text, movement_at timestamptz not null, movement_type text not null, direction text not null, quantity numeric not null, unit text, document_id text);
  create table material_stock_summary (material_id text not null, location_id text not null, available_quantity numeric not null, inventory_value numeric not null, version integer not null);
  create table dashboard_daily_summary (day date primary key, invoice_count integer not null, revenue numeric not null);
  create index customers_search_idx on customers(search_key);
  create index materials_search_idx on materials(search_key);
  create index invoices_date_idx on invoices(invoice_date desc, id desc);
  create index invoices_number_idx on invoices(invoice_number);
  create index movements_date_idx on stock_movements(movement_at desc, id desc);
  create index movements_material_date_idx on stock_movements(material_id, movement_at desc, id desc);
  create index summary_material_idx on material_stock_summary(material_id);
`);

const stockSummary = new Map<string, { materialId: string; locationId: string; availableQuantity: number; inventoryValue: number; version: number }>();
for (const batch of transformed.stockBatches) {
  if (!batch.materialId) continue;
  const locationId = batch.locationId ?? "UNSPECIFIED";
  const key = `${batch.materialId}|${locationId}`;
  const current = stockSummary.get(key) ?? { materialId: batch.materialId, locationId, availableQuantity: 0, inventoryValue: 0, version: 1 };
  const quantity = Number(batch.quantityRemaining);
  current.availableQuantity += quantity;
  current.inventoryValue += quantity * Number(batch.unitCost ?? 0);
  stockSummary.set(key, current);
}

await loadJson("customers", transformed.customers.map((row) => ({ id: row.id, name: row.name, search_key: row.searchKey })), "id text, name text, search_key text");
await loadJson("materials", transformed.materials.map((row) => ({ id: row.id, name: row.name, model_number: row.modelNumber, search_key: row.searchKey, is_active: row.isActive })), "id text, name text, model_number text, search_key text, is_active boolean");
await loadJson("invoices", transformed.invoices.map((row) => ({ id: row.id, invoice_number: row.invoiceNumber, customer_id: row.customerId, invoice_date: row.invoiceDate, status: row.status, total: row.total, balance: row.balance })), "id text, invoice_number text, customer_id text, invoice_date date, status text, total numeric, balance numeric");
await database.exec(`insert into dashboard_daily_summary select invoice_date,count(*)::integer,sum(total) from invoices group by invoice_date;`);
await loadJson("stock_movements", transformed.stockMovements.map((row) => ({ id: row.id, material_id: row.materialId, movement_at: row.movementAt, movement_type: row.movementType, direction: row.direction, quantity: row.quantity, unit: row.unit, document_id: row.resolvedRelatedDocumentId })), "id text, material_id text, movement_at timestamptz, movement_type text, direction text, quantity numeric, unit text, document_id text");
await loadJson("material_stock_summary", [...stockSummary.values()].map((row) => ({ material_id: row.materialId, location_id: row.locationId, available_quantity: row.availableQuantity, inventory_value: row.inventoryValue, version: row.version })), "material_id text, location_id text, available_quantity numeric, inventory_value numeric, version integer");

const queryDefinitions = [
  {
    name: "invoicePage",
    sql: `select i.id, i.invoice_number, i.invoice_date, coalesce(c.name, 'Walk-in customer') customer_name, i.status, i.total, i.balance from invoices i left join customers c on c.id=i.customer_id order by i.invoice_date desc, i.id desc limit 25`,
  },
  {
    name: "invoiceSearch",
    sql: `select i.id, i.invoice_number, i.invoice_date, coalesce(c.name, 'Walk-in customer') customer_name, i.status, i.total from invoices i left join customers c on c.id=i.customer_id where i.invoice_number ilike '%INV-43%' or c.name ilike '%INV-43%' order by i.invoice_date desc, i.id desc limit 25`,
  },
  {
    name: "materialPicker",
    sql: `select m.id,m.name,m.model_number,coalesce(sum(s.available_quantity),0) available_quantity,max(s.version) version from materials m left join material_stock_summary s on s.material_id=m.id where m.is_active=true and m.search_key ilike '%adapter%' group by m.id order by m.name limit 20`,
  },
  {
    name: "movementPage",
    sql: `select sm.id,sm.movement_at,m.name material_name,sm.movement_type,sm.direction,sm.quantity,sm.unit,sm.document_id from stock_movements sm left join materials m on m.id=sm.material_id order by sm.movement_at desc,sm.id desc limit 25`,
  },
  {
    name: "dashboardAggregate",
    sql: `select count(*)::integer invoice_count,coalesce(sum(total),0) revenue from invoices`,
  },
] as const;

const oneX = await benchmarkQueries();
await database.exec(`
  insert into customers select 's'||g||':'||id,name,search_key from customers cross join generate_series(2,10) g where id not like 's%';
  insert into materials select 's'||g||':'||id,name,model_number,search_key,is_active from materials cross join generate_series(2,10) g where id not like 's%';
  insert into invoices select 's'||g||':'||id,'S'||g||'-'||invoice_number,case when customer_id is null then null else 's'||g||':'||customer_id end,invoice_date,status,total,balance from invoices cross join generate_series(2,10) g where id not like 's%';
  insert into stock_movements select 's'||g||':'||id,case when material_id is null then null else 's'||g||':'||material_id end,movement_at,movement_type,direction,quantity,unit,document_id from stock_movements cross join generate_series(2,10) g where id not like 's%';
  insert into material_stock_summary select 's'||g||':'||material_id,location_id,available_quantity,inventory_value,version from material_stock_summary cross join generate_series(2,10) g where material_id not like 's%';
  update dashboard_daily_summary set invoice_count=invoice_count*10,revenue=revenue*10;
  analyze;
`);
const tenX = await benchmarkQueries();

const dateRange = await database.query(`select min(invoice_date)::text min_date,max(invoice_date)::text max_date,count(distinct date_trunc('month',invoice_date))::integer active_months from invoices where id not like 's%'`) as QueryResult;
const result = {
  generatedAt: new Date().toISOString(),
  method: { engine: "PGlite/PostgreSQL WASM", warmups: 3, measuredIterations: 20, percentile: "nearest-rank", isolated: true },
  source: { rawBytes: Buffer.byteLength(raw), gzipBytes: gzipSync(raw).byteLength, dateRange: dateRange.rows[0], counts: transformed.counts },
  legacyBrowserModel: {
    oneX: summarizeLegacy(oneLegacy),
    tenX: { rawBytes: Buffer.byteLength(expanded), ...tenLegacy },
  },
  boundedArchitecture: { oneX, tenX },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, ...result }, null, 2));
await database.close();

async function loadJson(table: string, rows: unknown[], recordDefinition: string) {
  const chunkSize = 1000;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const columns = recordDefinition.split(",").map((value) => value.trim().split(" ")[0]).join(",");
    await database.query(`insert into ${table} (${columns}) select * from jsonb_to_recordset($1::jsonb) as x(${recordDefinition})`, [JSON.stringify(chunk)]);
  }
}

async function benchmarkQueries() {
  const results: Record<string, unknown> = {};
  for (const definition of queryDefinitions) {
    for (let index = 0; index < 3; index += 1) await database.query(definition.sql);
    const durations: number[] = [];
    let responseBytes = 0;
    let rowCount = 0;
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now();
      const response = await database.query(definition.sql) as QueryResult;
      durations.push(performance.now() - started);
      responseBytes = Buffer.byteLength(JSON.stringify(response.rows));
      rowCount = response.rows.length;
    }
    durations.sort((a, b) => a - b);
    results[definition.name] = { medianMs: round(percentile(durations, 0.5)), p95Ms: round(percentile(durations, 0.95)), responseBytes, rowCount, roundTrips: 1 };
  }
  return results;
}

function percentile(values: number[], ratio: number) { return values[Math.max(0, Math.ceil(values.length * ratio) - 1)]; }
function round(value: number) { return Math.round(value * 100) / 100; }
function summarizeLegacy(values: ReturnType<typeof legacyRun>[]) {
  const sorted = [...values].sort((a, b) => a.longestTaskMs - b.longestTaskMs);
  return { rawBytes: Buffer.byteLength(raw), parseMs: round(sorted[1].parseMs), walkAndDeriveMs: round(sorted[1].walkAndDeriveMs), longestTaskMs: round(sorted[1].longestTaskMs), visitedNodes: sorted[1].visitedNodes };
}
