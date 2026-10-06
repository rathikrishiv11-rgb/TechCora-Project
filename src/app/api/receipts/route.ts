import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createReceiptSchema, IdempotencyConflictError } from "@/lib/contracts";
import { createReceipt } from "@/lib/erp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = createReceiptSchema.parse(await request.json());
    const result = await createReceipt(input);
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "Invalid receipt", issues: error.issues }, { status: 400 });
    if (error instanceof IdempotencyConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Receipt creation failed", error);
    return NextResponse.json({ error: "Receipt could not be saved." }, { status: 500 });
  }
}
