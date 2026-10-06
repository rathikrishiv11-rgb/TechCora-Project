import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createInvoiceSchema, IdempotencyConflictError, InsufficientStockError } from "@/lib/contracts";
import { createInvoice, listInvoices, type InvoiceSort, type SortDirection } from "@/lib/erp";

export const dynamic = "force-dynamic";

const validSorts = new Set<InvoiceSort>(["invoiceDate", "dueDate", "invoiceNumber", "customer", "total", "balance", "status"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 25));
  const requestedSort = params.get("sort") as InvoiceSort;
  const sort = validSorts.has(requestedSort) ? requestedSort : "invoiceDate";
  const direction: SortDirection = params.get("direction") === "asc" ? "asc" : "desc";
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const status = (params.get("status") ?? "").trim().slice(0, 40) || undefined;

  return NextResponse.json(await listInvoices({ page, pageSize, query, status, sort, direction }));
}

export async function POST(request: Request) {
  try {
    const input = createInvoiceSchema.parse(await request.json());
    const result = await createInvoice(input);
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid invoice", issues: error.issues }, { status: 400 });
    }
    if (error instanceof InsufficientStockError) {
      return NextResponse.json({
        error: error.message,
        materialId: error.materialId,
        requested: error.requested,
        available: error.available,
      }, { status: 409 });
    }
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Invoice creation failed", error);
    return NextResponse.json({ error: "Invoice could not be saved." }, { status: 500 });
  }
}
