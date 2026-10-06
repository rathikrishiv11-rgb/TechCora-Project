import Link from "next/link";
import { listInvoices, type InvoiceSort, type SortDirection } from "@/lib/erp";
export const dynamic = "force-dynamic";
const validSorts = new Set<InvoiceSort>(["invoiceDate", "invoiceNumber", "customer", "total", "status"]);
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
function urlFor(values: Record<string, string | number>, current: Record<string, string>) { const params = new URLSearchParams(current); Object.entries(values).forEach(([key, value]) => params.set(key, String(value))); return `/invoices?${params.toString()}`; }
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams; const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value ?? "";
  const q = one(raw.q).slice(0, 100); const page = Math.max(1, Number(one(raw.page)) || 1); const requestedSort = one(raw.sort) as InvoiceSort;
  const sort = validSorts.has(requestedSort) ? requestedSort : "invoiceDate"; const direction: SortDirection = one(raw.direction) === "asc" ? "asc" : "desc"; const pageSize = 25;
  const result = await listInvoices({ page, pageSize, query: q, sort, direction }); const pageCount = Math.max(1, Math.ceil(result.total / pageSize));
  const current = { q, page: String(page), sort, direction }; const sortLink = (column: InvoiceSort) => urlFor({ sort: column, direction: sort === column && direction === "asc" ? "desc" : "asc", page: 1 }, current);
  return <main className="app-main"><section className="page-intro compact"><div><p className="kicker">Sales ledger</p><h1>Invoices</h1><p>{result.total.toLocaleString("en-IN")} records, fetched 25 at a time.</p></div><Link className="button primary" href="/invoices/new">New invoice</Link></section>
    <form className="toolbar" action="/invoices"><label><span className="sr-only">Search invoices</span><input name="q" defaultValue={q} placeholder="Search invoice, customer, or status…" /></label><button className="button secondary" type="submit">Search</button>{q && <Link className="text-link" href="/invoices">Clear</Link>}</form>
    <section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th><Link href={sortLink("invoiceNumber")}>Invoice ↕</Link></th><th><Link href={sortLink("customer")}>Customer ↕</Link></th><th><Link href={sortLink("invoiceDate")}>Date ↕</Link></th><th>Status</th><th className="numeric"><Link href={sortLink("total")}>Total ↕</Link></th><th className="numeric">Balance</th></tr></thead><tbody>{result.rows.map((row) => <tr key={String(row.id)}><td className="mono">{String(row.invoiceNumber)}</td><td>{String(row.customerName)}</td><td>{String(row.invoiceDate)}</td><td><span className="status-pill">{String(row.status)}</span></td><td className="numeric">{inr.format(Number(row.total))}</td><td className="numeric">{inr.format(Number(row.balance))}</td></tr>)}</tbody></table></div>
      {!result.rows.length && <p className="empty">No invoices match this search.</p>}<footer className="pagination"><span>Page {page} of {pageCount}</span><div>{page > 1 && <Link className="button secondary" href={urlFor({ page: page - 1 }, current)}>Previous</Link>}{page < pageCount && <Link className="button secondary" href={urlFor({ page: page + 1 }, current)}>Next</Link>}</div></footer></section>
  </main>;
}
