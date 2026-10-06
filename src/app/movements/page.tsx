import Link from "next/link";
import { listMovements } from "@/lib/erp";
export const dynamic = "force-dynamic";
export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams; const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value ?? "";
  const q = one(raw.q).slice(0, 100); const page = Math.max(1, Number(one(raw.page)) || 1); const result = await listMovements({ query: q, page, pageSize: 25 }); const pages = Math.max(1, Math.ceil(result.total / 25));
  const makeUrl = (nextPage: number) => `/movements?${new URLSearchParams({ q, page: String(nextPage) })}`;
  return <main className="app-main"><section className="page-intro compact"><div><p className="kicker">Audit trail</p><h1>Stock movements</h1><p>{result.total.toLocaleString("en-IN")} immutable inventory events.</p></div></section>
    <form className="toolbar"><input name="q" defaultValue={q} placeholder="Search material, movement type, or document…"/><button className="button secondary">Search</button></form>
    <section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>When</th><th>Material</th><th>Type</th><th>Direction</th><th className="numeric">Quantity</th><th>Location</th><th>Document</th></tr></thead><tbody>{result.rows.map((row) => <tr key={String(row.id)}><td>{new Date(String(row.movementAt)).toLocaleString("en-IN")}</td><td>{String(row.materialName ?? "Unknown material")}</td><td>{String(row.movementType)}</td><td><span className={`direction direction-${String(row.direction)}`}>{String(row.direction)}</span></td><td className="numeric">{Number(row.quantity).toLocaleString("en-IN")} {String(row.unit ?? "")}</td><td>{String(row.locationName ?? "—")}</td><td className="mono">{String(row.documentId ?? "—")}</td></tr>)}</tbody></table></div><footer className="pagination"><span>Page {page} of {pages}</span><div>{page > 1 && <Link className="button secondary" href={makeUrl(page - 1)}>Previous</Link>}{page < pages && <Link className="button secondary" href={makeUrl(page + 1)}>Next</Link>}</div></footer></section>
  </main>;
}
