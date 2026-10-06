import {
  boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable,
  primaryKey, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 18, scale: 2 });
const quantity = (name: string) => numeric(name, { precision: 18, scale: 4 });
const auditColumns = {
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  sourceData: jsonb("source_data").$type<Record<string, unknown>>().notNull(),
};

export const anomalySeverity = pgEnum("anomaly_severity", ["info", "warning", "error"]);
export const importStatus = pgEnum("import_status", ["running", "completed", "failed"]);
export const movementDirection = pgEnum("movement_direction", ["in", "out", "neutral"]);

export const importRuns = pgTable("import_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceFile: text("source_file").notNull(),
  sourceSha256: text("source_sha256").notNull(),
  status: importStatus("status").notNull().default("running"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  sourceCounts: jsonb("source_counts").$type<Record<string, number>>().notNull(),
  importedCounts: jsonb("imported_counts").$type<Record<string, number>>(),
  errorMessage: text("error_message"),
});

export const importAnomalies = pgTable("import_anomalies", {
  id: uuid("id").defaultRandom().primaryKey(),
  importRunId: uuid("import_run_id").references(() => importRuns.id, { onDelete: "cascade" }),
  severity: anomalySeverity("severity").notNull(),
  code: text("code").notNull(),
  sourcePath: text("source_path").notNull(),
  sourceId: text("source_id"),
  message: text("message").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("import_anomalies_run_idx").on(table.importRunId), index("import_anomalies_code_idx").on(table.code)]);

export const units = pgTable("units", {
  id: text("id").primaryKey(), code: text("code"), name: text("name").notNull(), symbol: text("symbol").notNull(),
  type: text("type"), description: text("description"), isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }), ...auditColumns,
}, (table) => [index("units_code_idx").on(table.code), index("units_name_idx").on(table.name)]);

export const storageLocations = pgTable("storage_locations", {
  id: text("id").primaryKey(), name: text("name").notNull(), locationType: text("location_type"), capacityUnit: text("capacity_unit"),
  isDefault: boolean("is_default").notNull().default(false), sourcePath: text("source_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }), ...auditColumns,
}, (table) => [index("storage_locations_name_idx").on(table.name)]);

export const materials = pgTable("materials", {
  id: text("id").primaryKey(), name: text("name").notNull(), modelNumber: text("model_number"), description: text("description"),
  defaultUnit: text("default_unit"), gradeOrQuality: text("grade_or_quality"), reorderPoint: quantity("reorder_point").notNull().default("0"),
  storageRequirements: text("storage_requirements"), notes: text("notes"), isActive: boolean("is_active").notNull().default(true),
  searchKey: text("search_key").notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }), ...auditColumns,
}, (table) => [index("materials_search_key_idx").on(table.searchKey), index("materials_model_number_idx").on(table.modelNumber), index("materials_active_idx").on(table.isActive)]);

export const customers = pgTable("customers", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email"), phone: text("phone"),
  address: jsonb("address").$type<Record<string, unknown>>(), searchKey: text("search_key").notNull(), ...auditColumns,
}, (table) => [index("customers_search_key_idx").on(table.searchKey)]);

