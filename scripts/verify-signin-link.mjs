// "Email me a sign-in link": success shows a clear "Check your email" card in place of
// the form, and a failed request shows its error. Real mouse (1440x900) and touch
// (390x844) in Chromium. Supabase is stubbed in the page: no email is sent.
// Run: node scripts/build.mjs && node scripts/verify-signin-link.mjs   (OUT=dir for screenshots)
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium } from "playwright";

const dist = "dist";
const OUT = process.env.OUT || "tests/agent-local/out";
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
await new Promise((r) => site.listen(4191, "127.0.0.1", r));
const APP = "http://127.0.0.1:4191/listhub/";
const EMAIL = "member@example.test";

const results = [];
const record = (name, ok, why = "") => results.push([name, ok ? "PASS" : "FAIL", ok ? "" : why]);

async function tapOrClick(page, sel, touch) {
  const loc = page.locator(sel).first();
  await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
  const box = await loc.boundingBox({ timeout: 5000 });
  if (!box) throw new Error(`${sel} has no box`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}
const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const text = (page, sel) => page.locator(sel).first().innerText().catch(() => "");

async function run(tag, viewport, touch) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 });
  const state = { otp: "ok", otpCalls: 0 };
  await context.route("https://dphkvcdohqsvefbdhsfx.supabase.co/**", async (route) => {
    const u = new URL(route.request().url());
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) });
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" } });
    if (u.pathname.endsWith("/rpc/lh_auth_hint")) return json(200, { member: true, invited: false, account: true, password_set: false });
    if (u.pathname.endsWith("/auth/v1/otp")) {
      state.otpCalls++;
      await new Promise((r) => setTimeout(r, 700));
      return state.otp === "ok" ? json(200, {}) : json(500, { code: 500, error_code: "unexpected_failure", msg: "Error sending magic link email" });
    }
    return json(200, {});
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    await page.goto(APP, { waitUntil: "domcontentloaded" });
    await page.locator("#login-email").waitFor({ state: "visible", timeout: 15000 });

    // Success
    await tapOrClick(page, "#login-email", touch);
    await page.keyboard.type(EMAIL);
    await tapOrClick(page, "#magic-btn", touch);
    await page.waitForTimeout(250);
    const busy = await text(page, "#magic-btn");
    record(`${tag}: button shows Sending… while the request is in flight`, /Sending/.test(busy), `button says "${busy}"`);
    await page.waitForFunction(() => { const s = document.getElementById("magic-sent"); const i = document.getElementById("gate-info"); return (s && !s.classList.contains("hidden")) || (i && !i.classList.contains("hidden")); }, null, { timeout: 8000 }).catch(() => {});
    const sent = await text(page, "#magic-sent");
    record(`${tag}: success shows "Check your email for a sign-in link."`, (await visible(page, "#magic-sent")) && /Check your email for a sign-in link\./.test(sent), `magic-sent "${sent}" gate-info "${await text(page, "#gate-info")}"`);
    record(`${tag}: success card names the email`, sent.includes(EMAIL), `card "${sent}"`);
    const formGone = !(await visible(page, "#login-email")) && !(await visible(page, "#magic-btn"));
    record(`${tag}: the email form is replaced, not left as is`, formGone, "email field or send button still visible");
    record(`${tag}: no error shown on success`, !(await visible(page, "#gate-error")), `error "${await text(page, "#gate-error")}"`);
    await page.screenshot({ path: join(OUT, `signin-${tag}-01-sent.png`) });

    // Back to the form
    await tapOrClick(page, "#magic-again", touch).catch(() => {});
    record(`${tag}: "Use a different email" brings the form back`, (await visible(page, "#login-email")) && (await visible(page, "#magic-btn")) && !(await visible(page, "#magic-sent")), "form not restored");

    // Failure
    state.otp = "fail";
    await tapOrClick(page, "#magic-btn", touch).catch(() => {});
    await page.waitForFunction(() => { const e = document.getElementById("gate-error"); return e && !e.classList.contains("hidden"); }, null, { timeout: 8000 }).catch(() => {});
    const err = await text(page, "#gate-error");
    record(`${tag}: failure shows the error text`, (await visible(page, "#gate-error")) && /Couldn’t send the sign-in link/.test(err) && /Error sending magic link email/.test(err), `error "${err}"`);
    record(`${tag}: failure keeps the form and no success card`, (await visible(page, "#magic-btn")) && !(await visible(page, "#magic-sent")), "form hidden or success card shown");
    const btn = await text(page, "#magic-btn");
    record(`${tag}: button is usable again after a failure`, /Email me a sign-in link/.test(btn) && (await page.locator("#magic-btn").isEnabled()), `button "${btn}"`);
    await page.screenshot({ path: join(OUT, `signin-${tag}-02-error.png`) });
    record(`${tag}: two sign-in requests made, no page errors`, state.otpCalls === 2 && errors.length === 0, `otp calls ${state.otpCalls}, errors ${errors.join(" | ")}`);
  } catch (e) {
    record(`${tag}: run completed`, false, String(e.message || e).split("\n")[0]);
  } finally {
    await browser.close();
  }
}

await run("desktop-1440x900", { width: 1440, height: 900 }, false);
await run("mobile-390x844", { width: 390, height: 844 }, true);
site.close();
for (const [n, s, w] of results) console.log(`${s}  ${n}${w ? `  (${w})` : ""}`);
const failed = results.filter((r) => r[1] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} passed; screenshots in ${OUT}`);
process.exit(failed ? 1 : 0);
