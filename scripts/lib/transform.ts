import type {
  customers, directDeliveries, directDeliveryLines, importAnomalies, invoiceLines, invoices, materials,
  purchaseOrderLines, purchaseOrders, purchaseReceiptLines, purchaseReceipts, stockAdjustments, stockBatches,
  stockMovements, storageLocations, units, vendors,
} from "../../src/db/schema.ts";
import {
  booleanValue, childRecords, collectionCounts, dateOnly, dateValue, entries, isRecord, moneyText,
  movementDirectionFor, nullableText, numericText, searchKey, stableLineId, textValue,
  type Anomaly, type SourceExport,
} from "./source.ts";

type MaterialRow = typeof materials.$inferInsert;
type CustomerRow = typeof customers.$inferInsert;
type VendorRow = typeof vendors.$inferInsert;
type UnitRow = typeof units.$inferInsert;
type LocationRow = typeof storageLocations.$inferInsert;
type InvoiceRow = typeof invoices.$inferInsert;
type InvoiceLineRow = typeof invoiceLines.$inferInsert;
type PurchaseOrderRow = typeof purchaseOrders.$inferInsert;
type PurchaseOrderLineRow = typeof purchaseOrderLines.$inferInsert;
type ReceiptRow = typeof purchaseReceipts.$inferInsert;
type ReceiptLineRow = typeof purchaseReceiptLines.$inferInsert;
type BatchRow = typeof stockBatches.$inferInsert;
type MovementRow = typeof stockMovements.$inferInsert;
type AdjustmentRow = typeof stockAdjustments.$inferInsert;
type DeliveryRow = typeof directDeliveries.$inferInsert;
type DeliveryLineRow = typeof directDeliveryLines.$inferInsert;
type AnomalyRow = typeof importAnomalies.$inferInsert;

export interface TransformedExport {
  counts: Record<string, number>;
  anomalies: Anomaly[];
  units: UnitRow[];
  storageLocations: LocationRow[];
  materials: MaterialRow[];
  customers: CustomerRow[];
  vendors: VendorRow[];
  invoices: InvoiceRow[];
  invoiceLines: InvoiceLineRow[];
  purchaseOrders: PurchaseOrderRow[];
  purchaseOrderLines: PurchaseOrderLineRow[];
  purchaseReceipts: ReceiptRow[];
  purchaseReceiptLines: ReceiptLineRow[];
  stockBatches: BatchRow[];
  stockMovements: MovementRow[];
  stockAdjustments: AdjustmentRow[];
  directDeliveries: DeliveryRow[];
  directDeliveryLines: DeliveryLineRow[];
}

