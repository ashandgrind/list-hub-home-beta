// TV / kiosk embed widget (/listhub/embed) in a real browser against the local stack.
// Serves dist/ with the rewrites and headers from vercel.json, frames the widget from
// another origin, and takes screenshots at 1440x900, 390x844, and 1920x1080.
// Uses throwaway local tokens only and never prints token values.
// Run: node scripts/build.mjs && node tests/agent-local/verify-embed-ui.mjs
// Screenshots go to $OUT (default tests/agent-local/out).
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStack, IDS, TOKEN, ANON_JWT, memberJwt } from "./stack.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const dist = join(repo, "dist");
const OUT = process.env.OUT || join(here, "out");
mkdirSync(OUT, { recursive: true });
if (!existsSync(join(dist, "index.html"))) throw new Error("run node scripts/build.mjs first");
const PORT = Number(process.env.EMBED_UI_PORT || 4210);
const scrub = (s) => String(s).replace(/\blhe?_[A-Za-z0-9_-]{20,}/g, "[token]");

// ---- a tiny Vercel: rewrites + headers from vercel.json ----
const vercel = JSON.parse(readFileSync(join(repo, "vercel.json"), "utf8"));
const toRe = (src) => new RegExp("^" + src.replace(/:path\*/g, "(.*)") + "$");
function vercelResponse(rawUrl) {
  const path = decodeURIComponent(rawUrl.split("?")[0].split("#")[0]);
  const headers = {};
  for (const rule of vercel.headers || []) if (toRe(rule.source).test(path)) for (const h of rule.headers) headers[h.key] = h.value;
  for (const r of vercel.redirects || []) if (path === r.source) return { status: 307, headers: { ...headers, Location: r.destination } };
  let file = path;
  if (!existsSync(join(dist, file)) || file.endsWith("/")) {
    for (const r of vercel.rewrites || []) {
      const m = path.match(toRe(r.source));
      if (m) { file = r.destination.replace(":path*", m[1] || ""); break; }
    }
  }
  const abs = join(dist, file.replace(/^\/+/, ""));
  if (!file || file.endsWith("/") || !existsSync(abs)) return { status: 404, headers, body: "not found" };
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
  return { status: 200, headers: { ...headers, "Content-Type": types[extname(abs)] || "application/octet-stream" }, body: readFileSync(abs) };
}
function serve(port, mutate) {
  const srv = createServer((req, res) => {
    const r = vercelResponse(req.url || "/");
    const headers = mutate ? mutate({ ...r.headers }) : r.headers;
    res.writeHead(r.status, headers);
    res.end(r.body || "");
  });
  return new Promise((ok) => srv.listen(port, "127.0.0.1", () => ok(srv)));
}
// SITE: this repo on Vercel. PROXY: like cruxibl.com today (Next adds X-Frame-Options: SAMEORIGIN to
// everything but passes upstream headers through). BLOCKED: a negative control with XFO and no CSP.
const servers = [
  await serve(PORT),
  await serve(PORT + 1, (h) => ({ ...h, "X-Frame-Options": "SAMEORIGIN" })),
  await serve(PORT + 2, (h) => { const o = { ...h, "X-Frame-Options": "SAMEORIGIN" }; delete o["Content-Security-Policy"]; return o; }),
];
// TV dashboard on another origin (localhost vs 127.0.0.1, and another port)
const dash = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!doctype html><title>Dashboard</title><body style="margin:0;background:#111"><iframe id="w" src="${u.searchParams.get("src") || ""}" style="width:1200px;height:700px;border:0"></iframe></body>`);
});
await new Promise((r) => dash.listen(PORT + 3, "127.0.0.1", r));
const SITE = `http://127.0.0.1:${PORT}`;
const embedUrl = (token, extra = "", base = SITE) => `${base}/listhub/embed#token=${encodeURIComponent(token)}${extra}`;

const results = [];
const record = (name, ok, why = "") => results.push([name, ok ? "PASS" : "FAIL", ok ? "" : scrub(why)]);
async function step(label, fn) {
  try { await fn(); } catch (err) { record(label, false, `threw: ${String(err.message || err).split("\n")[0]}${err.cause ? " (" + String(err.cause.code || err.cause.message || err.cause) + ")" : ""}`); }
}

