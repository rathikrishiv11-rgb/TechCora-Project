import { describe, expect, it } from "vitest";

import { createInvoiceSchema, createReceiptSchema } from "./contracts";

describe("ERP write contracts", () => {
  it("rejects non-positive invoice quantities", () => {
    const parsed = createInvoiceSchema.safeParse({
      requestId: "request-123",
      invoiceDate: "2026-10-06",
      locationId: "warehouse-a",
      lines: [{ materialId: "material-a", quantity: 0, unitPrice: 10 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts an explicit batch choice on an invoice line", () => {
    const parsed = createInvoiceSchema.safeParse({
      requestId: "request-123",
      invoiceDate: "2026-10-06",
      locationId: "warehouse-a",
      lines: [{ materialId: "material-a", batchId: "batch-a", quantity: 2, unitPrice: 10 }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts one atomic 60-line receipt", () => {
    const parsed = createReceiptSchema.safeParse({
      requestId: "receipt-123",
      receiptDate: "2026-10-06",
      locationId: "warehouse-a",
      lines: Array.from({ length: 60 }, (_, index) => ({
        materialId: `material-${index}`,
        quantity: 1,
        unitCost: 10,
      })),
    });
    expect(parsed.success).toBe(true);
  });

  it("bounds receipts to 100 lines", () => {
    const parsed = createReceiptSchema.safeParse({
      requestId: "receipt-123",
      receiptDate: "2026-10-06",
      locationId: "warehouse-a",
      lines: Array.from({ length: 101 }, (_, index) => ({
        materialId: `material-${index}`,
        quantity: 1,
        unitCost: 10,
      })),
    });
    expect(parsed.success).toBe(false);
  });
});