export function transformExport(data: SourceExport): TransformedExport {
  const anomalies: Anomaly[] = [];
  const materialIds = new Set(Object.keys(data.inventory.materials));
  const customerIds = new Set(Object.keys(data.sales.customers));
  const vendorIdAliases = new Map<string, string>();
  for (const [key, vendor] of entries(data.purchasing.vendors)) {
    vendorIdAliases.set(key, key);
    const embeddedId = nullableText(vendor.id);
    if (embeddedId) vendorIdAliases.set(embeddedId, key);
  }
  const purchaseOrderIds = new Set(Object.keys(data.purchasing.purchaseOrders));
  const invoiceIds = new Set(Object.keys(data.sales.invoices));
  const invoiceIdByNumber = new Map(entries(data.sales.invoices).map(([id, invoice]) => [textValue(invoice.invoiceNumber), id]));
  const purchaseReceiptIds = new Set(Object.keys(data.purchasing.purchaseReceipts));

  const unitsRows: UnitRow[] = entries(data.units).map(([id, record]) => ({
    id, code: nullableText(record.code), name: textValue(record.name, id), symbol: textValue(record.symbol, textValue(record.name, id)),
    type: nullableText(record.type), description: nullableText(record.description), isActive: booleanValue(record.isActive, true),
    createdAt: dateValue(record.createdAt), updatedAt: dateValue(record.updatedAt), sourceData: record,
  }));

  const locationRows: LocationRow[] = [];
  for (const [sourcePath, collection] of [["inventory/storageLocations", data.inventory.storageLocations], ["inventory/storage_locations", data.inventory.storage_locations]] as const) {
    for (const [id, record] of entries(collection)) {
      locationRows.push({ id, name: textValue(record.name, id), locationType: nullableText(record.locationType), capacityUnit: nullableText(record.capacityUnit),
        isDefault: booleanValue(record.isDefault), sourcePath, createdAt: dateValue(record.createdAt), updatedAt: dateValue(record.updatedAt), sourceData: record });
    }
  }

  const materialRows: MaterialRow[] = entries(data.inventory.materials).map(([id, record]) => ({
    id, name: textValue(record.name, id), modelNumber: nullableText(record.modelNumber), description: nullableText(record.description),
    defaultUnit: nullableText(record.defaultUnit), gradeOrQuality: nullableText(record.gradeOrQuality), reorderPoint: numericText(record.reorderPoint),
    storageRequirements: nullableText(record.storageRequirements), notes: nullableText(record.notes), isActive: booleanValue(record.isActive, true),
    searchKey: searchKey(record.name, record.modelNumber, id), updatedAt: dateValue(record.updatedAt), sourceData: record,
  }));

  const customerRows: CustomerRow[] = entries(data.sales.customers).map(([id, record]) => ({
    id, name: textValue(record.name, id), email: nullableText(record.email), phone: nullableText(record.phone),
    address: isRecord(record.address) ? record.address : null, searchKey: searchKey(record.name, record.email, record.phone, id), sourceData: record,
  }));

  const vendorRows: VendorRow[] = entries(data.purchasing.vendors).map(([id, record]) => {
    const embeddedId = nullableText(record.id);
    if (embeddedId && embeddedId !== id) anomalies.push({ severity: "warning", code: "VENDOR_KEY_ID_MISMATCH", sourcePath: "purchasing/vendors", sourceId: id,
      message: "The vendor record key differs from its embedded id.", details: { key: id, embeddedId } });
    return { id, embeddedId, name: textValue(record.name, id), contactPerson: nullableText(record.contactPerson), email: nullableText(record.email),
      phone: nullableText(record.phone), address: nullableText(record.address), paymentTerms: nullableText(record.paymentTerms), taxId: nullableText(record.taxId),
      notes: nullableText(record.notes), isActive: booleanValue(record.isActive, true), searchKey: searchKey(record.name, record.email, record.phone, id),
      createdAt: dateValue(record.createdAt), updatedAt: dateValue(record.updatedAt), sourceData: record };
  });

  const invoiceRows: InvoiceRow[] = [];
  const invoiceLineRows: InvoiceLineRow[] = [];
  for (const [id, record] of entries(data.sales.invoices)) {
    const customerId = nullableText(record.customerId);
    const validCustomerId = customerId && customerIds.has(customerId) ? customerId : null;
    if (customerId && !validCustomerId) anomalies.push(missingReference("INVOICE_CUSTOMER_MISSING", "sales/invoices", id, "customer", customerId));
    if (validCustomerId && isRecord(record.customer) && JSON.stringify(record.customer) !== JSON.stringify(data.sales.customers[validCustomerId])) {
      anomalies.push({ severity: "info", code: "INVOICE_CUSTOMER_SNAPSHOT_DRIFT", sourcePath: "sales/invoices", sourceId: id,
        message: "The embedded customer snapshot differs from the current customer master record.", details: { customerId: validCustomerId } });
    }
    invoiceRows.push({ id, invoiceNumber: textValue(record.invoiceNumber, id), customerId: validCustomerId,
      customerSnapshot: isRecord(record.customer) ? record.customer : null, invoiceDate: dateOnly(record.date), dueDate: dateValue(record.dueDate),
      status: textValue(record.status, "unknown"), type: nullableText(record.type), locationId: nullableText(record.locationTakenFrom), subtotal: moneyText(record.subtotal),
      discountTotal: moneyText(record.discountTotal), taxTotal: moneyText(record.taxTotal), total: moneyText(record.total), paidAmount: moneyText(record.paidAmount),
      balance: moneyText(record.balance), projectId: nullableText(record.projectId), projectName: nullableText(record.projectName), serviceType: nullableText(record.serviceType),
      terms: nullableText(record.terms), notes: nullableText(record.notes), createdAt: dateValue(record.createdAt), updatedAt: dateValue(record.updatedAt), sourceData: record });
    childRecords(record, "items").forEach((line, index) => {
      const sourceMaterialId = nullableText(line.productId);
      const materialId = sourceMaterialId && materialIds.has(sourceMaterialId) ? sourceMaterialId : null;
      if (sourceMaterialId && !materialId) anomalies.push(missingReference("INVOICE_LINE_MATERIAL_MISSING", `sales/invoices/${id}/items`, String(index), "material", sourceMaterialId));
      invoiceLineRows.push({ id: stableLineId(id, line, index), invoiceId: id, lineNumber: index + 1, materialId, sourceMaterialId,
        itemType: nullableText(line.itemType), description: nullableText(line.description), unit: nullableText(line.unit), locationId: nullableText(line.storageLocation),
        quantity: numericText(line.quantity), unitPrice: moneyText(line.unitPrice), discount: moneyText(line.discount), lineTotal: moneyText(line.totalPrice), sourceData: line });
    });
  }

  const purchaseOrderRows: PurchaseOrderRow[] = [];
  const purchaseOrderLineRows: PurchaseOrderLineRow[] = [];
  const seenPurchaseOrderNumbers = new Set<string>();
  for (const [id, record] of entries(data.purchasing.purchaseOrders)) {
    const sourceVendorId = nullableText(record.vendorId);
    const vendorId = sourceVendorId ? (vendorIdAliases.get(sourceVendorId) ?? null) : null;
    if (sourceVendorId && !vendorId) anomalies.push(missingReference("PURCHASE_ORDER_VENDOR_MISSING", "purchasing/purchaseOrders", id, "vendor", sourceVendorId));
    const expectedDeliveryDate = dateValue(record.expectedDeliveryDate);
    if (record.expectedDeliveryDate && !expectedDeliveryDate) anomalies.push({ severity: "warning", code: "INVALID_DATE", sourcePath: "purchasing/purchaseOrders", sourceId: id,
      message: "An out-of-range expected delivery date was retained in source_data and omitted from the typed column.", details: { field: "expectedDeliveryDate", value: record.expectedDeliveryDate } });
    const orderNumber = textValue(record.orderNumber, id);
    if (seenPurchaseOrderNumbers.has(orderNumber)) anomalies.push({ severity: "warning", code: "DUPLICATE_PURCHASE_ORDER_NUMBER", sourcePath: "purchasing/purchaseOrders", sourceId: id,
      message: "The purchase-order number is used by more than one source record.", details: { orderNumber } });
    seenPurchaseOrderNumbers.add(orderNumber);
    purchaseOrderRows.push({ id, orderNumber, vendorId, vendorName: nullableText(record.vendorName), orderDate: dateOnly(record.orderDate),
      expectedDeliveryDate, status: textValue(record.status, "unknown"), currency: nullableText(record.currency),
      exchangeRate: numericText(record.exchangeRate), subtotal: moneyText(record.subtotal), discount: moneyText(record.discount), courierCharges: moneyText(record.courierCharges),
      total: moneyText(record.total), notes: nullableText(record.notes), createdBy: nullableText(record.createdBy), updatedBy: nullableText(record.updatedBy),
      createdAt: dateValue(record.createdAt), updatedAt: dateValue(record.updatedAt), sourceData: record });
    childRecords(record, "items").forEach((line, index) => {
      const sourceMaterialId = nullableText(line.materialId);
      const materialId = sourceMaterialId && materialIds.has(sourceMaterialId) ? sourceMaterialId : null;
      if (sourceMaterialId && !materialId) anomalies.push(missingReference("PURCHASE_ORDER_LINE_MATERIAL_MISSING", `purchasing/purchaseOrders/${id}/items`, String(index), "material", sourceMaterialId));
      purchaseOrderLineRows.push({ id: stableLineId(id, line, index), purchaseOrderId: id, lineNumber: index + 1, materialId, sourceMaterialId,
        description: nullableText(line.description), unit: nullableText(line.unit), quantity: numericText(line.quantity), receivedQuantity: numericText(line.receivedQuantity),
        unitPrice: moneyText(line.unitPrice), originalUnitPrice: moneyText(line.originalUnitPrice), originalCurrency: nullableText(line.originalCurrency),
        discount: moneyText(line.discount), lineTotal: moneyText(line.totalPrice), sourceData: line });
    });
  }

  const poLineIds = new Set(purchaseOrderLineRows.map((line) => textValue(line.id)));
  const receiptRows: ReceiptRow[] = [];
  const receiptLineRows: ReceiptLineRow[] = [];
  const seenReceiptNumbers = new Set<string>();
  for (const [id, record] of entries(data.purchasing.purchaseReceipts)) {
    const sourceOrderId = nullableText(record.purchaseOrderId);
    const purchaseOrderId = sourceOrderId && purchaseOrderIds.has(sourceOrderId) ? sourceOrderId : null;
    const sourceVendorId = nullableText(record.vendorId);
    const vendorId = sourceVendorId ? (vendorIdAliases.get(sourceVendorId) ?? null) : null;
    if (sourceOrderId && !purchaseOrderId) anomalies.push(missingReference("RECEIPT_PURCHASE_ORDER_MISSING", "purchasing/purchaseReceipts", id, "purchase order", sourceOrderId));
    const receiptNumber = textValue(record.receiptNumber, id);
    if (seenReceiptNumbers.has(receiptNumber)) anomalies.push({ severity: "warning", code: "DUPLICATE_RECEIPT_NUMBER", sourcePath: "purchasing/purchaseReceipts", sourceId: id,
      message: "The receipt number is used by more than one source record.", details: { receiptNumber } });
    seenReceiptNumbers.add(receiptNumber);
    receiptRows.push({ id, receiptNumber, purchaseOrderId, vendorId, receiptDate: dateOnly(record.receiptDate),
      status: textValue(record.status, "unknown"), landedCost: moneyText(record.landedCost), notes: nullableText(record.notes), createdBy: nullableText(record.createdBy),
      updatedBy: nullableText(record.updatedBy), createdAt: dateValue(record.createdAt), updatedAt: dateValue(record.updatedAt), sourceData: record });
    childRecords(record, "items").forEach((line, index) => {
      const sourceMaterialId = nullableText(line.materialId);
      const materialId = sourceMaterialId && materialIds.has(sourceMaterialId) ? sourceMaterialId : null;
      const rawPoLineId = nullableText(line.purchaseOrderItemId);
      const compositePoLineId = rawPoLineId && sourceOrderId ? `${sourceOrderId}:${rawPoLineId}` : null;
      const purchaseOrderLineId = compositePoLineId && poLineIds.has(compositePoLineId) ? compositePoLineId : null;
      if (sourceMaterialId && !materialId) anomalies.push(missingReference("RECEIPT_LINE_MATERIAL_MISSING", `purchasing/purchaseReceipts/${id}/items`, String(index), "material", sourceMaterialId));
      receiptLineRows.push({ id: stableLineId(id, line, index), purchaseReceiptId: id, purchaseOrderLineId, lineNumber: index + 1, materialId, sourceMaterialId,
        locationId: nullableText(line.storageLocationId), description: nullableText(line.description), unit: nullableText(line.unit),
        receivedQuantity: numericText(line.receivedQuantity), notes: nullableText(line.notes), sourceData: line });
    });
  }

  const batchRows: BatchRow[] = entries(data.inventory.stockLevels).map(([id, record]) => {
    const sourceMaterialId = textValue(record.itemId);
    const materialId = materialIds.has(sourceMaterialId) ? sourceMaterialId : null;
    if (!materialId) anomalies.push(missingReference("STOCK_BATCH_MATERIAL_MISSING", "inventory/stockLevels", id, "material", sourceMaterialId));
    return { id, materialId, sourceMaterialId, locationId: nullableText(record.destinationLocationId), purchaseReceiptLineId: null,
      quantityRemaining: numericText(record.quantity), unitCost: record.costPerUnit === undefined ? null : moneyText(record.costPerUnit), unit: nullableText(record.unit),
      status: nullableText(record.status), receivedAt: dateValue(record.createdAt), updatedAt: dateValue(record.lastUpdated), sourceData: record };
  });

  const movementRows: MovementRow[] = entries(data.inventory.transactions).map(([id, record]) => {
    const sourceMaterialId = textValue(record.itemId);
    const materialId = materialIds.has(sourceMaterialId) ? sourceMaterialId : null;
    if (!materialId) anomalies.push(missingReference("MOVEMENT_MATERIAL_MISSING", "inventory/transactions", id, "material", sourceMaterialId));
    const rawDocumentId = nullableText(record.relatedDocumentId);
    const documentType = nullableText(record.relatedDocumentType);
    const resolved = resolveDocument(rawDocumentId, documentType, textValue(record.notes), invoiceIdByNumber, invoiceIds, purchaseOrderIds, purchaseReceiptIds);
    if (rawDocumentId && !resolved.id) anomalies.push({ severity: "warning", code: "MOVEMENT_DOCUMENT_UNRESOLVED", sourcePath: "inventory/transactions", sourceId: id,
      message: "The movement's related document could not be resolved.", details: { rawDocumentId, documentType } });
    return { id, materialId, sourceMaterialId, batchId: null, locationId: nullableText(record.destinationLocationId), movementType: textValue(record.transactionType, "unknown"),
      direction: movementDirectionFor(record.transactionType, record.quantity), quantity: numericText(record.quantity), unit: nullableText(record.unit),
      costPerUnit: record.costPerUnit === undefined ? null : moneyText(record.costPerUnit), totalCost: record.totalCost === undefined ? null : moneyText(record.totalCost),
      relatedDocumentType: documentType, rawRelatedDocumentId: rawDocumentId, resolvedRelatedDocumentId: resolved.id, relationshipConfidence: resolved.confidence,
      notes: nullableText(record.notes), performedBy: nullableText(record.performedBy), movementAt: dateValue(record.transactionDate) ?? dateValue(record.createdAt) ?? new Date(0),
      createdAt: dateValue(record.createdAt), sourceData: record };
  });

  const movementIds = new Set(movementRows.map((movement) => textValue(movement.id)));
  const adjustmentRows: AdjustmentRow[] = entries(data.inventory.stockAdjustments).map(([id, record]) => {
    const sourceMaterialId = textValue(record.itemId);
    const materialId = materialIds.has(sourceMaterialId) ? sourceMaterialId : null;
    const rawTransactionId = nullableText(record.transactionId);
    return { id, materialId, sourceMaterialId, locationId: nullableText(record.locationId), transactionId: rawTransactionId && movementIds.has(rawTransactionId) ? rawTransactionId : null,
      adjustmentType: textValue(record.adjustmentType, "unknown"), quantity: numericText(record.quantity), unit: nullableText(record.unit), reason: nullableText(record.reason),
      status: nullableText(record.status), notes: nullableText(record.notes), createdBy: nullableText(record.createdBy), approvedBy: nullableText(record.approvedBy),
      createdAt: dateValue(record.createdAt), approvedAt: dateValue(record.approvedAt), sourceData: record };
  });

  const deliveryRows: DeliveryRow[] = [];
  const deliveryLineRows: DeliveryLineRow[] = [];
  for (const [id, record] of entries(data.sales["direct-deliveries"])) {
    const sourceCustomerId = nullableText(record.customerId);
    const customerId = sourceCustomerId && customerIds.has(sourceCustomerId) ? sourceCustomerId : null;
    deliveryRows.push({ id, deliveryNumber: textValue(record.deliveryNumber, id), customerId, customerName: nullableText(record.customerName),
      locationId: nullableText(record.locationTakenFrom), deliveryDate: dateValue(record.deliveryDate), status: nullableText(record.status), paymentStatus: nullableText(record.paymentStatus),
      paymentMethod: nullableText(record.paymentMethod), subtotal: moneyText(record.subtotal), discount: moneyText(record.discount), total: moneyText(record.total),
      stockUpdated: booleanValue(record.stockUpdated), notes: nullableText(record.notes), createdAt: dateValue(record.createdAt), updatedAt: dateValue(record.updatedAt), sourceData: record });
    childRecords(record, "items").forEach((line, index) => {
      const sourceMaterialId = nullableText(line.materialId);
      const materialId = sourceMaterialId && materialIds.has(sourceMaterialId) ? sourceMaterialId : null;
      deliveryLineRows.push({ id: `${id}:line:${index + 1}`, directDeliveryId: id, lineNumber: index + 1, materialId, sourceMaterialId,
        materialName: nullableText(line.materialName), modelNumber: nullableText(line.modelNumber), locationId: nullableText(line.storageLocation), unit: nullableText(line.uom),
        quantity: numericText(line.quantity), unitPrice: moneyText(line.unitPrice), lineTotal: moneyText(line.total), sourceData: line });
    });
  }

  anomalies.push({ severity: "info", code: "BATCH_RECEIPT_LINK_NOT_PRESENT", sourcePath: "inventory/stockLevels",
    message: "Stock rows do not contain a receipt-line identifier; historical batches are retained without an invented relationship.", details: { batchCount: batchRows.length } });

  return { counts: collectionCounts(data), anomalies, units: unitsRows, storageLocations: locationRows, materials: materialRows, customers: customerRows,
    vendors: vendorRows, invoices: invoiceRows, invoiceLines: invoiceLineRows, purchaseOrders: purchaseOrderRows, purchaseOrderLines: purchaseOrderLineRows,
    purchaseReceipts: receiptRows, purchaseReceiptLines: receiptLineRows, stockBatches: batchRows, stockMovements: movementRows,
    stockAdjustments: adjustmentRows, directDeliveries: deliveryRows, directDeliveryLines: deliveryLineRows };
}

