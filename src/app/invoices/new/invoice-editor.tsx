"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Material = { id: string; name: string; modelNumber: string | null; unit: string | null; availableQuantity: string };
type Customer = { id: string; name: string; email: string | null };
type Location = { id: string; name: string; isDefault: boolean };
type Line = { key: string; material: Material; quantity: number; unitPrice: number; discount: number };

const today = new Date().toISOString().slice(0, 10);
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("The latest data could not be loaded.");
  return response.json() as Promise<T>;
}

export function InvoiceEditor() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]); const [locationId, setLocationId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]); const [customerId, setCustomerId] = useState(""); const [customerQuery, setCustomerQuery] = useState("");
  const [materialQuery, setMaterialQuery] = useState(""); const [materials, setMaterials] = useState<Material[]>([]); const [lines, setLines] = useState<Line[]>([]);
  const [invoiceDate, setInvoiceDate] = useState(today); const [saving, setSaving] = useState(false); const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => { void getJson<{ rows: Location[] }>("/api/locations").then(({ rows }) => { setLocations(rows); setLocationId(rows.find((row) => row.isDefault)?.id ?? rows[0]?.id ?? ""); }); }, []);
  useEffect(() => { const timeout = window.setTimeout(() => { void getJson<{ rows: Customer[] }>(`/api/customers?q=${encodeURIComponent(customerQuery)}`).then(({ rows }) => setCustomers(rows)); }, 220); return () => window.clearTimeout(timeout); }, [customerQuery]);
  useEffect(() => { const timeout = window.setTimeout(() => { void getJson<{ rows: Material[] }>(`/api/materials?q=${encodeURIComponent(materialQuery)}&locationId=${encodeURIComponent(locationId)}`).then(({ rows }) => setMaterials(rows)); }, 220); return () => window.clearTimeout(timeout); }, [materialQuery, locationId]);

  const refreshAvailability = useCallback(async () => {
    if (!lines.length) return;
    const refreshed = await Promise.all(lines.map(async (line) => {
      const { rows } = await getJson<{ rows: Material[] }>(`/api/materials?q=${encodeURIComponent(line.material.name)}&locationId=${encodeURIComponent(locationId)}`);
      return rows.find((row) => row.id === line.material.id) ?? line.material;
    }));
    setLines((current) => current.map((line, index) => ({ ...line, material: refreshed[index] })));
  }, [lines, locationId]);
  useEffect(() => { const timer = window.setInterval(() => { void refreshAvailability(); }, 5000); return () => window.clearInterval(timer); }, [refreshAvailability]);

  const total = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice - line.discount, 0), [lines]);
  const addMaterial = (material: Material) => { setLines((current) => current.some((line) => line.material.id === material.id) ? current : [...current, { key: crypto.randomUUID(), material, quantity: 1, unitPrice: 0, discount: 0 }]); setMaterialQuery(""); };
  const updateLine = (key: string, patch: Partial<Pick<Line, "quantity" | "unitPrice" | "discount">>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));

  const save = async () => {
    setMessage(null);
    if (!locationId || !lines.length) { setMessage({ kind: "error", text: "Choose a location and add at least one material." }); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), customerId: customerId || null, invoiceDate, locationId, lines: lines.map((line) => ({ materialId: line.material.id, quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount })) }) });
      const result = await response.json() as { error?: string; invoiceNumber?: string };
      if (!response.ok) throw new Error(result.error ?? "Invoice could not be saved.");
      setMessage({ kind: "success", text: `${result.invoiceNumber} saved. Stock and dashboard totals were updated together.` });
      setTimeout(() => router.push("/invoices"), 900);
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "Invoice could not be saved." }); await refreshAvailability(); }
    finally { setSaving(false); }
  };

  return <section className="editor-grid">
    <div className="editor-main">
      <article className="panel form-panel"><h2>Invoice details</h2><div className="form-grid">
        <label><span>Invoice date</span><input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /></label>
        <label><span>Stock location</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Select a location</option>{locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
        <label className="wide"><span>Customer (optional)</span><input value={customerQuery} onChange={(event) => { setCustomerQuery(event.target.value); setCustomerId(""); }} placeholder="Search customers…" />{customerQuery && !customerId && <div className="suggestions">{customers.map((customer) => <button type="button" key={customer.id} onClick={() => { setCustomerId(customer.id); setCustomerQuery(customer.name); }}>{customer.name}<small>{customer.email}</small></button>)}</div>}</label>
      </div></article>
      <article className="panel form-panel"><div className="panel-heading"><div><p className="kicker">Stock-aware picker</p><h2>Materials</h2></div><small>Refreshes every 5 seconds</small></div>
        <div className="picker"><input value={materialQuery} onChange={(event) => setMaterialQuery(event.target.value)} placeholder="Search name or model number…" />{materialQuery && <div className="suggestions material-suggestions">{materials.map((material) => <button type="button" key={material.id} onClick={() => addMaterial(material)}><span><b>{material.name}</b><small>{material.modelNumber || "No model number"}</small></span><strong>{Number(material.availableQuantity).toLocaleString("en-IN")} {material.unit}</strong></button>)}</div>}</div>
        <div className="line-list">{lines.map((line) => <div className="invoice-line" key={line.key}><div className="line-name"><b>{line.material.name}</b><small>{Number(line.material.availableQuantity).toLocaleString("en-IN")} {line.material.unit} available</small></div><label><span>Quantity</span><input type="number" min="0.0001" step="any" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: Number(event.target.value) })}/></label><label><span>Unit price</span><input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.key, { unitPrice: Number(event.target.value) })}/></label><label><span>Discount</span><input type="number" min="0" step="0.01" value={line.discount} onChange={(event) => updateLine(line.key, { discount: Number(event.target.value) })}/></label><strong className="line-total">{inr.format(line.quantity * line.unitPrice - line.discount)}</strong><button className="remove" type="button" aria-label={`Remove ${line.material.name}`} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>×</button></div>)}</div>
        {!lines.length && <p className="empty">Search above to add an in-stock material.</p>}
      </article>
    </div>
    <aside className="panel summary-card"><p className="kicker">Invoice summary</p><div><span>Lines</span><strong>{lines.length}</strong></div><div className="grand-total"><span>Total</span><strong>{inr.format(total)}</strong></div>{message && <p className={`notice ${message.kind}`}>{message.text}</p>}<button className="button primary full" type="button" disabled={saving} onClick={() => void save()}>{saving ? "Locking stock & saving…" : "Save invoice"}</button><small className="safety-note">Stock is allocated FIFO. The database rejects the entire invoice if any line becomes unavailable.</small></aside>
  </section>;
}