const ITEMS = [
  ["Bananas", "6", null], ["Baby spinach", null, null], ["Honeycrisp apples", "4", null], ["Avocados", "3", null],
  ["Whole milk", "1 gal", "costco"], ["Greek yogurt", null, null], ["Cheddar cheese", null, null], ["Eggs dozen", "2", "costco"],
  ["Sourdough bread", null, "publix"], ["Chicken thighs", "2 lb", "publix"], ["Ground coffee", null, "costco"], ["Pasta", "2", null],
  ["Marinara sauce", null, null], ["Frozen peas", null, null], ["Paper towels", "1 pack", "costco"], ["Dish soap", null, null],
  ["Trash bags", null, "costco"], ["Laundry detergent", null, null], ["Toilet paper", null, "costco"], ["Sponges", null, null],
  ["Toothpaste", null, null], ["Shampoo", null, null], ["Deodorant", null, null], ["Dog food", "30 lb", "costco"], ["Cat litter", null, null],
  ["AA batteries", null, null], ["Light bulbs", null, null], ["Sparkling water", "2 cases", "costco"], ["Granola bars", null, null], ["Olive oil", null, null],
];
function seed(s) {
  const store = { costco: IDS.costco, publix: IDS.publix };
  const values = ITEMS.map(([n, q, st], i) => `('${IDS.needs}', '${n}', 'needed', ${q ? `'${q}'` : "null"}, ${st ? `'${store[st]}'` : "null"}, 'Chris', now() - interval '${60 - i} minutes')`).join(",\n");
  s.sql(`insert into list_hub.items (list_id, name, status, qty, preferred_store_id, created_by, created_at) values ${values};
    insert into list_hub.items (list_id, name, status, discreet, created_by) values ('${IDS.needs}', 'Private item', 'needed', true, 'Chris');
    insert into list_hub.items (list_id, name, status, created_by) values ('${IDS.otherNeeds}', 'Other home item', 'needed', 'Someone');`);
}
// SQL editor path (admin): works on the branch, fails on main where the RPC doesn't exist.
const mint = (s, label, hh = IDS.household) => JSON.parse(s.sql(`select public.lh_create_embed_token('${label}', '${hh}')`));

async function newPage(browser, s, viewport, touch, session) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 });
  if (session) {
    const now = Math.floor(Date.now() / 1000);
    const value = JSON.stringify({ access_token: memberJwt("chris"), token_type: "bearer", expires_in: 86400, expires_at: now + 86400, refresh_token: "local-refresh",
      user: { id: IDS.chris, email: "chris@example.test", aud: "authenticated", role: "authenticated", user_metadata: { has_password: true }, app_metadata: {} } });
    await context.addInitScript((v) => { try { localStorage.setItem("sb-dphkvcdohqsvefbdhsfx-auth-token", v); } catch (e) {} }, value);
  }
  const seen = { urls: [], referers: [] };
  await context.route("https://dphkvcdohqsvefbdhsfx.supabase.co/**", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    seen.urls.push(req.url());
    if (req.headers().referer) seen.referers.push(req.headers().referer);
    try {
      const headers = { ...req.headers() }; delete headers.host;
      const isProdAnon = (v) => { try { const c = JSON.parse(Buffer.from(String(v).replace(/^Bearer /i, "").split(".")[1], "base64url").toString()); return c.role === "anon" && c.ref === "dphkvcdohqsvefbdhsfx"; } catch { return false; } };
      if (isProdAnon(headers.apikey)) headers.apikey = ANON_JWT;
      if (isProdAnon(headers.authorization)) headers.authorization = `Bearer ${ANON_JWT}`;
      const r = await fetch(`${s.base}${u.pathname}${u.search}`, { method: req.method(), headers, body: req.postDataBuffer() || undefined });
      const body = Buffer.from(await r.arrayBuffer());
      const h = Object.fromEntries([...r.headers].filter(([k]) => !["content-encoding", "content-length", "transfer-encoding"].includes(k)));
      await route.fulfill({ status: r.status, headers: h, body });
    } catch { await route.abort(); }
  });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("framenavigated", () => {});
  return { context, page, seen };
}
const widgetReady = (frameOrPage, timeout = 12000) =>
  frameOrPage.waitForFunction(() => document.querySelector(".e-group") || /isn.t working|missing its token|All done/.test(document.getElementById("e-msg")?.textContent || ""), null, { timeout }).then(() => true, () => false);
