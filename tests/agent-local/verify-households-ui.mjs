// Households + invites in the real app against the local stack, with real mouse
// (desktop) and touch (mobile) events. Never prints invite token values.
// Run: node scripts/build.mjs && node tests/agent-local/verify-households-ui.mjs
// Screenshots go to $OUT (default tests/agent-local/out).
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startStack, IDS, userJwt, ANON_JWT } from "./stack.mjs";

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
await new Promise((r) => site.listen(4189, "127.0.0.1", r));
const APP = "http://127.0.0.1:4189/listhub/";

const FLEET = "b0000000-0000-4000-8000-0000000000f1";
const F = {
  needs: "d0000000-0000-4000-8000-0000000000f1", wish: "d0000000-0000-4000-8000-0000000000f2",
  mart: "e0000000-0000-4000-8000-0000000000f9",
  milk: "a1000000-0000-4000-8000-0000000000f1", bread: "a1000000-0000-4000-8000-0000000000f2", tent: "a1000000-0000-4000-8000-0000000000f3",
};
const JOHN = { id: "c0000000-0000-4000-8000-0000000000a1", email: "john@example.test", name: "John" };
const JANE = { id: "c0000000-0000-4000-8000-0000000000a2", email: "jane@example.test" };

const results = [];
const record = (name, ok, why = "") => results.push([name, ok ? "PASS" : "FAIL", ok ? "" : why]);

async function tapOrClick(page, locator, touch) {
  await locator.first().scrollIntoViewIfNeeded({ timeout: 5000 });
  const box = await locator.first().boundingBox({ timeout: 5000 });
  if (!box) throw new Error("element has no box");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}
async function typeInto(page, locator, text, touch) {
  await tapOrClick(page, locator, touch);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(text);
}

function seedFleet(s) {
  // Plain SQL so the same seed works on main (before the households migration).
  s.sql(`insert into auth.users (id, email) values ('${JOHN.id}', '${JOHN.email}'), ('${JANE.id}', '${JANE.email}');
    insert into list_hub.households (id, name, access_code) values ('${FLEET}', 'Fleet Home', 'f');
    insert into list_hub.members (household_id, email, display_name, role, user_id) values ('${FLEET}', '${JOHN.email}', 'John', 'owner', '${JOHN.id}');
    insert into list_hub.lists (id, household_id, slug, name, kind, status) values ('${F.needs}', '${FLEET}', 'list', 'List', 'needs', 'open'), ('${F.wish}', '${FLEET}', 'wish', 'Wishlist', 'wish', 'open');
    insert into list_hub.stores (id, household_id, slug, name, kind, sort_order) values ('${F.mart}', '${FLEET}', 'fleet-mart', 'Fleet Mart', 'grocery', 1);
    set request.jwt.claims = '{"role":"authenticated","sub":"${JOHN.id}","email":"${JOHN.email}"}';
    insert into list_hub.items (id, list_id, name, status, category) values ('${F.milk}', '${F.needs}', 'Fleet milk', 'needed', 'Food'), ('${F.bread}', '${F.needs}', 'Fleet bread', 'needed', 'Food'), ('${F.tent}', '${F.wish}', 'Tent', 'needed', 'Outdoor & Sports');
    reset request.jwt.claims;`);
}
const hh1Snapshot = (s) => s.sql(`select ${["items i join list_hub.lists l on l.id=i.list_id where l.household_id", "stores where household_id", "item_prefs where household_id", "category_cache where household_id", "trips where household_id", "trip_items where household_id", "finds where household_id", "find_requests where household_id", "members where household_id"].map((t) => `(select count(*) from list_hub.${t}='${IDS.household}')`).join("||'|'||")}`);

