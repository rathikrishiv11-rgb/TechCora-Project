import { NextResponse } from "next/server";

import { listMovements } from "@/lib/erp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 25));
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  return NextResponse.json(await listMovements({ query, page, pageSize }));
}
