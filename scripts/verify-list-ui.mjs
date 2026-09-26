// Headless Chromium + WebKit check of two-level list grouping (phone viewport).
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { chromium, webkit } from "playwright";

const dist = "dist";
const index = readFileSync(join(dist, "index.html"), "utf8");
const css = (index.match(/href="(assets\/styles\.[a-f0-9]+\.css)"/) || [])[1];
const cats = (index.match(/src="(assets\/categories\.[a-f0-9]+\.js)"/) || [])[1];
if (!css || !cats) throw new Error("hashed assets missing from dist/index.html");

const preview = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>List Hub · category preview</title>
  <link rel="stylesheet" href="${css}">
  <style>body{padding:16px}#items{max-width:520px;margin:0 auto}h1{font-size:1.2rem}</style>
</head>
<body>
  <h1>List</h1>
  <main id="items" class="items"></main>
  <script src="${cats}"></script>
  <script>
    window.__previewErrors = [];
    window.onerror = function (msg) { window.__previewErrors.push(String(msg)); };
    var items = [
      { id: "1", name: "Shredded lettuce", category: "Food", status: "needed" },
      { id: "2", name: "Bananas", category: "Food", status: "needed" },
      { id: "3", name: "Chicken", category: "Food", status: "needed" },
      { id: "4", name: "Ground beef", category: "Food", status: "needed" },
      { id: "5", name: "Eggs", category: "Food", status: "needed" },
      { id: "6", name: "Cottage cheese", category: "Food", status: "needed" },
      { id: "7", name: "Coffee", category: "Food", status: "needed" },
      { id: "8", name: "Fruity Pebbles", category: "Other", status: "needed" },
      { id: "9", name: "Protein bars", category: "Other", status: "needed" },
      { id: "10", name: "Tide pods", category: "Household", status: "needed" },
      { id: "11", name: "Toilet paper", category: "Household", status: "needed" },
      { id: "12", name: "New PC", category: "Electronics", status: "needed" },
      { id: "13", name: "Traeger Woodbridge elite", category: "Household", category_source: "user", status: "needed" }
    ];
    function renderItem(e) {
      var cat = LHCats.resolveItem(e);
      return '<article class="item" data-id="' + e.id + '"><button class="check-btn" type="button">✓</button><div class="item-body"><div class="item-name">' +
        e.name + '</div><div class="item-meta"><span class="badge cat">' +
        (cat.subEmoji || cat.emoji) + " " + (cat.chip || cat.section) + "</span></div></div></article>";
    }
    document.getElementById("items").innerHTML = LHCats.renderGroups(items, renderItem);
    window.__previewReady = true;
    window.__previewGroups = LHCats.groupItems(items);
  </script>
</body>
</html>`;
writeFileSync(join(dist, "preview.html"), preview);

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = createServer((req, res) => {
  let url = decodeURIComponent((req.url || "/").split("?")[0]);
  if (url.startsWith("/listhub/")) url = url.slice("/listhub".length) || "/";
  if (url === "/") url = "/index.html";
  const file = join(dist, url.replace(/^\/+/, ""));
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(4173, resolve));

const outDir = "/opt/cursor/artifacts/screenshots";
mkdirSync(outDir, { recursive: true });
const phone = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const errors = [];

async function run(browserType, name) {
  const browser = await browserType.launch();
  const page = await browser.newPage({ viewport: { width: phone.width, height: phone.height } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await page.goto("http://127.0.0.1:4173/listhub/preview.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__previewReady);
  const info = await page.evaluate(() => ({
    errors: window.__previewErrors,
    groups: Array.from(document.querySelectorAll(".group")).map((g) => ({
      section: g.getAttribute("data-section"),
      title: g.querySelector(".group-title") && g.querySelector(".group-title").textContent.trim(),
      subs: Array.from(g.querySelectorAll(".subhead")).map((s) => s.textContent.trim()),
      items: Array.from(g.querySelectorAll(".item-name")).map((s) => s.textContent.trim())
    }))
  }));
  if (info.errors.length || consoleErrors.length) {
    errors.push(name + " console: " + JSON.stringify(info.errors.concat(consoleErrors)));
  }
  if (!info.groups.length) errors.push(name + ": no groups");
  const food = info.groups.find((g) => g.section === "Food");
  if (!food) errors.push(name + ": missing Food section");
  else {
    if (!food.subs.some((s) => /Produce/i.test(s))) errors.push(name + ": Produce subhead missing");
    if (!food.subs.some((s) => /Meat/i.test(s))) errors.push(name + ": Meat subhead missing");
    if (!food.subs.some((s) => /Dairy/i.test(s))) errors.push(name + ": Dairy subhead missing");
    if (food.subs.some((s) => /Deli/i.test(s))) errors.push(name + ": empty Deli should be hidden");
    const produceIdx = food.subs.findIndex((s) => /Produce/i.test(s));
    const frozenIdx = food.subs.findIndex((s) => /Frozen/i.test(s));
    if (produceIdx !== 0) errors.push(name + ": Produce should be first food aisle");
    if (frozenIdx >= 0 && frozenIdx < produceIdx) errors.push(name + ": Frozen before Produce");
  }
  await page.screenshot({ path: join(outDir, "list-grouped-" + name + ".png"), fullPage: true });
  await browser.close();
  console.log(name, JSON.stringify(info.groups, null, 2));
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
console.log("ui ok, screenshots in", outDir);
