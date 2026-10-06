import { NextResponse } from "next/server";

import { searchMaterials } from "@/lib/erp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").slice(0, 100);
  const locationId = (params.get("locationId") ?? "").slice(0, 100) || undefined;
  return NextResponse.json({ rows: await searchMaterials(query, locationId) });
}
