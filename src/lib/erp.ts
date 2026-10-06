import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { sql } from "@/db/client";
import {
  IdempotencyConflictError,
  InsufficientStockError,
  type CreateInvoiceInput,
  type CreateReceiptInput,
} from "@/lib/contracts";

type InvoiceSort = "invoiceDate" | "invoiceNumber" | "customer" | "total" | "status";
type SortDirection = "asc" | "desc";

const sortColumns: Record<InvoiceSort, string> = {
  invoiceDate: "i.invoice_date",
  invoiceNumber: "i.invoice_number",
  customer: "customer_name",
  total: "i.total",
  status: "i.status",
};

export async function listInvoices(input: {
  page: number;
  pageSize: number;
  query: string;
  sort: InvoiceSort;
  direction: SortDirection;
}) {
  const offset = (input.page - 1) * input.pageSize;
  const pattern = `%${input.query}%`;
  const orderColumn = sql.unsafe(sortColumns[input.sort]);
  const orderDirection = sql.unsafe(input.direction === "asc" ? "asc" : "desc");
  const filter = input.query
    ? sql`where i.invoice_number ilike ${pattern} or coalesce(c.name, '') ilike ${pattern} or i.status ilike ${pattern}`
    : sql``;

  const [rows, countRows] = await Promise.all([
    sql`
      select i.id, i.invoice_number as "invoiceNumber", i.invoice_date as "invoiceDate",
             coalesce(c.name, i.customer_snapshot->>'name', 'Walk-in customer') as "customerName",
             i.status, i.total, i.balance
      from invoices i
      left join customers c on c.id = i.customer_id
      ${filter}
      order by ${orderColumn} ${orderDirection}, i.id desc
      limit ${input.pageSize} offset ${offset}
    `,
    sql`
      select count(*)::integer as count
      from invoices i left join customers c on c.id = i.customer_id
      ${filter}
    `,
  ]);

  return { rows, total: Number(countRows[0]?.count ?? 0) };
}

export async function searchMaterials(query: string, locationId?: string, limit = 20) {
  const normalized = query.trim().toLowerCase();
  const pattern = `%${normalized}%`;
  return sql`
    select m.id, m.name, m.model_number as "modelNumber", m.default_unit as unit,
           coalesce(sum(s.available_quantity), 0) as "availableQuantity",
           coalesce(sum(s.inventory_value), 0) as "inventoryValue",
           max(s.version) as version
    from materials m
    left join material_stock_summary s on s.material_id = m.id
      and (${locationId ?? ""} = '' or s.location_id = ${locationId ?? ""})
    where m.is_active = true
      and (${normalized === ""} or m.search_key ilike ${pattern} or coalesce(m.model_number, '') ilike ${pattern})
    group by m.id
    order by (case when m.search_key like ${`${normalized}%`} then 0 else 1 end), m.name
    limit ${limit}
  `;
}

export async function listMaterialBatches(materialId: string) {
  return sql`
    select b.id, b.location_id as "locationId", l.name as "locationName",
           b.quantity_remaining as "quantityRemaining", b.unit_cost as "unitCost",
           b.unit, b.received_at as "receivedAt", b.version
    from stock_batches b
    left join storage_locations l on l.id = b.location_id
    where b.material_id = ${materialId} and b.quantity_remaining > 0
    order by b.received_at nulls last, b.id
    limit 100
  `;
}

export async function searchCustomers(query: string, limit = 20) {
  const normalized = query.trim().toLowerCase();
  return sql`
    select id, name, email, phone
    from customers
    where ${normalized === ""} or search_key ilike ${`%${normalized}%`}
    order by name
    limit ${limit}
  `;
}

export async function listLocations() {
  return sql`select id, name, is_default as "isDefault" from storage_locations order by is_default desc, name`;
}

export async function getDashboard() {
  const [totals, daily, lowStock, recent] = await Promise.all([
    sql`
      select (select count(*) from invoices)::integer as "invoiceCount",
             (select coalesce(sum(total), 0) from invoices) as revenue,
             (select count(*) from materials where is_active)::integer as "materialCount",
             (select coalesce(sum(available_quantity), 0) from material_stock_summary) as "stockUnits"
    `,
    sql`
      select day, invoice_count as "invoiceCount", revenue, gross_profit as "grossProfit"
      from dashboard_daily_summary order by day desc limit 14
    `,
    sql`
      select m.id, m.name, m.reorder_point as "reorderPoint",
             coalesce(sum(s.available_quantity), 0) as available
      from materials m left join material_stock_summary s on s.material_id = m.id
      where m.is_active = true
      group by m.id
      having coalesce(sum(s.available_quantity), 0) <= m.reorder_point
      order by available, m.name limit 8
    `,
    sql`
      select i.id, i.invoice_number as "invoiceNumber", i.invoice_date as "invoiceDate",
             coalesce(c.name, 'Walk-in customer') as "customerName", i.total
      from invoices i left join customers c on c.id = i.customer_id
      order by i.invoice_date desc, i.id desc limit 6
    `,
  ]);
  return { totals: totals[0], daily, lowStock, recent };
}

