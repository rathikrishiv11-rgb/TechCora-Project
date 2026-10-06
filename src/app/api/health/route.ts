import { NextResponse } from "next/server";

import { sql } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await sql`select 1`;
    return NextResponse.json({ status: "ok", service: "stockerp", timestamp: new Date().toISOString(), database: "connected" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", service: "stockerp", timestamp: new Date().toISOString(), database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
