import { NextResponse } from "next/server";

import { listMaterialBatches } from "@/lib/erp";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json({ rows: await listMaterialBatches(id) });
}
