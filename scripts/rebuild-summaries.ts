import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 20 });
try {
  const result = await sql.begin(async (tx) => {
    await tx`delete from dashboard_daily_summary`;
    await tx`
      insert into dashboard_daily_summary (day, invoice_count, revenue, cost_of_goods_sold, gross_profit, updated_at)
      select i.invoice_date, count(*)::integer, sum(i.total),
             coalesce(sum(costs.cogs), 0), sum(i.total) - coalesce(sum(costs.cogs), 0), now()
      from invoices i
      left join (
        select il.invoice_id, sum(a.quantity * a.unit_cost) as cogs
        from invoice_lines il
        join invoice_batch_allocations a on a.invoice_line_id = il.id
        group by il.invoice_id
      ) costs on costs.invoice_id = i.id
      group by i.invoice_date
    `;
    const rows = await tx`select count(*)::integer as days, sum(invoice_count)::integer as invoices from dashboard_daily_summary`;
    return rows[0];
  });
  console.log(JSON.stringify(result));
} finally {
  await sql.end();
}