export async function listMovements(input: { query: string; page: number; pageSize: number }) {
  const offset = (input.page - 1) * input.pageSize;
  const pattern = `%${input.query.toLowerCase()}%`;
  const filter = input.query
    ? sql`where m.search_key ilike ${pattern} or sm.movement_type ilike ${pattern} or coalesce(sm.resolved_related_document_id, '') ilike ${pattern}`
    : sql``;
  const [rows, count] = await Promise.all([
    sql`
      select sm.id, sm.movement_at as "movementAt", m.name as "materialName",
             sm.movement_type as "movementType", sm.direction, sm.quantity, sm.unit,
             sm.resolved_related_document_id as "documentId", l.name as "locationName"
      from stock_movements sm
      left join materials m on m.id = sm.material_id
      left join storage_locations l on l.id = sm.location_id
      ${filter}
      order by sm.movement_at desc, sm.id desc limit ${input.pageSize} offset ${offset}
    `,
    sql`
      select count(*)::integer as count from stock_movements sm
      left join materials m on m.id = sm.material_id ${filter}
    `,
  ]);
  return { rows, total: Number(count[0]?.count ?? 0) };
}

function fingerprint(input: CreateInvoiceInput) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function createInvoice(input: CreateInvoiceInput) {
  const requestFingerprint = fingerprint(input);

  return sql.begin(async (tx) => {
    const previous = await tx`
      select id, invoice_number as "invoiceNumber", total, source_data->>'requestFingerprint' as fingerprint
      from invoices where id = ${input.requestId}
    `;
    if (previous[0]) {
      if (previous[0].fingerprint !== requestFingerprint) throw new IdempotencyConflictError();
      return { ...previous[0], replayed: true };
    }

    const combined = new Map<string, { quantity: number; lines: number[] }>();
    input.lines.forEach((line, index) => {
      const current = combined.get(line.materialId) ?? { quantity: 0, lines: [] };
      current.quantity += line.quantity;
      current.lines.push(index);
      combined.set(line.materialId, current);
    });

    const materialIds = [...combined.keys()].sort();
    for (const materialId of materialIds) {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${materialId}|${input.locationId}`}, 0))`;
    }

    const materialRows = await tx`
      select id, name, default_unit as unit from materials where id in ${tx(materialIds)}
    `;
    const materialMap = new Map(materialRows.map((row) => [String(row.id), row]));
    if (materialRows.length !== materialIds.length) throw new Error("One or more materials no longer exist.");

    const allocations = new Map<number, Array<{ batchId: string; quantity: number; unitCost: number }>>();
    const costByMaterial = new Map<string, number>();
    let costOfGoodsSold = 0;

    for (const materialId of materialIds) {
      const request = combined.get(materialId)!;
      const batches = await tx`
        select id, quantity_remaining as quantity, coalesce(unit_cost, 0) as "unitCost"
        from stock_batches
        where material_id = ${materialId} and location_id = ${input.locationId} and quantity_remaining > 0
        order by received_at nulls last, id
        for update
      `;
      const available = batches.reduce((sum, batch) => sum + Number(batch.quantity), 0);
      if (available + 0.000001 < request.quantity) {
        throw new InsufficientStockError(materialId, request.quantity, available);
      }

      let batchIndex = 0;
      for (const lineIndex of request.lines) {
        let remaining = input.lines[lineIndex].quantity;
        const lineAllocations: Array<{ batchId: string; quantity: number; unitCost: number }> = [];
        while (remaining > 0.000001) {
          const batch = batches[batchIndex];
          if (!batch) throw new InsufficientStockError(materialId, request.quantity, available);
          const inBatch = Number(batch.quantity);
          const used = Math.min(remaining, inBatch);
          const unitCost = Number(batch.unitCost);
          lineAllocations.push({ batchId: String(batch.id), quantity: used, unitCost });
          batch.quantity = String(inBatch - used);
          remaining -= used;
          costOfGoodsSold += used * unitCost;
          costByMaterial.set(materialId, (costByMaterial.get(materialId) ?? 0) + used * unitCost);
          if (Number(batch.quantity) <= 0.000001) batchIndex += 1;
        }
        allocations.set(lineIndex, lineAllocations);
      }
    }

    const subtotal = money(input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
    const discountTotal = money(input.lines.reduce((sum, line) => sum + line.discount, 0));
    const total = money(subtotal - discountTotal);
    const invoiceNumber = `INV-${input.invoiceDate.replaceAll("-", "")}-${input.requestId.slice(0, 8).toUpperCase()}`;
    const sourceData = JSON.stringify({ origin: "stockerp-phase-3", requestFingerprint });

    await tx`
      insert into invoices
        (id, invoice_number, customer_id, invoice_date, due_date, status, type, location_id,
         subtotal, discount_total, tax_total, total, paid_amount, balance, notes, created_at, updated_at, source_data)
      values
        (${input.requestId}, ${invoiceNumber}, ${input.customerId ?? null}, ${input.invoiceDate}, ${input.dueDate ?? null},
         'issued', 'sale', ${input.locationId}, ${subtotal}, ${discountTotal}, 0, ${total}, 0, ${total},
         ${input.notes ?? null}, now(), now(), ${sourceData}::jsonb)
    `;

    for (const [index, line] of input.lines.entries()) {
      const lineId = `${input.requestId}-line-${index + 1}`;
      const material = materialMap.get(line.materialId)!;
      const lineTotal = money(line.quantity * line.unitPrice - line.discount);
      await tx`
        insert into invoice_lines
          (id, invoice_id, line_number, material_id, source_material_id, item_type, description,
           unit, location_id, quantity, unit_price, discount, line_total, source_data)
        values
          (${lineId}, ${input.requestId}, ${index + 1}, ${line.materialId}, ${line.materialId}, 'material',
           ${String(material.name)}, ${material.unit ? String(material.unit) : null}, ${input.locationId},
           ${line.quantity}, ${line.unitPrice}, ${line.discount}, ${lineTotal}, ${sourceData}::jsonb)
      `;

      for (const allocation of allocations.get(index) ?? []) {
        await tx`
          update stock_batches
          set quantity_remaining = quantity_remaining - ${allocation.quantity}, version = version + 1, updated_at = now()
          where id = ${allocation.batchId}
        `;
        await tx`
          insert into invoice_batch_allocations (invoice_line_id, batch_id, quantity, unit_cost)
          values (${lineId}, ${allocation.batchId}, ${allocation.quantity}, ${allocation.unitCost})
        `;
        await tx`
          insert into stock_movements
            (id, material_id, source_material_id, batch_id, location_id, movement_type, direction,
             quantity, unit, cost_per_unit, total_cost, related_document_type, raw_related_document_id,
             resolved_related_document_id, relationship_confidence, notes, movement_at, created_at, source_data)
          values
            (${randomUUID()}, ${line.materialId}, ${line.materialId}, ${allocation.batchId}, ${input.locationId},
             'sale', 'out', ${allocation.quantity}, ${material.unit ? String(material.unit) : null},
             ${allocation.unitCost}, ${money(allocation.quantity * allocation.unitCost)}, 'invoice', ${input.requestId},
             ${input.requestId}, 'exact', 'Created by StockERP invoice workflow', now(), now(), ${sourceData}::jsonb)
        `;
      }
    }

    for (const [materialId, request] of combined) {
      await tx`
        update material_stock_summary
        set available_quantity = available_quantity - ${request.quantity},
            inventory_value = greatest(0, inventory_value - ${money(costByMaterial.get(materialId) ?? 0)}),
            version = version + 1, updated_at = now()
        where material_id = ${materialId} and location_id = ${input.locationId}
      `;
    }

    const cogs = money(costOfGoodsSold);
    await tx`
      insert into dashboard_daily_summary (day, invoice_count, revenue, cost_of_goods_sold, gross_profit)
      values (${input.invoiceDate}, 1, ${total}, ${cogs}, ${money(total - cogs)})
      on conflict (day) do update set
        invoice_count = dashboard_daily_summary.invoice_count + 1,
        revenue = dashboard_daily_summary.revenue + excluded.revenue,
        cost_of_goods_sold = dashboard_daily_summary.cost_of_goods_sold + excluded.cost_of_goods_sold,
        gross_profit = dashboard_daily_summary.gross_profit + excluded.gross_profit,
        updated_at = now()
    `;

    return { id: input.requestId, invoiceNumber, total: total.toFixed(2), replayed: false };
  });
}

export async function createReceipt(input: CreateReceiptInput) {
  const requestFingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return sql.begin(async (tx) => {
    const previous = await tx`
      select id, receipt_number as "receiptNumber", source_data->>'requestFingerprint' as fingerprint
      from purchase_receipts where id = ${input.requestId}
    `;
    if (previous[0]) {
      if (previous[0].fingerprint !== requestFingerprint) throw new IdempotencyConflictError();
      return { ...previous[0], lineCount: input.lines.length, replayed: true };
    }

    const materialIds = [...new Set(input.lines.map((line) => line.materialId))].sort();
    for (const materialId of materialIds) {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${materialId}|${input.locationId}`}, 0))`;
    }
    const materialRows = await tx`select id, name, default_unit as unit from materials where id in ${tx(materialIds)}`;
    if (materialRows.length !== materialIds.length) throw new Error("One or more materials no longer exist.");
    const materialMap = new Map(materialRows.map((row) => [String(row.id), row]));
    const receiptNumber = `GRN-${input.receiptDate.replaceAll("-", "")}-${input.requestId.slice(0, 8).toUpperCase()}`;
    const sourceData = JSON.stringify({ origin: "stockerp-phase-3", requestFingerprint });

    await tx`
      insert into purchase_receipts
        (id, receipt_number, vendor_id, receipt_date, status, landed_cost, notes, created_at, updated_at, source_data)
      values (${input.requestId}, ${receiptNumber}, ${input.vendorId ?? null}, ${input.receiptDate}, 'received', 0,
              ${input.notes ?? null}, now(), now(), ${sourceData}::jsonb)
    `;

    for (const [index, line] of input.lines.entries()) {
      const material = materialMap.get(line.materialId)!;
      const lineId = `${input.requestId}-line-${index + 1}`;
      const batchId = `${input.requestId}-batch-${index + 1}`;
      await tx`
        insert into purchase_receipt_lines
          (id, purchase_receipt_id, line_number, material_id, source_material_id, location_id,
           description, unit, received_quantity, source_data)
        values (${lineId}, ${input.requestId}, ${index + 1}, ${line.materialId}, ${line.materialId}, ${input.locationId},
                ${String(material.name)}, ${material.unit ? String(material.unit) : null}, ${line.quantity}, ${sourceData}::jsonb)
      `;
      await tx`
        insert into stock_batches
          (id, material_id, source_material_id, location_id, purchase_receipt_line_id, quantity_remaining,
           unit_cost, unit, status, received_at, updated_at, version, source_data)
        values (${batchId}, ${line.materialId}, ${line.materialId}, ${input.locationId}, ${lineId}, ${line.quantity},
                ${line.unitCost}, ${material.unit ? String(material.unit) : null}, 'available', now(), now(), 1, ${sourceData}::jsonb)
      `;
      await tx`
        insert into stock_movements
          (id, material_id, source_material_id, batch_id, location_id, movement_type, direction, quantity, unit,
           cost_per_unit, total_cost, related_document_type, raw_related_document_id, resolved_related_document_id,
           relationship_confidence, notes, movement_at, created_at, source_data)
        values (${randomUUID()}, ${line.materialId}, ${line.materialId}, ${batchId}, ${input.locationId}, 'purchase_receipt',
                'in', ${line.quantity}, ${material.unit ? String(material.unit) : null}, ${line.unitCost},
                ${money(line.quantity * line.unitCost)}, 'purchase_receipt', ${input.requestId}, ${input.requestId},
                'exact', 'Created by StockERP goods receipt workflow', now(), now(), ${sourceData}::jsonb)
      `;
      await tx`
        insert into material_stock_summary (material_id, location_id, available_quantity, inventory_value, version)
        values (${line.materialId}, ${input.locationId}, ${line.quantity}, ${money(line.quantity * line.unitCost)}, 1)
        on conflict (material_id, location_id) do update set
          available_quantity = material_stock_summary.available_quantity + excluded.available_quantity,
          inventory_value = material_stock_summary.inventory_value + excluded.inventory_value,
          version = material_stock_summary.version + 1, updated_at = now()
      `;
    }
    return { id: input.requestId, receiptNumber, lineCount: input.lines.length, replayed: false };
  });
}

export type { InvoiceSort, SortDirection };
