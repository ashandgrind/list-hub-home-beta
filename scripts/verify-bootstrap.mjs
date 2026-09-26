// Headless Chromium + WebKit: signed-in path must call lh_bootstrap and render.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium, webkit } from "playwright";

const dist = "dist";
let index = readFileSync(join(dist, "index.html"), "utf8");
if (/var C = window\.LHCats|C = window\.LHCats/.test(readFileSync("app.js", "utf8"))) {
  throw new Error("app.js still aliases LHCats as C — that shadows lhBootstrap");
}
if (!/async function lhBootstrap\(/.test(readFileSync("app.js", "utf8"))) {
  throw new Error("app.js is missing async function lhBootstrap");
}

const mock = `<script>
window.LH_BOOT_CALLS = 0;
(function () {
  var SESSION = { access_token: "test-token", user: { id: "u1", email: "christian@cruxibl.com" } };
  var BOOT = {
    member: { household_id: "hh1", email: "christian@cruxibl.com", display_name: "Chris", role: "owner", user_id: "u1" },
    stores: [{ id: "s1", slug: "publix", name: "Publix", kind: "grocery", sort_order: 1, app_hint: null }],
    lists: [
      { id: "l-needs", slug: "needs", name: "List", kind: "needs", status: "open" },
      { id: "l-wish", slug: "wish", name: "Wishlist", kind: "wish", status: "open" }
    ],
    items: [
      { id: "i1", list_id: "l-needs", name: "Shredded lettuce", qty: null, status: "needed", discreet: false, created_by: "Chris", category: "Food", category_source: "local", barcode: null },
      { id: "i2", list_id: "l-needs", name: "Chicken", qty: null, status: "needed", discreet: false, created_by: "Chris", category: "Food", category_source: "local", barcode: null },
      { id: "i3", list_id: "l-needs", name: "Eggs", qty: null, status: "needed", discreet: false, created_by: "Chris", category: "Food", category_source: "local", barcode: null },
      { id: "i4", list_id: "l-needs", name: "Coffee", qty: null, status: "needed", discreet: false, created_by: "Chris", category: "Food", category_source: "local", barcode: null },
      { id: "i5", list_id: "l-wish", name: "New PC", qty: null, status: "needed", discreet: false, created_by: "Chris", category: "Electronics", category_source: "ai", barcode: null }
    ],
    history: [],
    prefs: [],
    cats: {},
    trips: []
  };
  function q() {
    var api = {
      select: function () { return api; },
      insert: function () { return api; },
      update: function () { return api; },
      upsert: function () { return api; },
      delete: function () { return api; },
      eq: function () { return api; },
      in: function () { return api; },
      order: function () { return api; },
      limit: function () { return api; },
      single: function () { return Promise.resolve({ data: null, error: null }); },
      then: function (a, b) { return Promise.resolve({ data: [], error: null }).then(a, b); }
    };
    return api;
  }
  window.supabase = {
    createClient: function () {
      return {
        auth: {
          getSession: function () { return Promise.resolve({ data: { session: SESSION }, error: null }); },
          getUser: function () { return Promise.resolve({ data: { user: SESSION.user }, error: null }); },
          onAuthStateChange: function (cb) {
            setTimeout(function () { cb("INITIAL_SESSION", SESSION); }, 0);
            return { data: { subscription: { unsubscribe: function () {} } } };
          },
          signOut: function () { return Promise.resolve({ error: null }); }
        },
        rpc: function (name) {
          if (name === "lh_bootstrap") {
            window.LH_BOOT_CALLS++;
            return Promise.resolve({ data: BOOT, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        from: function () { return q(); }
      };
    }
  };
})();
</script>`;

index = index
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[\s\S]*?<\/script>\s*/, "")
  .replace("</head>", mock + "\n</head>");
if (/cdn\.jsdelivr\.net\/npm\/@supabase/.test(index)) throw new Error("failed to strip real supabase CDN from boot-test.html");
writeFileSync(join(dist, "boot-test.html"), index);

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer((req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url.startsWith("/listhub/")) url = url.slice("/listhub".length) || "/";
  if (url === "/") url = "/boot-test.html";
  const file = join(dist, url.replace(/^\/+/, ""));
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(4174, resolve));

