// Tiny no-dependency build for Vercel: copies the static app into dist/ with
// content-hashed asset filenames so browsers (iPhone Safari especially) can never
// run a stale app.js/styles.css. index.html itself is served with no-cache.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const out = "dist";
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/assets`, { recursive: true });

const hashed = {};
for (const [src, base, ext] of [
  ["categories.js", "categories", "js"],
  ["rename-item.js", "rename-item", "js"],
  ["app.js", "app", "js"],
  ["styles.css", "styles", "css"],
  ["embed.js", "embed", "js"],
  ["embed.css", "embed", "css"]
]) {
  const buf = readFileSync(src);
  const h = createHash("sha256").update(buf).digest("hex").slice(0, 12);
  const name = `assets/${base}.${h}.${ext}`;
  writeFileSync(`${out}/${name}`, buf);
  hashed[src] = name;
}

// Each page lists the assets it must reference; a missing reference fails the build.
const pages = {
  "index.html": ["categories.js", "rename-item.js", "app.js", "styles.css"],
  // TV / kiosk list widget served at /listhub/embed (see vercel.json)
  "embed.html": ["categories.js", "embed.js", "embed.css"]
};
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);
for (const [page, assets] of Object.entries(pages)) {
  let html = readFileSync(page, "utf8");
  for (const src of assets) {
    const name = hashed[src];
    const re = new RegExp(`(src|href)="${src.replace(".", "\\.")}"`, "g");
    if (!re.test(html)) throw new Error(`${page} does not reference ${src}`);
    html = html.replace(re, `$1="${name}"`);
  }
  html = html.replace("<title>", `<meta name="list-hub-commit" content="${sha}">\n  <title>`);
  writeFileSync(`${out}/${page}`, html);
}
console.log("built", hashed, "pages", Object.keys(pages), "commit", sha);