function missingReference(code: string, sourcePath: string, sourceId: string, target: string, targetId: string): Anomaly {
  return { severity: "warning", code, sourcePath, sourceId, message: `The referenced ${target} does not exist in the export.`, details: { targetId } };
}

function resolveDocument(rawId: string | null, type: string | null, notes: string, invoiceIdByNumber: Map<string, string>, invoiceIds: Set<string>, purchaseOrderIds: Set<string>, receiptIds: Set<string>): { id: string | null; confidence: string | null } {
  if (rawId && rawId !== "new") {
    const targetSet = type?.includes("receipt") ? receiptIds : type?.includes("purchase") ? purchaseOrderIds : invoiceIds;
    if (targetSet.has(rawId)) return { id: rawId, confidence: "exact-id" };
  }
  if (type === "sales_order" || notes.includes("Invoice")) {
    const match = notes.match(/Invoice\s+#(.+?)\s+-\s+Batch:/i);
    if (match) {
      const id = invoiceIdByNumber.get(match[1].trim());
      if (id) return { id, confidence: "invoice-number-in-note" };
    }
  }
  return { id: null, confidence: null };
}

export function anomalyRows(anomalies: Anomaly[], importRunId: string): AnomalyRow[] {
  return anomalies.map((anomaly) => ({ importRunId, severity: anomaly.severity, code: anomaly.code, sourcePath: anomaly.sourcePath,
    sourceId: anomaly.sourceId, message: anomaly.message, details: anomaly.details ?? {} }));
}
