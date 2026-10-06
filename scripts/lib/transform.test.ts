import { describe, expect, it } from "vitest";

import { transformExport } from "./transform.ts";
import type { SourceExport } from "./source.ts";

function fixture(): SourceExport {
  return {
    inventory: {
      materials: { "1700000000000": { id: "1700000000000", name: "Widget", modelNumber: "W-1", reorderPoint: "5", isActive: true } },
      stockAdjustments: {},
      stockLevels: { batch1: { id: "batch1", itemId: "1700000000000", destinationLocationId: "loc1", quantity: "12", status: "available" } },
      storageLocations: { loc1: { id: "loc1", name: "Warehouse", isDefault: true } },
      storage_locations: {},
      transactions: {
        movement1: { id: "movement1", itemId: "1700000000000", transactionType: "sales", quantity: "2", relatedDocumentType: "sales_order", relatedDocumentId: "new", notes: "Sold via Invoice #INV-1 - Batch: batch1", transactionDate: "2026-01-02T00:00:00Z" },
      },
    },
    purchasing: {
      purchaseOrders: { po1: { id: "po1", orderNumber: "PO-1", vendorId: "embedded-vendor", orderDate: "2026-01-01", status: "sent", items: [] } },
      purchaseReceipts: {},
      vendors: { "vendor-key": { id: "embedded-vendor", name: "Vendor" } },
    },
    sales: {
      customers: { customer1: { id: "customer1", name: "Customer" } },
      "direct-deliveries": {},
      invoices: { invoice1: { id: "invoice1", invoiceNumber: "INV-1", customerId: "customer1", customer: { id: "customer1", name: "Customer" }, date: "2026-01-02", status: "sent", total: "20.00", items: [{ productId: "1700000000000", quantity: "2", unitPrice: "10", totalPrice: 20 }] } },
    },
    units: {},
  };
}

describe("masked export transformation", () => {
  it("normalizes numeric strings without losing records", () => {
    const result = transformExport(fixture());
    expect(result.stockBatches).toHaveLength(1);
    expect(result.stockBatches[0].quantityRemaining).toBe("12");
    expect(result.invoiceLines[0].quantity).toBe("2");
    expect(result.invoiceLines[0].unitPrice).toBe("10.00");
  });

  it("resolves vendor aliases and invoice numbers embedded in movement notes", () => {
    const result = transformExport(fixture());
    expect(result.purchaseOrders[0].vendorId).toBe("vendor-key");
    expect(result.stockMovements[0].resolvedRelatedDocumentId).toBe("invoice1");
    expect(result.stockMovements[0].relationshipConfidence).toBe("invoice-number-in-note");
  });

  it("preserves source snapshots and records non-invented historical gaps", () => {
    const result = transformExport(fixture());
    expect(result.materials[0].sourceData).toMatchObject({ name: "Widget" });
    expect(result.anomalies.some((item) => item.code === "BATCH_RECEIPT_LINK_NOT_PRESENT")).toBe(true);
  });
});