const msgText = (p) => p.evaluate(() => document.getElementById("e-msg")?.textContent || "").catch(() => "");

const s = await startStack({ port: Number(process.env.EMBED_UI_STACK_PORT || 54500) });
const browser = await chromium.launch();
let tok = null, revoked = null, other = null;
try {
  seed(s);
  await step("seed: mint throwaway embed tokens", async () => {
    tok = mint(s, "Living room TV").token;
    other = mint(s, "Other TV", IDS.otherHousehold).token;
    const r = mint(s, "Old tablet");
    revoked = r.token;
    s.sql(`update list_hub.embed_tokens set revoked_at = now() where id = '${r.id}'`);
    record("seed: mint throwaway embed tokens", !!(tok && other && revoked));
  });

  // ---- headers: vercel.json + what the browser gets ----
  await step("headers", async () => {
    const all = JSON.stringify(vercel.headers || []);
    record("vercel.json sets no X-Frame-Options anywhere", !/x-frame-options/i.test(all), "found X-Frame-Options");
    const r = await fetch(`${SITE}/listhub/embed`);
    const csp = r.headers.get("content-security-policy") || "";
    record("GET /listhub/embed: 200, no X-Frame-Options, CSP frame-ancestors *", r.status === 200 && !r.headers.get("x-frame-options") && /frame-ancestors \*/.test(csp),
      `status ${r.status} xfo ${r.headers.get("x-frame-options")} csp "${csp}"`);
    const body = await r.text();
    record("embed page is the widget, not the app (no sign-in UI, no supabase-js)", /id="embed"/.test(body) && !/id="gate"|supabase-js|signin/i.test(body), "wrong page body");
    const app = await fetch(`${SITE}/listhub/`);
    record("main app page keeps its old headers (no frame-ancestors added)", app.status === 200 && !app.headers.get("content-security-policy"), `app csp ${app.headers.get("content-security-policy")}`);
  });

  // ---- three viewports with screenshots ----
  for (const [tag, viewport, touch, extra] of [["desktop", { width: 1440, height: 900 }, false, ""], ["phone", { width: 390, height: 844 }, true, ""], ["tv", { width: 1920, height: 1080 }, false, "&refresh=60"]]) {
    await step(`${tag}: renders`, async () => {
      const { context, page, seen } = await newPage(browser, s, viewport, touch, false);
      await page.goto(embedUrl(tok, extra), { waitUntil: "domcontentloaded" });
      const ready = await widgetReady(page);
      const info = await page.evaluate(() => ({
        path: location.pathname,
        sections: [...document.querySelectorAll(".e-group")].map((g) => g.dataset.section),
        subs: [...document.querySelectorAll(".e-sub")].map((x) => x.textContent),
        names: [...document.querySelectorAll(".e-name")].map((x) => x.textContent),
        title: document.getElementById("e-title").textContent,
        lefts: [...new Set([...document.querySelectorAll(".e-item")].map((g) => Math.round(g.getBoundingClientRect().left)))].length,
        fs: parseFloat(getComputedStyle(document.querySelector(".e-name") || document.body).fontSize),
        gate: !!document.getElementById("gate"),
        bg: getComputedStyle(document.body).backgroundColor,
      }));
      const order = ["Food", "Household", "Personal Care", "Pets"].filter((x) => info.sections.includes(x));
      const inOrder = order.every((x, i) => i === 0 || info.sections.indexOf(x) > info.sections.indexOf(order[i - 1]));
      record(`${tag}: valid token renders the List grouped by section and subsection (no sign-in, no redirect)`,
        ready && info.path === "/listhub/embed" && !info.gate && info.sections.length >= 4 && info.subs.length >= 3 && inOrder && info.names.includes("Bananas") && info.names.length === ITEMS.length + 1 /* + seeded Eggs */,
        `ready ${ready} path ${info.path} sections ${info.sections} subs ${info.subs.length} names ${info.names.length}`);
      record(`${tag}: discreet and other-household items stay off`, !info.names.includes("Private item") && !info.names.includes("Other home item"), "leaked");
      record(`${tag}: title is the household List`, info.title === "Test Home List", `title ${info.title}`);
      record(`${tag}: token never leaves in a URL or Referer`, !seen.urls.some((u) => u.includes("lhe_")) && seen.referers.length === 0, `urls ${seen.urls.length} referers ${seen.referers.length}`);
      if (tag === "tv") {
        record("tv: large type and dark background", info.fs >= 26 && /rgb\(5, 7, 10\)/.test(info.bg), `font ${info.fs}px bg ${info.bg}`);
        record("tv: long list flows into several columns (columns=auto)", info.lefts >= 3, `distinct column lefts ${info.lefts}`);
      }
      if (tag === "phone") record("phone: one column", info.lefts === 1, `lefts ${info.lefts}`);
      record(`${tag}: no page errors`, page.errors.length === 0, page.errors.join(" | "));
      await page.screenshot({ path: join(OUT, `embed-${tag}-${viewport.width}x${viewport.height}.png`) });
      await context.close();
    });
  }

  // ---- refused tokens show a plain message ----
  await step("refused tokens", async () => {
    const { context, page } = await newPage(browser, s, { width: 1440, height: 900 }, false, false);
    const cases = [["invalid token", "lhe_" + "x".repeat(43)], ["revoked token", revoked], ["agent token used as an embed token", TOKEN]];
    for (const [what, t] of cases) {
      await page.goto("about:blank");
      await page.goto(embedUrl(t), { waitUntil: "domcontentloaded" });
      await widgetReady(page);
      const m = await msgText(page);
      const groups = await page.locator(".e-group").count();
      record(`${what} is refused with a plain message`, /isn't working/.test(m) && groups === 0, `msg "${m}" groups ${groups}`);
      if (what === "revoked token") await page.screenshot({ path: join(OUT, "embed-invalid-1440x900.png") });
    }
    await page.goto("about:blank");
    await page.goto(`${SITE}/listhub/embed`, { waitUntil: "domcontentloaded" });
    await widgetReady(page);
    record("missing token shows a plain message", /missing its token/.test(await msgText(page)), await msgText(page));
    const all = await page.evaluate(() => document.body.innerText);
    record("widget copy has no em dashes", !all.includes("\u2014"), "em dash in UI");
    await context.close();
  });

  // ---- framed from another origin ----
  await step("iframe", async () => {
    const { context, page } = await newPage(browser, s, { width: 1300, height: 800 }, false, false);
    const tryFrame = async (base) => {
      await page.goto(`http://localhost:${PORT + 3}/?src=${encodeURIComponent(embedUrl(tok, "", base))}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);
      const f = page.frames().find((fr) => fr.url().includes("/listhub/embed"));
      if (!f) return false;
      return f.waitForSelector(".e-group", { timeout: 6000 }).then(() => true, () => false);
    };
    record("cross-origin iframe renders the widget (this repo's headers)", await tryFrame(SITE), "frame did not render");
    await page.screenshot({ path: join(OUT, "embed-iframe-dashboard.png") });
    record("cross-origin iframe still renders behind a proxy that adds X-Frame-Options: SAMEORIGIN (CSP frame-ancestors wins)", await tryFrame(`http://127.0.0.1:${PORT + 1}`), "frame blocked");
    record("control: XFO SAMEORIGIN without the CSP is blocked (the check can see a frame block)", !(await tryFrame(`http://127.0.0.1:${PORT + 2}`)), "frame was not blocked");
    await context.close();
  });

  // ---- options + polling ----
  await step("options", async () => {
    const { context, page } = await newPage(browser, s, { width: 1440, height: 900 }, false, false);
    await page.goto(embedUrl(tok, "&theme=light&columns=2&store=Costco&refresh=5"), { waitUntil: "domcontentloaded" });
    await widgetReady(page);
    const o = await page.evaluate(() => ({
      cls: document.body.className, cols: document.getElementById("e-list").style.columnCount, p: window.__lhEmbed && window.__lhEmbed.params,
      stores: [...document.querySelectorAll(".e-store")].length, names: [...document.querySelectorAll(".e-name")].map((x) => x.textContent),
    }));
    const costco = ITEMS.filter((i) => i[2] === "costco").map((i) => i[0]).sort().join(",");
    record("theme=light, columns=2, store=Costco apply; refresh clamps to at least 15s", o.cls === "theme-light" && o.cols === "2" && o.p.refresh === 15 && o.names.slice().sort().join(",") === costco,
      `cls ${o.cls} cols ${o.cols} refresh ${o.p && o.p.refresh} names ${o.names}`);
    await page.screenshot({ path: join(OUT, "embed-light-costco-1440x900.png") });
    await context.close();

    const c2 = await newPage(browser, s, { width: 1440, height: 900 }, false, false);
    await c2.context.clock.install();
    await c2.page.goto(embedUrl(tok, "&refresh=20"), { waitUntil: "domcontentloaded" });
    await widgetReady(c2.page);
    s.sql(`insert into list_hub.items (list_id, name, status, category, created_by) values ('${IDS.needs}', 'Lemons', 'needed', 'Food', 'Ellen')`);
    await c2.page.clock.fastForward(21000);
    const got = await c2.page.waitForFunction(() => [...document.querySelectorAll(".e-name")].some((x) => x.textContent === "Lemons"), null, { timeout: 8000 }).then(() => true, () => false);
    record("auto-refresh polls (refresh=20) and shows a newly added item", got, "new item never showed");
    await c2.context.close();
  });

  // ---- Menu > TV and embed (create, copy link, revoke) ----
  await step("menu", async () => {
    const { context, page } = await newPage(browser, s, { width: 390, height: 844 }, true, true);
    await page.goto(`${SITE}/listhub/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => { const a = document.getElementById("app"); return a && !a.classList.contains("hidden"); }, null, { timeout: 20000 });
    await page.locator("#menu-btn").tap();
    const sec = page.locator("#sheet #embed-sec");
    await sec.waitFor({ timeout: 8000 });
    record("Menu has a TV and embed section", await sec.isVisible(), "no #embed-sec");
    await page.locator("#embed-token-label").scrollIntoViewIfNeeded();
    await page.locator("#embed-token-label").tap();
    await page.keyboard.type("Hall tablet");
    await page.locator("#embed-create-btn").tap();
    const fresh = page.locator("#embed-fresh-url");
    await fresh.waitFor({ timeout: 8000 });
    const link = await fresh.inputValue();
    record("Create link shows a one-time /listhub/embed#token=lhe_ link", /^http:\/\/127\.0\.0\.1:\d+\/listhub\/embed#token=lhe_[A-Za-z0-9_-]{40,}$/.test(link), `link shape ${scrub(link)}`);
    await fresh.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(OUT, "embed-menu-390x844.png"), mask: [fresh] });
    const w = await context.newPage();
    await w.goto(link, { waitUntil: "domcontentloaded" });
    record("the Menu link opens the widget", await widgetReady(w) && (await w.locator(".e-group").count()) > 0, "widget did not render");
    const row = page.locator("#sheet [data-embed-revoke]").first();
    const n0 = await page.locator("#sheet [data-embed-revoke]").count();
    const hallId = s.sql(`select id from list_hub.embed_tokens where label='Hall tablet'`);
    await page.locator(`#sheet [data-embed-revoke="${hallId}"]`).scrollIntoViewIfNeeded();
    await page.locator(`#sheet [data-embed-revoke="${hallId}"]`).tap();
    await page.waitForFunction((id) => !document.querySelector(`#sheet [data-embed-revoke="${id}"]`), hallId, { timeout: 8000 }).catch(() => {});
    const n1 = await page.locator("#sheet [data-embed-revoke]").count();
    record("Revoke removes it from the Menu", n1 === n0 - 1 && !(await page.locator("#embed-fresh-url").count()), `rows ${n0} -> ${n1}`);
    await w.evaluate(() => window.__lhEmbed.reload());
    const gone = await w.waitForFunction(() => /isn.t working/.test(document.getElementById("e-msg").textContent), null, { timeout: 8000 }).then(() => true, () => false);
    record("an open widget shows the plain message once its link is revoked", gone, "still rendering");
    record("Menu: no page errors", page.errors.length === 0, page.errors.join(" | "));
    void row;
    await context.close();
  });
} finally {
  await browser.close();
  await s.stop();
  for (const srv of servers) srv.close();
  dash.close();
}
let failed = 0;
for (const [name, status, why] of results) {
  if (status === "FAIL") failed++;
  console.log(`${status}  ${name}${why ? `\n      ${why}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed; screenshots in ${OUT}`);
process.exit(failed || !results.length ? 1 : 0);
