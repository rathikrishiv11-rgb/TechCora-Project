const milestones = [
  { label: "Foundation", state: "Complete", detail: "Application, database boundary, validation, and quality checks" },
  { label: "Data model", state: "Next", detail: "Normalize the masked export and verify every source record" },
  { label: "ERP workflows", state: "Queued", detail: "Invoices, materials, batch stock, and movement reporting" },
  { label: "Proof", state: "Queued", detail: "Concurrency demo, 10× data, measurements, and deployment" },
] as const;

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="eyebrow"><span className="pulse" /> Phase 1 ready</div>
        <h1>Stock that stays fast.<br />Numbers that stay honest.</h1>
        <p className="lede">
          StockERP is a batch-aware inventory and invoicing prototype designed to keep large reads off the browser
          and protect stock with transactional writes.
        </p>
        <div className="actions">
          <a className="primary" href="/api/health">Check system health</a>
          <a className="secondary" href="https://github.com/rathikrishiv11-rgb/TechCora-Project">View repository</a>
        </div>
      </section>

      <section className="status" aria-labelledby="delivery-title">
        <div className="section-heading">
          <div>
            <p className="kicker">Delivery map</p>
            <h2 id="delivery-title">Built for evidence, not theatre.</h2>
          </div>
          <p>The prototype will expose its data path, consistency decisions, and measured performance.</p>
        </div>
        <div className="milestone-grid">
          {milestones.map((milestone, index) => (
            <article className="milestone" key={milestone.label}>
              <div className="milestone-top">
                <span className="number">0{index + 1}</span>
                <span className={`tag tag-${milestone.state.toLowerCase()}`}>{milestone.state}</span>
              </div>
              <h3>{milestone.label}</h3>
              <p>{milestone.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
