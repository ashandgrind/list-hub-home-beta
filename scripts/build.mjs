// Tiny no-dependency build for Vercel: copies the static app into dist/ with
// content-hashed asset filenames so browsers (iPhone Safari especially) can never
// run a stale app.js/styles.css. index.html itself is served with no-cache.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const out = "dist";
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/assets`, { recursive: true });

const partFiles = readdirSync("app.parts").filter((f) => f.endsWith(".js")).sort();
if (!partFiles.length) throw new Error("app.parts is empty");
const appSrc = partFiles.map((f) => readFileSync(`app.parts/${f}`)).join("");

const hashed = {};
for (const [src, base, ext, buf] of [
  ["categories.js", "categories", "js", null],
  ["rename-item.js", "rename-item", "js", null],
  ["app.js", "app", "js", Buffer.from(appSrc)],
  ["styles.css", "styles", "css", null]
]) {
  const body = buf || readFileSync(src);
  const h = createHash("sha256").update(body).digest("hex").slice(0, 12);
  const name = `assets/${base}.${h}.${ext}`;
  writeFileSync(`${out}/${name}`, body);
  hashed[src] = name;
}

let html = readFileSync("index.html", "utf8");
for (const [src, name] of Object.entries(hashed)) {
  const re = new RegExp(`(src|href)="${src.replace(".", "\\.")}"`, "g");
  if (!re.test(html)) throw new Error(`index.html does not reference ${src}`);
  html = html.replace(re, `$1="${name}"`);
}
const sha = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);
html = html.replace("<title>", `<meta name="list-hub-commit" content="${sha}">\n  <title>`);
writeFileSync(`${out}/index.html`, html);
console.log("built", hashed, "commit", sha);
