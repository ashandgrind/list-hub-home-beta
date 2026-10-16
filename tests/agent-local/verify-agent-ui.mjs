// App UI against the local stack (real PostgREST + real edge function), driven with
// real mouse / touch events. Checks token labels on items, inline label rename, and
// the agent instructions text. Writes screenshots to $OUT (default tests/agent-local/out).
// Run: node scripts/build.mjs && node tests/agent-local/verify-agent-ui.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStack, TOKEN, IDS, memberJwt, HOUSEHOLD_NAME } from "./stack.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "..", "dist");
const OUT = process.env.OUT || join(here, "out");
mkdirSync(OUT, { recursive: true });
if (!existsSync(join(dist, "index.html"))) throw new Error("run node scripts/build.mjs first");

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const site = createServer((req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url.startsWith("/listhub/")) url = url.slice("/listhub".length) || "/";
  if (url === "/") url = "/index.html";
  const file = join(dist, url.replace(/^\/+/, ""));
  if (!existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((r) => site.listen(4188, "127.0.0.1", r));

const results = [];
const record = (name, ok, why = "") => results.push([name, ok ? "PASS" : "FAIL", ok ? "" : why]);

async function tapOrClick(page, locator, touch) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function run(tag, viewport, touch, newLabel) {
  const s = await startStack({ port: touch ? 54420 : 54410 });
  const browser = await chromium.launch();
  try {
    // An agent adds an item through the real API (so it is stamped the way production will be).
    const add = await fetch(`${s.apiBase}/items`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "beef jerky", quantity: "2", store: "Publix" }),
    }).then((r) => r.json());
    const itemId = add.item && add.item.id;

    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 });
    const jwt = memberJwt("chris");
    const now = Math.floor(Date.now() / 1000);
    const session = {
      access_token: jwt, token_type: "bearer", expires_in: 86400, expires_at: now + 86400, refresh_token: "local-refresh",
      user: { id: IDS.chris, email: "chris@example.test", aud: "authenticated", role: "authenticated", user_metadata: { has_password: true }, app_metadata: {} },
    };
    await context.addInitScript((value) => {
      try { localStorage.setItem("sb-dphkvcdohqsvefbdhsfx-auth-token", value); } catch (e) {}
    }, JSON.stringify(session));
    await context.route("https://dphkvcdohqsvefbdhsfx.supabase.co/**", async (route) => {
      const req = route.request();
      const u = new URL(req.url());
      try {
        const headers = { ...req.headers() };
        delete headers.host;
        const r = await fetch(`${s.base}${u.pathname}${u.search}`, { method: req.method(), headers, body: req.postDataBuffer() || undefined });
        const body = Buffer.from(await r.arrayBuffer());
        const h = Object.fromEntries([...r.headers].filter(([k]) => !["content-encoding", "content-length", "transfer-encoding"].includes(k)));
        await route.fulfill({ status: r.status, headers: h, body });
      } catch (err) {
        console.error("route error", req.method(), u.pathname, String(err));
        await route.abort();
      }
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    const badResponses = [];
    page.on("response", (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });
    page.on("requestfailed", (r) => badResponses.push(`FAILED ${r.method()} ${r.url()} ${r.failure() && r.failure().errorText}`));

    await page.goto("http://127.0.0.1:4188/listhub/", { waitUntil: "domcontentloaded" });
    try {
      await page.waitForFunction(() => {
        const app = document.getElementById("app");
        return app && !app.classList.contains("hidden") && document.querySelector("#items .item");
      }, null, { timeout: 20000 });
    } catch (err) {
      const dump = await page.evaluate(() => ({
        view: window.__lh && window.__lh.S && window.__lh.S.view,
        events: window.__lh && window.__lh.events,
        gate: (document.getElementById("gate-error") || {}).textContent,
        status: (document.getElementById("status") || {}).textContent,
      })).catch((e) => String(e));
      console.error(tag, "app did not load", JSON.stringify(dump), pageErrors, badResponses.slice(0, 10));
      throw err;
    }

    const badgeOf = async () => page.evaluate((id) => {
      const el = document.querySelector(`#items .item[data-id="${id}"] .badge.who`);
      return el ? el.textContent.trim() : "";
    }, itemId);
    await page.waitForFunction((id) => !!document.querySelector(`#items .item[data-id="${id}"] .badge.who`), itemId, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    const before = await badgeOf();
    record(`${tag}: item added by the "house" token shows "House"`, before === "House", `badge is "${before}"`);
    await page.locator(`#items .item[data-id="${itemId}"]`).scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: join(OUT, `${tag}-01-item-token-label.png`) });

    await tapOrClick(page, page.locator("#menu-btn"), touch);
    const label = page.locator(`#sheet [data-label-edit="${IDS.token}"]`);
    const hasLabel = await label.waitFor({ timeout: 6000 }).then(() => true, () => false);
    record(`${tag}: Menu > AI agents shows the token label as an editable button`, hasLabel, "no [data-label-edit] button");

    const text = await page.locator("#agent-instructions").inputValue().catch(() => "");
    const textChecks = [
      ["mentions add (POST /items)", /POST \S+\/items\n/.test(text)],
      ["mentions remove (POST /items/{id}/remove)", text.includes("/items/{id}/remove")],
      ["mentions status", text.includes("/items/{id}/status")],
      ["add documents quantity, store and note", /"quantity"/.test(text) && /"store"/.test(text) && /"note"/.test(text)],
      ["uses the household name from data", text.includes(HOUSEHOLD_NAME)],
      ["rule: check the list before adding", /check the list before adding/i.test(text)],
      ["rule: confirm before removing more than one item", /confirm .*before removing more than one item/i.test(text)],
      ["no em dash", text.length > 0 && !text.includes("\u2014")],
      ["no arrows", text.length > 0 && !/[\u2190-\u21FF]/.test(text)],
      ["no hardcoded Pollock", text.length > 0 && !/Pollock/.test(text)],
    ];
    for (const [n, ok] of textChecks) record(`${tag}: agent text ${n}`, ok, ok ? "" : `text starts "${text.slice(0, 90).replace(/\n/g, " ")}"`);
    if (hasLabel) await label.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(OUT, `${tag}-02-ai-agents-menu.png`) });

    if (hasLabel) {
      await tapOrClick(page, label, touch);
      const input = page.locator("#sheet .agent-label-input");
      const editing = await input.waitFor({ timeout: 4000 }).then(() => true, () => false);
      record(`${tag}: tapping the label opens an inline editor`, editing, "no inline input");
      if (editing) {
        await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains("agent-label-input"), null, { timeout: 3000 }).catch(() => {});
        await page.keyboard.press("ControlOrMeta+A");
        await page.keyboard.type(newLabel);
        await page.screenshot({ path: join(OUT, `${tag}-03-inline-label-edit.png`) });
        await tapOrClick(page, page.locator("#sheet .agent-label-form button[type=submit]"), touch);
        const saved = await page.waitForFunction((want) => {
          const b = document.querySelector("#sheet [data-label-edit]");
          return b && b.textContent.replace("\u270e", "").trim() === want;
        }, newLabel.replace(/\b([a-z])/g, (c) => c.toUpperCase()), { timeout: 6000 }).then(() => true, () => false);
        record(`${tag}: saved label shows in the menu`, saved, "label button did not update");
        await page.screenshot({ path: join(OUT, `${tag}-04-label-saved.png`) });
        const dbLabel = s.sql(`select label from list_hub.agent_tokens where id = '${IDS.token}'`);
        record(`${tag}: label saved in the database`, dbLabel === newLabel, `db label "${dbLabel}"`);
      }
    }

    const close = page.locator("#sheet [data-close]").first();
    if (await close.count()) await tapOrClick(page, close, touch);
    await page.waitForTimeout(400);
    const after = await badgeOf();
    const want = newLabel.replace(/\b([a-z])/g, (c) => c.toUpperCase());
    record(`${tag}: the existing item now shows the renamed label "${want}"`, after === want, `badge is "${after}"`);
    await page.locator(`#items .item[data-id="${itemId}"]`).scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: join(OUT, `${tag}-05-item-renamed-label.png`) });
    record(`${tag}: no page errors`, pageErrors.length === 0, pageErrors.join(" | ").slice(0, 200));
    await context.close();
  } finally {
    await browser.close();
    await s.stop();
  }
}

try {
  await run("desktop-1440x900", { width: 1440, height: 900 }, false, "kitchen tablet");
  await run("mobile-390x844", { width: 390, height: 844 }, true, "kitchen tablet");
} finally {
  site.close();
}
let failed = 0;
for (const [name, status, why] of results) {
  if (status === "FAIL") failed++;
  console.log(`${status}  ${name}${why ? `\n      ${why}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed; screenshots in ${OUT}`);
process.exit(failed ? 1 : 0);
