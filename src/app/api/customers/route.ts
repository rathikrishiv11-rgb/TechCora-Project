import { NextResponse } from "next/server";

import { searchCustomers } from "@/lib/erp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 100);
  return NextResponse.json({ rows: await searchCustomers(query) });
}