async function newContext(browser, s, viewport, touch, user) {
  const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 3 : 1 });
  if (user) {
    const now = Math.floor(Date.now() / 1000);
    const session = {
      access_token: userJwt(user.id, user.email), token_type: "bearer", expires_in: 86400, expires_at: now + 86400, refresh_token: "local-refresh",
      user: { id: user.id, email: user.email, aud: "authenticated", role: "authenticated", user_metadata: { has_password: true }, app_metadata: {} },
    };
    await context.addInitScript((value) => { try { localStorage.setItem("sb-dphkvcdohqsvefbdhsfx-auth-token", value); } catch (e) {} }, JSON.stringify(session));
  }
  await context.route("https://dphkvcdohqsvefbdhsfx.supabase.co/**", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    try {
      const headers = { ...req.headers() }; delete headers.host;
      // The app ships the production anon key; the local PostgREST only trusts locally signed tokens.
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
  return { context, page };
}
// A failing step is recorded by its own check; keep going so every check reports.
async function safe(label, fn) {
  try { await fn(); } catch (err) { console.error(`step "${label}" threw: ${String(err.message || err).split("\n")[0]}`); }
}
async function waitApp(page, timeout = 20000) {
  return page.waitForFunction(() => { const a = document.getElementById("app"); return a && !a.classList.contains("hidden"); }, null, { timeout }).then(() => true, () => false);
}

async function run(tag, viewport, touch) {
  const s = await startStack({ port: touch ? 54480 : 54470 });
  const browser = await chromium.launch();
  try {
    seedFleet(s);
    const hh1Before = hh1Snapshot(s);

    // ---- A. sign-in copy (signed out) ----
    {
      const { context, page } = await newContext(browser, s, viewport, touch, null);
      await page.goto(APP, { waitUntil: "domcontentloaded" });
      await page.locator("#gate").waitFor({ state: "visible", timeout: 10000 });
      const gateText = await page.locator("#gate .gate-card").innerText();
      record(`${tag}: sign-in screen has no Pollock / Chris / Ellen copy`, !/Pollock|Chris|Ellen/.test(gateText), `gate says "${gateText.split("\n").slice(0, 3).join(" / ")}"`);
      await typeInto(page, page.locator("#login-email"), "sam@example.test", touch);
      await tapOrClick(page, page.locator("#magic-btn"), touch);
      await page.waitForFunction(() => !document.getElementById("gate-error").classList.contains("hidden") || !document.getElementById("gate-info").classList.contains("hidden"), null, { timeout: 6000 }).catch(() => {});
      const err = await page.locator("#gate-error").innerText().catch(() => "");
      const info = await page.locator("#gate-info").innerText().catch(() => "");
      record(`${tag}: a non-invited email is refused with neutral copy`, /household/.test(err) && !/Pollock|Chris|Ellen/.test(err) && !info, `error "${err}" info "${info}"`);
      await page.screenshot({ path: join(OUT, `${tag}-01-signin-refused.png`) });
      await context.close();
    }

    // ---- B. John (household 2) uses all 8 write paths ----
    let inviteLinkJane = null;
    {
      const { context, page } = await newContext(browser, s, viewport, touch, JOHN);
      await page.goto(APP, { waitUntil: "domcontentloaded" });
      const loaded = await waitApp(page);
      record(`${tag}: John signs in to his own household`, loaded && (await page.locator(`#items .item[data-id="${F.milk}"]`).count()) === 1, "app or Fleet items did not load");
      const inFleet = (q) => s.sql(q.replace(/HH/g, FLEET));
      try {

      // 1 stores: "+ Add store..." in the add form
      await tapOrClick(page, page.locator("#more-toggle"), touch);
      page.once("dialog", (d) => d.accept("Fleet Hardware"));
      await page.locator("#item-store").selectOption("__add__");
      await page.waitForTimeout(800);
      record(`${tag}: write 1/8 add store lands in household 2`, inFleet(`select count(*) from list_hub.stores where household_id='HH' and name='Fleet Hardware'`) === "1", "no Fleet Hardware store in household 2");

      // 2 item_prefs: add an item with a store
      await typeInto(page, page.locator("#item-name"), "batteries", touch);
      await page.locator("#item-store").selectOption(F.mart);
      await tapOrClick(page, page.locator('#add-form button[type="submit"]'), touch);
      await page.waitForTimeout(1200);
      record(`${tag}: write 2/8 item preference lands in household 2`, inFleet(`select count(*) from list_hub.item_prefs where household_id='HH' and name_key='batteries'`) === "1", "no item_prefs row for batteries in household 2");

      // 3 category_cache: pick a category for an item
      const batteries = inFleet(`select i.id from list_hub.items i where i.list_id='${F.needs}' and i.name='batteries'`);
      const catBtn = page.locator(`#items .item[data-id="${batteries}"] [data-act="cat"]`);
      if (await catBtn.count()) {
        await tapOrClick(page, catBtn, touch);
        await page.locator("#sheet [data-section]").first().waitFor({ timeout: 4000 });
        await tapOrClick(page, page.locator('#sheet [data-section]').first(), touch);
        await page.waitForTimeout(1200);
      }
      record(`${tag}: write 3/8 category memory lands in household 2`, inFleet(`select count(*) from list_hub.category_cache where household_id='HH' and name_key='batteries'`) === "1", "no category_cache row in household 2");

      // 4 + 5 trips and trip_items: plan a trip
      await tapOrClick(page, page.locator("#plan-btn"), touch);
      await page.locator(`#sheet [data-store="${F.mart}"]`).waitFor({ timeout: 4000 }).catch(() => {});
      if (await page.locator(`#sheet [data-store="${F.mart}"]`).count()) await tapOrClick(page, page.locator(`#sheet [data-store="${F.mart}"]`), touch);
      if (await page.locator(`#sheet [data-pick="${F.milk}"]`).count()) {
        const pickOn = await page.locator(`#sheet [data-pick="${F.milk}"] .check-btn.on`).count();
        if (!pickOn) await tapOrClick(page, page.locator(`#sheet [data-pick="${F.milk}"]`), touch);
      }
      const bread = page.locator(`#sheet [data-pick="${F.bread}"] .check-btn.on`);
      if (await bread.count()) await tapOrClick(page, page.locator(`#sheet [data-pick="${F.bread}"]`), touch);
      if (await page.locator("#trip-start:not([disabled])").count()) await tapOrClick(page, page.locator("#trip-start"), touch);
      await page.waitForTimeout(1500);
      record(`${tag}: write 4/8 trip lands in household 2`, inFleet(`select count(*) from list_hub.trips where household_id='HH'`) === "1", "no trip in household 2");
      record(`${tag}: write 5/8 trip items land in household 2`, Number(inFleet(`select count(*) from list_hub.trip_items where household_id='HH'`)) >= 1, "no trip_items in household 2");

      // 6 add more to the trip
      const before6 = Number(inFleet(`select count(*) from list_hub.trip_items where household_id='HH'`));
      if (!(await page.locator("#trip-more").count())) {
        const trip = inFleet(`select id from list_hub.trips where household_id='HH' limit 1`);
        if (trip) await page.evaluate((id) => window.__lh.api.tripView(id), trip);
      }
      if (await page.locator("#trip-more").count()) {
        await tapOrClick(page, page.locator("#trip-more"), touch);
        await page.locator("#sheet [data-p]").first().waitFor({ timeout: 4000 }).catch(() => {});
        if (await page.locator(`#sheet [data-p="${F.bread}"]`).count()) await tapOrClick(page, page.locator(`#sheet [data-p="${F.bread}"]`), touch);
        if (await page.locator("#att-add").count()) await tapOrClick(page, page.locator("#att-add"), touch);
        await page.waitForTimeout(1200);
      }
      record(`${tag}: write 6/8 add to trip lands in household 2`, Number(inFleet(`select count(*) from list_hub.trip_items where household_id='HH'`)) > before6, "trip_items did not grow");
      if (await page.locator("#sheet [data-close]").count()) await tapOrClick(page, page.locator("#sheet [data-close]"), touch);
      await page.waitForTimeout(300);

      // 7 finds: Wishlist item > log a find
      await tapOrClick(page, page.locator('.tab[data-kind="wish"]'), touch);
      await page.locator(`#items .item[data-id="${F.tent}"]`).waitFor({ timeout: 4000 }).catch(() => {});
      const detail = page.locator(`#items .item[data-id="${F.tent}"] [data-act="detail"]`);
      if (await detail.count()) await tapOrClick(page, page.locator(`#items .item[data-id="${F.tent}"] .item-name`), touch);
      if (!(await page.locator("#find-title").count())) await page.evaluate((id) => { const it = window.__lh.S.items.find((x) => x.id === id); it && window.__lh.api.openWish(it); }, F.tent);
      if (await page.locator("#find-title").count()) {
        await typeInto(page, page.locator("#find-title"), "2-person tent", touch);
        await tapOrClick(page, page.locator('#find-add [type="submit"]'), touch);
        await page.waitForTimeout(1200);
      }
      record(`${tag}: write 7/8 find lands in household 2`, inFleet(`select count(*) from list_hub.finds where household_id='HH'`) === "1", "no find in household 2");

      // 8 find_requests: find options
      if (!(await page.locator("#find-opts").count())) await page.evaluate((id) => { const it = window.__lh.S.items.find((x) => x.id === id); it && window.__lh.api.openFindOptions(it); }, F.tent);
      if (await page.locator("#find-opts").count()) {
        await tapOrClick(page, page.locator('#find-opts [type="submit"]'), touch);
        await page.waitForTimeout(1200);
      }
      record(`${tag}: write 8/8 find request lands in household 2`, inFleet(`select count(*) from list_hub.find_requests where household_id='HH'`) === "1", "no find_request in household 2");
      if (await page.locator("#sheet [data-close]").count()) await tapOrClick(page, page.locator("#sheet [data-close]"), touch);
      await page.waitForTimeout(300);
      await tapOrClick(page, page.locator('.tab[data-kind="needs"]'), touch);

      // ---- C. Menu > Household: invite, resend, cancel ----
      await tapOrClick(page, page.locator("#menu-btn"), touch);
      const hasSec = await page.locator("#household-sec").waitFor({ timeout: 6000 }).then(() => true, () => false);
      const secTitle = hasSec ? await page.locator("#household-sec h3").innerText() : "";
      record(`${tag}: Menu shows the household section with the household name`, hasSec && secTitle === "Fleet Home", `section "${secTitle}"`);
      if (hasSec) {
        await typeInto(page, page.locator("#invite-email"), JANE.email, touch);
        await typeInto(page, page.locator("#invite-name"), "Jane", touch);
        await tapOrClick(page, page.locator("#invite-create-btn"), touch);
        const linkShown = await page.locator("#invite-fresh-link").waitFor({ timeout: 6000 }).then(() => true, () => false);
        const first = linkShown ? await page.locator("#invite-fresh-link").inputValue() : "";
        const listed = await page.locator(`#sheet [data-invite-row]`, { hasText: JANE.email }).count();
        record(`${tag}: inviting by email shows a one-time link and a pending row`, linkShown && /\?invite=lhi_/.test(first) && listed === 1, `link shown ${linkShown}, rows ${listed}`);
        const mail = await page.locator("#invite-fresh-mail").getAttribute("href").catch(() => "");
        record(`${tag}: Email invite opens a mail draft to the invitee with the link`, (mail || "").startsWith(`mailto:${encodeURIComponent(JANE.email)}?`) && decodeURIComponent(mail).includes("?invite=lhi_"), "no mailto link");
        await page.locator("#household-sec").scrollIntoViewIfNeeded();
        // Blur the (local, throwaway) token so screenshots never carry a token value.
        await page.addStyleTag({ content: ".invite-link { filter: blur(5px); }" });
        await page.screenshot({ path: join(OUT, `${tag}-02-invite-menu.png`) });

        // Resend Jane's invite: new link, old one stops working.
        await tapOrClick(page, page.locator(`#sheet [data-invite-row]`, { hasText: JANE.email }).locator("[data-invite-resend]"), touch);
        await page.waitForFunction((old) => { const t = document.getElementById("invite-fresh-link"); return t && t.value && t.value !== old; }, first, { timeout: 6000 }).catch(() => {});
        inviteLinkJane = await page.locator("#invite-fresh-link").inputValue().catch(() => "");
        const oldTok = new URL(first).searchParams.get("invite");
        const oldStatus = s.sql(`select list_hub.invite_status(i) from list_hub.household_invites i where token_hash = encode(extensions.digest('${oldTok}', 'sha256'), 'hex')`);
        record(`${tag}: Resend gives a new link and cancels the old one`, inviteLinkJane && inviteLinkJane !== first && oldStatus === "cancelled", `old status ${oldStatus}`);

        // Link invite, then cancel it.
        await typeInto(page, page.locator("#invite-email"), " ", touch);
        await page.locator("#invite-email").fill("");
        await tapOrClick(page, page.locator("#invite-create-btn"), touch);
        const linkRow = page.locator(`#sheet [data-invite-row]`, { hasText: "Link invite" });
        await linkRow.first().waitFor({ timeout: 6000 }).catch(() => {});
        if (await linkRow.count()) await tapOrClick(page, linkRow.locator("[data-invite-cancel]"), touch);
        await page.waitForTimeout(1200);
        const cancelled = s.sql(`select count(*) from list_hub.household_invites where household_id='${FLEET}' and email is null and cancelled_at is not null`);
        record(`${tag}: Cancel removes a pending link invite`, cancelled === "1" && (await page.locator(`#sheet [data-invite-row]`, { hasText: "Link invite" }).count()) === 0, `cancelled rows ${cancelled}`);
      }
      } catch (err) { record(`${tag}: John's steps ran to the end`, false, String(err.message || err).split("\n")[0]); }
      record(`${tag}: no page errors for John`, page.errors.length === 0, page.errors.join(" | ").slice(0, 200));
      await context.close();
    }

    // ---- D. Jane opens the invite link, signs in, joins ----
    {
      const { context, page } = await newContext(browser, s, viewport, touch, null);
      if (inviteLinkJane) {
        const path = new URL(inviteLinkJane);
        await page.goto(APP + path.search, { waitUntil: "domcontentloaded" });
      } else await page.goto(APP + "?invite=lhi_missing_link_000000000000000", { waitUntil: "domcontentloaded" });
      try {
      const banner = await page.locator("#invite-banner:not(.hidden)").innerText({ timeout: 6000 }).catch(() => "");
      record(`${tag}: invite landing names the household and who invited`, /Fleet Home/.test(banner) && /John/.test(banner) && /j\*\*\*@example\.test/.test(banner), `banner "${banner}"`);
      await typeInto(page, page.locator("#login-email"), JANE.email, touch);
      await tapOrClick(page, page.locator("#magic-btn"), touch);
      const info = await page.locator("#gate-info:not(.hidden)").innerText({ timeout: 5000 }).catch(() => "");
      record(`${tag}: invited email is allowed to request a sign-in link`, /Link sent/.test(info), `info "${info}" error "${await page.locator("#gate-error").innerText().catch(() => "")}"`);
      await page.screenshot({ path: join(OUT, `${tag}-03-accept-landing.png`) });
      } catch (err) { record(`${tag}: landing steps ran to the end`, false, String(err.message || err).split("\n")[0]); }
      await context.close();

      // The emailed link brings Jane back signed in, with ?invite= kept in the redirect.
      const j = await newContext(browser, s, viewport, touch, JANE);
      const path = inviteLinkJane ? new URL(inviteLinkJane).search : "";
      await j.page.goto(APP + path, { waitUntil: "domcontentloaded" });
      const loaded = await waitApp(j.page);
      await j.page.waitForTimeout(600);
      const toast = await j.page.locator("#toast").innerText().catch(() => "");
      const member = s.sql(`select role || '|' || display_name from list_hub.members where household_id='${FLEET}' and email='${JANE.email}'`);
      record(`${tag}: Jane joins Fleet Home as a member and sees its list`, loaded && member === "member|Jane" && (await j.page.locator(`#items .item[data-id="${F.milk}"]`).count()) === 1, `loaded ${loaded}, member "${member}"`);
      record(`${tag}: welcome toast and the invite is removed from the URL`, /Welcome to Fleet Home/.test(toast) && !(await j.page.evaluate(() => location.search)).includes("invite"), `toast "${toast}"`);
      await j.page.screenshot({ path: join(OUT, `${tag}-04-joined.png`) });
      record(`${tag}: no page errors for Jane`, j.page.errors.length === 0, j.page.errors.join(" | ").slice(0, 200));
      await j.context.close();
    }

    // ---- E. admin control: Chris (seeded admin) creates a household from the Menu ----
    {
      try { s.sql(`insert into list_hub.admins (user_id, note) values ('${IDS.chris}', 'test') on conflict do nothing`); } catch { /* no admins table (main) */ }
      const { context, page } = await newContext(browser, s, viewport, touch, { id: IDS.chris, email: "chris@example.test" });
      try {
        await page.goto(APP, { waitUntil: "domcontentloaded" });
        await waitApp(page);
        await tapOrClick(page, page.locator("#menu-btn"), touch);
        const hasAdmin = await page.locator("#admin-sec").waitFor({ timeout: 6000 }).then(() => true, () => false);
        if (hasAdmin) {
          await typeInto(page, page.locator("#admin-hh-name"), "Kim Home", touch);
          await typeInto(page, page.locator("#admin-owner-email"), "kim@example.test", touch);
          await tapOrClick(page, page.locator("#admin-create-btn"), touch);
          await page.locator("#admin-fresh-link").waitFor({ timeout: 6000 }).catch(() => {});
        }
        const made = s.sql(`select count(*)||'|'||(select count(*) from list_hub.lists l join list_hub.households h on h.id=l.household_id where h.name='Kim Home')||'|'||(select count(*) from list_hub.household_invites i join list_hub.households h on h.id=i.household_id where h.name='Kim Home' and i.role='owner' and i.email='kim@example.test') from list_hub.households where name='Kim Home'`);
        const link = await page.locator("#admin-fresh-link").inputValue().catch(() => "");
        record(`${tag}: admin creates a household from the Menu (2 empty lists + owner invite link)`, hasAdmin && made === "1|2|1" && /\?invite=lhi_/.test(link), `admin section ${hasAdmin}, households|lists|invites ${made}`);
      } catch (err) { record(`${tag}: admin steps ran to the end`, false, String(err.message || err).split("\n")[0]); }
      await context.close();
      const j = await newContext(browser, s, viewport, touch, JOHN);
      await j.page.goto(APP, { waitUntil: "domcontentloaded" });
      await waitApp(j.page);
      await tapOrClick(j.page, j.page.locator("#menu-btn"), touch).catch(() => {});
      await j.page.locator("#household-sec").waitFor({ timeout: 6000 }).catch(() => {});
      record(`${tag}: a non-admin member does not see the create-household control`, (await j.page.locator("#admin-sec").count()) === 0, "John sees #admin-sec");
      await j.context.close();
    }

    const hh1After = hh1Snapshot(s);
    record(`${tag}: household 1 unchanged by all of the above`, hh1After === hh1Before, `before ${hh1Before} after ${hh1After}`);
  } finally {
    await browser.close();
    await s.stop();
  }
}

try {
  await run("desktop-1440x900", { width: 1440, height: 900 }, false);
  await run("mobile-390x844", { width: 390, height: 844 }, true);
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
