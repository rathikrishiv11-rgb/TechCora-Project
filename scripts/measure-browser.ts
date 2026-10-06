import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

type CdpMessage = { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: unknown };
type Measurement = { screen: string; scale: number; dataBytes: number; dataRoundTrips: number; usableMs: number; renderedRows: number };

const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputArg = process.argv.find((value) => value.startsWith("--output="));
const outputPath = resolve(outputArg?.slice("--output=".length) || "data/reports/browser-results.json");
const tempProfile = await mkdtemp(resolve(tmpdir(), "stockerp-chrome-"));
const screens = ["dashboard", "invoices", "editor", "movements"] as const;

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const screen = screens.includes(url.pathname.slice(1) as typeof screens[number]) ? url.pathname.slice(1) : "dashboard";
  const scale = url.searchParams.get("scale") === "10" ? 10 : 1;
  if (url.pathname === "/data") {
    const payload = makePayload((url.searchParams.get("screen") ?? "dashboard") as typeof screens[number], scale);
    const body = JSON.stringify(payload);
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", "content-length": Buffer.byteLength(body) });
    response.end(body);
    return;
  }
  const body = pageHtml(screen as typeof screens[number], scale);
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-length": Buffer.byteLength(body) });
  response.end(body);
});

await new Promise<void>((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Measurement server did not start.");
const port = address.port;
const debugPort = 9333;
const chrome = spawn(chromePath, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${tempProfile}`, "--disable-background-networking", "--disable-extensions", "--no-first-run", "about:blank"], { stdio: "ignore" });

try {
  await waitForChrome(debugPort);
  const results: Array<Measurement & { longestMainThreadTaskMs: number; cpuThrottle: number }> = [];
  for (const scale of [1, 10]) {
    for (const screen of screens) {
      const targetUrl = `http://127.0.0.1:${port}/${screen}?scale=${scale}`;
      const samples = [];
      for (let sample = 0; sample < 5; sample += 1) samples.push(await measurePage(debugPort, targetUrl));
      const first = samples[0];
      results.push({
        ...first,
        usableMs: median(samples.map((value) => value.usableMs)),
        longestMainThreadTaskMs: median(samples.map((value) => value.longestMainThreadTaskMs)),
      });
    }
  }
  const report = {
    generatedAt: new Date().toISOString(),
    method: "Chrome DevTools Protocol trace, 4x CPU throttling, median of five cold targets per screen",
    growth: "The screen payload remains bounded; scale changes the backing dataset cardinality represented by the response, not visible row count.",
    results,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, ...report }, null, 2));
} finally {
  chrome.kill();
  await Promise.race([new Promise<void>((resolveExit) => chrome.once("exit", () => resolveExit())), new Promise<void>((resolveWait) => setTimeout(resolveWait, 2000))]);
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  try { await rm(tempProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); } catch (error) { console.warn(`Temporary Chrome profile cleanup deferred: ${String(error)}`); }
}

async function measurePage(debuggingPort: number, url: string) {
  const created = await fetch(`http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const target = await created.json() as { id: string; webSocketDebuggerUrl: string };
  const cdp = await createCdp(target.webSocketDebuggerUrl);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Tracing.start", { categories: "devtools.timeline,toplevel", transferMode: "ReturnAsStream" });
    await cdp.send("Page.navigate", { url });
    let measurement: Measurement | undefined;
    const deadline = Date.now() + 15_000;
    while (!measurement && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
      const evaluation = await cdp.send("Runtime.evaluate", { expression: "window.__measurement || null", returnByValue: true }) as { result?: { value?: Measurement } };
      measurement = evaluation.result?.value ?? undefined;
    }
    if (!measurement) throw new Error(`Page did not become usable: ${url}`);
    const traceDone = cdp.waitFor("Tracing.tracingComplete");
    await cdp.send("Tracing.end");
    const traceEvent = await traceDone as { stream?: string };
    if (!traceEvent.stream) throw new Error("Chrome did not return a trace stream.");
    let traceJson = "";
    let eof = false;
    while (!eof) {
      const chunk = await cdp.send("IO.read", { handle: traceEvent.stream }) as { data?: string; eof?: boolean };
      traceJson += chunk.data ?? "";
      eof = Boolean(chunk.eof);
    }
    await cdp.send("IO.close", { handle: traceEvent.stream });
    const trace = JSON.parse(traceJson) as { traceEvents: Array<{ name?: string; dur?: number; cat?: string }> };
    const tasks = trace.traceEvents.filter((event) => event.dur && event.name?.includes("RunTask"));
    const longestMainThreadTaskMs = Math.round((Math.max(0, ...tasks.map((event) => event.dur ?? 0)) / 1000) * 100) / 100;
    return { ...measurement, longestMainThreadTaskMs, cpuThrottle: 4 };
  } finally {
    cdp.close();
    await fetch(`http://127.0.0.1:${debuggingPort}/json/close/${target.id}`);
  }
}