export const vendors = pgTable("vendors", {
  id: text("id").primaryKey(), embeddedId: text("embedded_id"), name: text("name").notNull(), contactPerson: text("contact_person"),
  email: text("email"), phone: text("phone"), address: text("address"), paymentTerms: text("payment_terms"), taxId: text("tax_id"),
  notes: text("notes"), isActive: boolean("is_active").notNull().default(true), searchKey: text("search_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }), ...auditColumns,
}, (table) => [index("vendors_search_key_idx").on(table.searchKey)]);

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(), invoiceNumber: text("invoice_number").notNull(), customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  customerSnapshot: jsonb("customer_snapshot").$type<Record<string, unknown>>(), invoiceDate: date("invoice_date", { mode: "date" }).notNull(),
  dueDate: date("due_date", { mode: "date" }), status: text("status").notNull(), type: text("type"), locationId: text("location_id"),
  subtotal: money("subtotal").notNull().default("0"), discountTotal: money("discount_total").notNull().default("0"),
  taxTotal: money("tax_total").notNull().default("0"), total: money("total").notNull().default("0"), paidAmount: money("paid_amount").notNull().default("0"),
  balance: money("balance").notNull().default("0"), projectId: text("project_id"), projectName: text("project_name"), serviceType: text("service_type"),
  terms: text("terms"), notes: text("notes"), createdAt: timestamp("created_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }), ...auditColumns,
}, (table) => [uniqueIndex("invoices_number_uq").on(table.invoiceNumber), index("invoices_date_id_idx").on(table.invoiceDate, table.id), index("invoices_customer_date_idx").on(table.customerId, table.invoiceDate), index("invoices_status_date_idx").on(table.status, table.invoiceDate)]);

export const invoiceLines = pgTable("invoice_lines", {
  id: text("id").primaryKey(), invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }), lineNumber: integer("line_number").notNull(),
  materialId: text("material_id").references(() => materials.id, { onDelete: "set null" }), sourceMaterialId: text("source_material_id"), itemType: text("item_type"),
  description: text("description"), unit: text("unit"), locationId: text("location_id"), quantity: quantity("quantity").notNull(), unitPrice: money("unit_price").notNull(),
  discount: money("discount").notNull().default("0"), lineTotal: money("line_total").notNull(), ...auditColumns,
}, (table) => [uniqueIndex("invoice_lines_invoice_number_uq").on(table.invoiceId, table.lineNumber), index("invoice_lines_material_idx").on(table.materialId)]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: text("id").primaryKey(), orderNumber: text("order_number").notNull(), vendorId: text("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  vendorName: text("vendor_name"), orderDate: date("order_date", { mode: "date" }).notNull(), expectedDeliveryDate: date("expected_delivery_date", { mode: "date" }),
  status: text("status").notNull(), currency: text("currency"), exchangeRate: numeric("exchange_rate", { precision: 18, scale: 6 }), subtotal: money("subtotal").notNull().default("0"),
  discount: money("discount").notNull().default("0"), courierCharges: money("courier_charges").notNull().default("0"), total: money("total").notNull().default("0"),
  notes: text("notes"), createdBy: text("created_by"), updatedBy: text("updated_by"), createdAt: timestamp("created_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }), ...auditColumns,
}, (table) => [index("purchase_orders_number_idx").on(table.orderNumber), index("purchase_orders_date_idx").on(table.orderDate), index("purchase_orders_vendor_date_idx").on(table.vendorId, table.orderDate)]);

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: text("id").primaryKey(), purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }), lineNumber: integer("line_number").notNull(),
  materialId: text("material_id").references(() => materials.id, { onDelete: "set null" }), sourceMaterialId: text("source_material_id"), description: text("description"), unit: text("unit"),
  quantity: quantity("quantity").notNull(), receivedQuantity: quantity("received_quantity").notNull().default("0"), unitPrice: money("unit_price").notNull(),
  originalUnitPrice: money("original_unit_price"), originalCurrency: text("original_currency"), discount: money("discount").notNull().default("0"), lineTotal: money("line_total").notNull(), ...auditColumns,
}, (table) => [uniqueIndex("purchase_order_lines_order_number_uq").on(table.purchaseOrderId, table.lineNumber), index("purchase_order_lines_material_idx").on(table.materialId)]);