const outDir = "/opt/cursor/artifacts/screenshots";
mkdirSync(outDir, { recursive: true });
const errors = [];

async function run(browserType, name) {
  const browser = await browserType.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await page.addInitScript(function () {
    try { localStorage.setItem("sb-dphkvcdohqsvefbdhsfx-auth-token", "1"); } catch (e) {}
  });
  await page.goto("http://127.0.0.1:4174/listhub/boot-test.html", { waitUntil: "domcontentloaded" });
  try {
    await page.waitForFunction(function () {
      var app = document.getElementById("app");
      return app && !app.classList.contains("hidden") && document.querySelector("#items .group");
    }, null, { timeout: 15000 });
  } catch (err) {
    const dump = await page.evaluate(function () {
      var app = document.getElementById("app");
      var gate = document.getElementById("gate");
      var splash = document.getElementById("splash");
      var items = document.getElementById("items");
      return {
        href: location.href,
        boot: window.__lhBoot,
        bootCalls: window.LH_BOOT_CALLS,
        hasLHCats: typeof window.LHCats,
        hasSupabase: !!(window.supabase && window.supabase.createClient),
        lh: window.__lh && { version: window.__lh.version, view: window.__lh.S && window.__lh.S.view, events: window.__lh.events, T: window.__lh.T, err: window.__lh.S && window.__lh.S },
        appHidden: !app || app.classList.contains("hidden"),
        gateHidden: !gate || gate.classList.contains("hidden"),
        splashHidden: !splash || splash.classList.contains("hidden"),
        gateError: (document.getElementById("gate-error") || {}).textContent,
        status: (document.getElementById("status") || {}).textContent,
        itemsHtml: items ? items.innerHTML.slice(0, 400) : null,
        htmlClass: document.documentElement.className
      };
    });
    console.error(name, "dump", JSON.stringify(dump, null, 2));
    throw err;
  }
  const info = await page.evaluate(function () {
    var err = document.getElementById("gate-error");
    var status = document.getElementById("status");
    return {
      bootCalls: window.LH_BOOT_CALLS || 0,
      view: window.__lh && window.__lh.S && window.__lh.S.view,
      who: (document.getElementById("who-line") || {}).textContent || "",
      gateError: err ? err.textContent : "",
      gateHidden: !err || err.classList.contains("hidden"),
      status: status ? status.textContent : "",
      groups: Array.from(document.querySelectorAll("#items .group")).map(function (g) {
        return {
          section: g.getAttribute("data-section"),
          title: (g.querySelector(".group-title") && g.querySelector(".group-title").textContent.trim()) || "",
          subs: Array.from(g.querySelectorAll(".subhead")).map(function (s) { return s.textContent.trim(); }),
          items: Array.from(g.querySelectorAll(".item-name")).map(function (s) { return s.textContent.trim(); })
        };
      }),
      pageErrors: window.__previewErrors || []
    };
  });
  const fail = function (msg) { errors.push(name + ": " + msg); };
  if (consoleErrors.length) fail("console/page errors: " + JSON.stringify(consoleErrors));
  if (info.bootCalls < 1) fail("lh_bootstrap was not called");
  if (info.view !== "app") fail("view is " + info.view + ", expected app");
  if (!/Chris/i.test(info.who)) fail("who-line missing Chris: " + info.who);
  if (info.gateError && !info.gateHidden) fail("gate error visible: " + info.gateError);
  if (/couldn.t load your list|C is not a function/i.test(info.status + info.gateError)) {
    fail("bootstrap error shown: " + info.status + " " + info.gateError);
  }
  const food = info.groups.find(function (g) { return g.section === "Food"; });
  if (!food) fail("Food section missing after bootstrap");
  else {
    if (!food.subs.some(function (s) { return /Produce/i.test(s); })) fail("Produce subhead missing");
    if (!food.items.includes("Eggs") || !food.items.includes("Chicken")) fail("bootstrap items missing");
  }
  await page.screenshot({ path: join(outDir, "signed-in-bootstrap-" + name + ".png"), fullPage: true });
  await browser.close();
  console.log(name, JSON.stringify(info, null, 2));
}

try {
  await run(chromium, "chromium");
  await run(webkit, "webkit");
} finally {
  server.close();
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("bootstrap ui ok");