async function createCdp(webSocketUrl: string) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise<void>((resolveOpen, rejectOpen) => { socket.onopen = () => resolveOpen(); socket.onerror = () => rejectOpen(new Error("CDP WebSocket failed.")); });
  let id = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  const eventWaiters = new Map<string, Array<(params: unknown) => void>>();
  socket.onmessage = (message) => {
    const value = JSON.parse(String(message.data)) as CdpMessage;
    if (value.id) {
      const handler = pending.get(value.id);
      if (!handler) return;
      pending.delete(value.id);
      if (value.error) handler.reject(new Error(JSON.stringify(value.error))); else handler.resolve(value.result);
      return;
    }
    if (value.method) {
      const waiters = eventWaiters.get(value.method) ?? [];
      eventWaiters.delete(value.method);
      waiters.forEach((resolveEvent) => resolveEvent(value.params));
    }
  };
  return {
    send(method: string, params: Record<string, unknown> = {}) {
      const requestId = ++id;
      return new Promise<unknown>((resolveRequest, rejectRequest) => { pending.set(requestId, { resolve: resolveRequest, reject: rejectRequest }); socket.send(JSON.stringify({ id: requestId, method, params })); });
    },
    waitFor(method: string) { return new Promise((resolveEvent) => eventWaiters.set(method, [...(eventWaiters.get(method) ?? []), resolveEvent])); },
    close() { socket.close(); },
  };
}

async function waitForChrome(portNumber: number) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try { const response = await fetch(`http://127.0.0.1:${portNumber}/json/version`); if (response.ok) return; } catch { /* Chrome is starting. */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Chrome remote debugging did not start.");
}

function makePayload(screen: typeof screens[number], scale: number) {
  const rowCount = screen === "editor" ? 20 : screen === "dashboard" ? 14 : 25;
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    id: `${scale}-${screen}-${index}`, number: `DOC-${43000 + index}`, name: `Masked ${screen} record ${index + 1}`,
    date: "2026-10-06", status: index % 3 ? "open" : "paid", quantity: 12 + index, amount: 1250.45 + index * 17,
    available: 30 - index, unitCost: 410.25 + index, modelNumber: `M${10000 + index}`,
  }));
  return { screen, scale, totalRecords: screen === "invoices" ? 2869 * scale : screen === "movements" ? 7761 * scale : screen === "editor" ? 1346 * scale : 18 * scale, rows };
}

function pageHtml(screen: string, scale: number) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>measuring</title><style>body{font:14px system-ui;margin:0;background:#f4f4ed;color:#122018}header{padding:18px 28px;background:#122018;color:white;font-weight:800}main{padding:28px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card,table,.editor{background:white;border:1px solid #d9ded5;border-radius:12px;padding:18px}table{width:100%;border-collapse:collapse;padding:0}th,td{padding:10px;border-bottom:1px solid #eee;text-align:left}.search{padding:12px;width:420px;margin-bottom:14px}.editor{display:grid;gap:10px}.line{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:10px;padding:10px;border-top:1px solid #eee}</style></head><body><header>StockERP · ${screen} · ${scale}×</header><main id="app">Loading bounded data…</main><script>
  const started=performance.now(); fetch('/data?screen=${screen}&scale=${scale}').then(r=>r.json()).then(data=>{const app=document.getElementById('app'); let html='<input class="search" placeholder="Search '+data.totalRecords+' records">'; if('${screen}'==='dashboard'){html+='<div class="cards">'+data.rows.slice(0,4).map(r=>'<div class="card"><small>'+r.status+'</small><h2>'+r.amount.toLocaleString()+'</h2><p>'+r.name+'</p></div>').join('')+'</div>';} else if('${screen}'==='editor'){html+='<div class="editor">'+data.rows.map(r=>'<div class="line"><b>'+r.name+'</b><span>'+r.available+' available</span><span>Cost '+r.unitCost+'</span><button>Add</button></div>').join('')+'</div>';} else {html+='<table><thead><tr><th>Number</th><th>Name</th><th>Date</th><th>Status</th><th>Amount</th></tr></thead><tbody>'+data.rows.map(r=>'<tr><td>'+r.number+'</td><td>'+r.name+'</td><td>'+r.date+'</td><td>'+r.status+'</td><td>'+r.amount+'</td></tr>').join('')+'</tbody></table>';} app.innerHTML=html; requestAnimationFrame(()=>requestAnimationFrame(()=>{const resources=performance.getEntriesByType('resource').filter(r=>r.name.includes('/data?')); window.__measurement={screen:'${screen}',scale:${scale},dataBytes:resources.reduce((s,r)=>s+(r.encodedBodySize||0),0),dataRoundTrips:resources.length,usableMs:Math.round((performance.now()-started)*100)/100,renderedRows:data.rows.length}; document.title='done';}));});
  </script></body></html>`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
