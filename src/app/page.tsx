import Link from "next/link";

import { getDashboard } from "@/lib/erp";

export const dynamic = "force-dynamic";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export default async function DashboardPage() {
  const data = await getDashboard();
  const totals = data.totals ?? {};
  return <main className="app-main">
    <section className="page-intro"><div><p className="kicker">Operational overview</p><h1>Good inventory decisions start here.</h1></div><Link className="button primary" href="/invoices/new">Create invoice</Link></section>
    <section className="metric-grid" aria-label="Business totals">
      <article><span>Revenue</span><strong>{inr.format(Number(totals.revenue ?? 0))}</strong><small>Across all imported invoices</small></article>
      <article><span>Invoices</span><strong>{number.format(Number(totals.invoiceCount ?? 0))}</strong><small>Server-paginated records</small></article>
      <article><span>Materials</span><strong>{number.format(Number(totals.materialCount ?? 0))}</strong><small>Active catalog items</small></article>
      <article className="accent-metric"><span>Available stock</span><strong>{number.format(Number(totals.stockUnits ?? 0))}</strong><small>Derived from positive batches</small></article>
    </section>
    <section className="dashboard-grid">
      <article className="panel"><div className="panel-heading"><div><p className="kicker">Latest activity</p><h2>Recent invoices</h2></div><Link href="/invoices">View all</Link></div><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th className="numeric">Total</th></tr></thead><tbody>{data.recent.map((row) => <tr key={String(row.id)}><td className="mono">{String(row.invoiceNumber)}</td><td>{String(row.customerName)}</td><td>{String(row.invoiceDate)}</td><td className="numeric">{inr.format(Number(row.total))}</td></tr>)}</tbody></table></div></article>
      <article className="panel"><div className="panel-heading"><div><p className="kicker warning">Needs attention</p><h2>At reorder point</h2></div></div><div className="attention-list">{data.lowStock.length ? data.lowStock.map((row) => <div key={String(row.id)}><span><b>{String(row.name)}</b><small>Reorder at {number.format(Number(row.reorderPoint))}</small></span><strong>{number.format(Number(row.available))}</strong></div>) : <p className="empty">No materials are below their reorder point.</p>}</div></article>
    </section>
  </main>;
}
