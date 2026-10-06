import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StockERP",
    template: "%s | StockERP",
  },
  description: "A responsive, transaction-safe ERP prototype for batch-based inventory.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <Link className="brand" href="/"><span>SE</span> StockERP</Link>
          <nav aria-label="Main navigation">
            <Link href="/">Dashboard</Link>
            <Link href="/invoices">Invoices</Link>
            <Link href="/invoices/new">New invoice</Link>
            <Link href="/movements">Movements</Link>
          </nav>
          <span className="live-indicator"><i /> Live inventory</span>
        </header>
        {children}
      </body>
    </html>
  );
}
