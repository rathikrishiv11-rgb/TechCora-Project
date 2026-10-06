import { NextResponse } from "next/server";

import { listLocations } from "@/lib/erp";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ rows: await listLocations() });
}
