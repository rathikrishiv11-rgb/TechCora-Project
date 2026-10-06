import { z } from "zod";

const decimalInput = z.coerce.number().finite();

export const createInvoiceSchema = z.object({
  requestId: z.string().min(8).max(100),
  customerId: z.string().min(1).nullable().optional(),
  invoiceDate: z.iso.date(),
  dueDate: z.iso.date().nullable().optional(),
  locationId: z.string().min(1),
  notes: z.string().max(2000).optional(),
  lines: z.array(z.object({
    materialId: z.string().min(1),
    quantity: decimalInput.positive(),
    unitPrice: decimalInput.nonnegative(),
    discount: decimalInput.nonnegative().default(0),
  })).min(1).max(100),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const createReceiptSchema = z.object({
  requestId: z.string().min(8).max(100),
  receiptDate: z.iso.date(),
  locationId: z.string().min(1),
  vendorId: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(z.object({
    materialId: z.string().min(1),
    quantity: decimalInput.positive(),
    unitCost: decimalInput.nonnegative(),
  })).min(1).max(100),
});

export type CreateReceiptInput = z.infer<typeof createReceiptSchema>;

export class InsufficientStockError extends Error {
  constructor(
    public readonly materialId: string,
    public readonly requested: number,
    public readonly available: number,
  ) {
    super(`Insufficient stock: requested ${requested}, available ${available}.`);
    this.name = "InsufficientStockError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("This request ID was already used with different invoice data.");
    this.name = "IdempotencyConflictError";
  }
}
