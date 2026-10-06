import { NextResponse } from "next/server";
import { z } from "zod";

import { getEditorStock } from "@/lib/erp";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  locationId: z.string().min(1).max(100),
  materialIds: z.array(z.string().min(1).max(100)).min(1).max(100),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid stock refresh request." }, { status: 400 });
  const materialIds = [...new Set(parsed.data.materialIds)];
  return NextResponse.json(await getEditorStock(materialIds, parsed.data.locationId));
}
