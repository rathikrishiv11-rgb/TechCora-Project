import { InvoiceEditor } from "./invoice-editor";

export default function NewInvoicePage() {
  return <main className="app-main"><section className="page-intro compact"><div><p className="kicker">Atomic stock issue</p><h1>Create invoice</h1><p>Availability is rechecked and locked when you save. Stale tabs cannot oversell.</p></div></section><InvoiceEditor /></main>;
}
