import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "stockerp",
      timestamp: new Date().toISOString(),
      database: "not-checked",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