export const purchaseReceipts = pgTable("purchase_receipts", {
  id: text("id").primaryKey(), receiptNumber: text("receipt_number").notNull(), purchaseOrderId: text("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
  vendorId: text("vendor_id").references(() => vendors.id, { onDelete: "set null" }), receiptDate: date("receipt_date", { mode: "date" }).notNull(), status: text("status").notNull(),
  landedCost: money("landed_cost").notNull().default("0"), notes: text("notes"), createdBy: text("created_by"), updatedBy: text("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }), ...auditColumns,
}, (table) => [index("purchase_receipts_number_idx").on(table.receiptNumber), index("purchase_receipts_date_idx").on(table.receiptDate), index("purchase_receipts_order_idx").on(table.purchaseOrderId)]);

export const purchaseReceiptLines = pgTable("purchase_receipt_lines", {
  id: text("id").primaryKey(), purchaseReceiptId: text("purchase_receipt_id").notNull().references(() => purchaseReceipts.id, { onDelete: "cascade" }),
  purchaseOrderLineId: text("purchase_order_line_id").references(() => purchaseOrderLines.id, { onDelete: "set null" }), lineNumber: integer("line_number").notNull(),
  materialId: text("material_id").references(() => materials.id, { onDelete: "set null" }), sourceMaterialId: text("source_material_id"), locationId: text("location_id"),
  description: text("description"), unit: text("unit"), receivedQuantity: quantity("received_quantity").notNull(), notes: text("notes"), ...auditColumns,
}, (table) => [uniqueIndex("purchase_receipt_lines_receipt_number_uq").on(table.purchaseReceiptId, table.lineNumber), index("purchase_receipt_lines_material_idx").on(table.materialId)]);

export const stockBatches = pgTable("stock_batches", {
  id: text("id").primaryKey(), materialId: text("material_id").references(() => materials.id, { onDelete: "set null" }), sourceMaterialId: text("source_material_id").notNull(),
  locationId: text("location_id"), purchaseReceiptLineId: text("purchase_receipt_line_id").references(() => purchaseReceiptLines.id, { onDelete: "set null" }),
  quantityRemaining: quantity("quantity_remaining").notNull(), unitCost: money("unit_cost"), unit: text("unit"), status: text("status"),
  receivedAt: timestamp("received_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }), version: integer("version").notNull().default(1), ...auditColumns,
}, (table) => [index("stock_batches_picker_idx").on(table.materialId, table.locationId, table.quantityRemaining, table.receivedAt), index("stock_batches_source_material_idx").on(table.sourceMaterialId)]);

export const stockMovements = pgTable("stock_movements", {
  id: text("id").primaryKey(), materialId: text("material_id").references(() => materials.id, { onDelete: "set null" }), sourceMaterialId: text("source_material_id").notNull(),
  batchId: text("batch_id").references(() => stockBatches.id, { onDelete: "set null" }), locationId: text("location_id"), movementType: text("movement_type").notNull(),
  direction: movementDirection("direction").notNull(), quantity: quantity("quantity").notNull(), unit: text("unit"), costPerUnit: money("cost_per_unit"), totalCost: money("total_cost"),
  relatedDocumentType: text("related_document_type"), rawRelatedDocumentId: text("raw_related_document_id"), resolvedRelatedDocumentId: text("resolved_related_document_id"),
  relationshipConfidence: text("relationship_confidence"), notes: text("notes"), performedBy: text("performed_by"), movementAt: timestamp("movement_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }), ...auditColumns,
}, (table) => [index("stock_movements_material_date_idx").on(table.materialId, table.movementAt, table.id), index("stock_movements_document_idx").on(table.resolvedRelatedDocumentId), index("stock_movements_type_date_idx").on(table.movementType, table.movementAt)]);

export const stockAdjustments = pgTable("stock_adjustments", {
  id: text("id").primaryKey(), materialId: text("material_id").references(() => materials.id, { onDelete: "set null" }), sourceMaterialId: text("source_material_id").notNull(),
  locationId: text("location_id"), transactionId: text("transaction_id").references(() => stockMovements.id, { onDelete: "set null" }), adjustmentType: text("adjustment_type").notNull(),
  quantity: quantity("quantity").notNull(), unit: text("unit"), reason: text("reason"), status: text("status"), notes: text("notes"), createdBy: text("created_by"),
  approvedBy: text("approved_by"), createdAt: timestamp("created_at", { withTimezone: true }), approvedAt: timestamp("approved_at", { withTimezone: true }), ...auditColumns,
}, (table) => [index("stock_adjustments_material_idx").on(table.materialId)]);

export const directDeliveries = pgTable("direct_deliveries", {
  id: text("id").primaryKey(), deliveryNumber: text("delivery_number").notNull(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }), customerName: text("customer_name"),
  locationId: text("location_id"), deliveryDate: timestamp("delivery_date", { withTimezone: true }), status: text("status"),
  paymentStatus: text("payment_status"), paymentMethod: text("payment_method"), subtotal: money("subtotal").notNull().default("0"),
  discount: money("discount").notNull().default("0"), total: money("total").notNull().default("0"), stockUpdated: boolean("stock_updated").notNull().default(false),
  notes: text("notes"), createdAt: timestamp("created_at", { withTimezone: true }), updatedAt: timestamp("updated_at", { withTimezone: true }), ...auditColumns,
}, (table) => [uniqueIndex("direct_deliveries_number_uq").on(table.deliveryNumber), index("direct_deliveries_date_idx").on(table.deliveryDate)]);

export const directDeliveryLines = pgTable("direct_delivery_lines", {
  id: text("id").primaryKey(), directDeliveryId: text("direct_delivery_id").notNull().references(() => directDeliveries.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number").notNull(), materialId: text("material_id").references(() => materials.id, { onDelete: "set null" }),
  sourceMaterialId: text("source_material_id"), materialName: text("material_name"), modelNumber: text("model_number"), locationId: text("location_id"),
  unit: text("unit"), quantity: quantity("quantity").notNull(), unitPrice: money("unit_price").notNull(), lineTotal: money("line_total").notNull(), ...auditColumns,
}, (table) => [uniqueIndex("direct_delivery_lines_delivery_number_uq").on(table.directDeliveryId, table.lineNumber)]);

export const invoiceBatchAllocations = pgTable("invoice_batch_allocations", {
  invoiceLineId: text("invoice_line_id").notNull().references(() => invoiceLines.id, { onDelete: "cascade" }),
  batchId: text("batch_id").notNull().references(() => stockBatches.id, { onDelete: "restrict" }), quantity: quantity("quantity").notNull(),
  unitCost: money("unit_cost").notNull(), allocatedAt: timestamp("allocated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.invoiceLineId, table.batchId] }), index("invoice_batch_allocations_batch_idx").on(table.batchId)]);

export const materialStockSummary = pgTable("material_stock_summary", {
  materialId: text("material_id").notNull().references(() => materials.id, { onDelete: "cascade" }), locationId: text("location_id").notNull(),
  availableQuantity: quantity("available_quantity").notNull().default("0"), inventoryValue: money("inventory_value").notNull().default("0"),
  version: integer("version").notNull().default(1), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.materialId, table.locationId] }), index("material_stock_summary_available_idx").on(table.availableQuantity)]);

export const dashboardDailySummary = pgTable("dashboard_daily_summary", {
  day: date("day", { mode: "date" }).primaryKey(), invoiceCount: integer("invoice_count").notNull().default(0), revenue: money("revenue").notNull().default("0"),
  costOfGoodsSold: money("cost_of_goods_sold").notNull().default("0"), grossProfit: money("gross_profit").notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("dashboard_daily_summary_day_idx").on(table.day)]);

export const systemMetadata = pgTable("system_metadata", {
  id: uuid("id").defaultRandom().primaryKey(), key: text("key").notNull(), value: text("value").notNull(), version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("system_metadata_key_uq").on(table.key), index("system_metadata_updated_at_idx").on(table.updatedAt)]);

export type Material = typeof materials.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type StockBatch = typeof stockBatches.$inferSelect;
