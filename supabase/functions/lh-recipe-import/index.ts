// lh-recipe-import: turn a recipe link (web page, YouTube, social post) or pasted
// recipe text into a grocery-ready ingredient list for List Hub.
// POST { url?: string, text?: string }  (verify_jwt on; household members only)
// -> { title, servings, source_url, source_kind, method, ingredients:[{name, quantity, unit, note, staple}] } or { error, message }
// Nothing is written to the list here; the app shows a preview and adds via its normal path.
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const MODELS = (Deno.env.get("LH_RECIPE_MODELS") || "grok-4.20-non-reasoning,grok-4.3,grok-4-1-fast-non-reasoning").split(",");
// Models used with xAI server-side tools (web_search / x_search) when a site blocks our direct fetch.
const BROWSE_MODELS = (Deno.env.get("LH_RECIPE_BROWSE_MODELS") || "grok-4.3,grok-4.20-reasoning,grok-4.7").split(",");
let TRACE: string[] = [];
const trace = (s: string) => TRACE.length < 40 && TRACE.push(s.slice(0, 200));
const ORIGINS = [
  "https://list-hub-live.vercel.app",
  "https://pollock-lists.vercel.app",
  "https://list-hub-home-beta.vercel.app",
  "https://hq.cruxibl.com",
  "https://cruxibl.com",
  "https://lh.test",
];
const UA_BROWSER =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  const allow =
    ORIGINS.includes(o) ||
    /^https:\/\/(pollock-lists|list-hub-home-beta|listhub-hq)-[a-z0-9-]+\.vercel\.app$/.test(o) ||
    /^https:\/\/([a-z0-9-]+\.)?cruxibl\.com$/.test(o)
      ? o
      : ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
const json = (req: Request, s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors(req), "Content-Type": "application/json" } });

let XAI = (Deno.env.get("XAI_API_KEY") || "").trim();
let vaultAt = 0;
let goodModel = "";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
async function loadKey() {
  if (XAI || Date.now() - vaultAt < 60_000) return;
  vaultAt = Date.now();
  try {
    const { data } = await admin.rpc("lh_stt_key_get");
    if (typeof data === "string" && data.trim()) XAI = data.trim();
  } catch (_) {
    /* */
  }
}

class UserError extends Error {
  code: string;
  constructor(code: string, msg: string) {
    super(msg);
    this.code = code;
  }
}

// ---------- fetching ----------
function isPrivateHost(h: string) {
  h = h.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(10|127|0)\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.includes(":") ||
    h === "metadata.google.internal"
  );
}
async function get(url: string, opts: { ua?: string; ms?: number; headers?: Record<string, string>; max?: number } = {}) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) throw new UserError("bad_url", "That link can’t be opened.");
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), opts.ms || 9000);
  try {
    const r = await fetch(u.toString(), {
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": opts.ua || UA_BROWSER,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(opts.headers || {}),
      },
    });
    const buf = await r.arrayBuffer();
    const text = new TextDecoder().decode(buf.slice(0, opts.max || 3_000_000));
    return { ok: r.ok, status: r.status, url: r.url || url, text };
  } finally {
    clearTimeout(to);
  }
}
async function getJson(url: string, opts: { ua?: string; ms?: number } = {}) {
  try {
    const r = await get(url, { ...opts, headers: { Accept: "application/json" } });
    return r.ok ? JSON.parse(r.text) : null;
  } catch (_) {
    return null;
  }
}

// ---------- HTML helpers ----------
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", frac12: "½", frac14: "¼", frac34: "¾", deg: "°", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", eacute: "é" };
function decode(s: string) {
  return String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
function meta(html: string, prop: string) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${prop}["']`, "i");
  const m = html.match(re1) || html.match(re2);
  return m ? decode(m[1]).trim() : "";
}
function titleOf(html: string) {
  return meta(html, "og:title") || decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").trim();
}
function cleanText(html: string, max = 14000) {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|footer|header|aside|form|iframe)[\s\S]*?<\/\1>/gi, " ");
  // Prefer the article/main region when present.
  const main = h.match(/<(article|main)[\s\S]*?<\/\1>/i);
  if (main && main[0].length > 1500) h = main[0];
  const t = decode(
    h
      .replace(/<(br|\/p|\/li|\/h\d|\/div|\/tr)[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return t.slice(0, max);
}

function asArr(x: any): any[] {
  return x == null ? [] : Array.isArray(x) ? x : [x];
}
function isRecipe(n: any) {
  return n && typeof n === "object" && asArr(n["@type"]).some((t: any) => String(t).toLowerCase() === "recipe");
}
function findRecipeNode(x: any, depth = 0): any {
  if (!x || depth > 6) return null;
  if (Array.isArray(x)) {
    for (const y of x) {
      const r = findRecipeNode(y, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (typeof x !== "object") return null;
  if (isRecipe(x)) return x;
  for (const k of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    const r = findRecipeNode(x[k], depth + 1);
    if (r) return r;
  }
  return null;
}
function jsonLdRecipe(html: string) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    let data: any;
    try {
      data = JSON.parse(b[1].trim());
    } catch (_) {
      try {
        data = JSON.parse(b[1].trim().replace(/[\u0000-\u001f]+/g, " "));
      } catch (_) {
        continue;
      }
    }
    const r = findRecipeNode(data);
    const lines = asArr(r?.recipeIngredient || r?.ingredients)
      .map((s: any) => decode(String(s)).replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (r && lines.length) {
      const y = asArr(r.recipeYield).map(String);
      return { title: decode(String(r.name || "")).trim(), servings: y.find((s) => /\D/.test(s)) || y[0] || "", lines };
    }
  }
  // Microdata fallback: itemprop="recipeIngredient"
  const md = [...html.matchAll(/<[^>]+itemprop=["'](?:recipeIngredient|ingredients)["'][^>]*>([\s\S]*?)<\/(?:li|span|p|div)>/gi)]
    .map((m) => decode(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (md.length >= 2) return { title: "", servings: "", lines: md };
  return null;
}

// ---------- source kinds ----------
function ytId(u: URL) {
  const h = u.hostname.replace(/^(www|m|music)\./, "");
  if (h === "youtu.be") return u.pathname.slice(1).split("/")[0];
  if (h === "youtube.com" || h === "youtube-nocookie.com") {
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{6,})/);
    if (m) return m[1];
  }
  return null;
}
function socialKind(u: URL) {
  const h = u.hostname.replace(/^(www|m|mobile|vm|vt)\./, "");
  if (h === "x.com" || h === "twitter.com") return "x";
  if (h === "instagram.com") return "instagram";
  if (h === "tiktok.com") return "tiktok";
  if (h === "facebook.com" || h === "fb.watch" || h === "fb.com") return "facebook";
  if (h === "threads.net" || h === "threads.com") return "threads";
  if (h === "pinterest.com" || h === "pin.it") return "pinterest";
  return null;
}
const SKIP_LINK =
  /(youtube\.com|youtu\.be|instagram\.com|facebook\.com|tiktok\.com|twitter\.com|x\.com|patreon\.com|amzn\.|amazon\.|bit\.ly\/?$|linktr\.ee|discord|twitch\.tv|spotify|apple\.com|threads\.net|pinterest\.|snapchat|shopmy|ltk\.|liketoknow|geni\.us|kit\.co|merch|store\.|shop\.|\.shop\/|squarespace\.com\/?$|paypal|venmo|cash\.app)/i;

// Returns null when the site refuses our server (many recipe sites block cloud IPs);
// callers then fall back to Grok's own web browsing.
async function readWeb(url: string) {
  try {
    const r = await get(url);
    trace(`fetch ${new URL(url).hostname} ${r.status} ${r.text.length}b`);
    if (!r.ok || r.text.length < 500 || /captcha|cf-chl|Access Denied|Just a moment\.\.\./i.test(r.text.slice(0, 4000)) && r.text.length < 60000) return null;
    return { html: r.text, url: r.url, status: r.status };
  } catch (e) {
    if (e instanceof UserError) throw e;
    trace(`fetch ${url.slice(0, 60)} err ${String(e).slice(0, 60)}`);
    return null;
  }
}

// Ask Grok (with xAI server-side web_search or x_search) to open the page and copy out the recipe.
async function grokBrowse(url: string, kind: "web" | "x" | "youtube") {
  await loadKey();
  if (!XAI) return "";
  const host = new URL(url).hostname.replace(/^www\./, "");
  const tools =
    kind === "x"
      ? [{ type: "x_search" }]
      : [{ type: "web_search", filters: { allowed_domains: [kind === "youtube" ? "youtube.com" : host] } }];
  const ask =
    kind === "youtube"
      ? `Open this YouTube video page: ${url}\nCopy out the video title and its full description text (verbatim), especially any ingredient list or recipe link. If you cannot open that exact video, reply exactly CANNOT_OPEN.`
      : kind === "x"
        ? `Find this exact X post: ${url}\nCopy out the post text verbatim (and any thread replies by the same author that continue the recipe). If you cannot find that exact post, reply exactly CANNOT_OPEN.`
        : `Open this exact page: ${url}\nCopy out the recipe title, the yield/servings, and every ingredient line exactly as written on that page, one per line. Do not use any other page or recipe. If you cannot open that exact page, reply exactly CANNOT_OPEN.`;
  for (const model of BROWSE_MODELS) {
    try {
      const r = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        signal: AbortSignal.timeout(60000),
        headers: { Authorization: `Bearer ${XAI}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: [{ role: "user", content: ask }], tools, max_output_tokens: 3000 }),
      });
      const t = await r.text();
      if (!r.ok) {
        trace(`browse ${model} ${r.status} ${t.slice(0, 100)}`);
        if (r.status === 404 || r.status === 400) continue;
        return "";
      }
      const j = JSON.parse(t);
      let text = typeof j.output_text === "string" ? j.output_text : "";
      if (!text)
        for (const o of j.output || [])
          if (o.type === "message") for (const c of o.content || []) if (c.type === "output_text" && c.text) text += c.text + "\n";
      text = text.trim();
      trace(`browse ${model} ok ${text.length}c ${text.slice(0, 60).replace(/\s+/g, " ")}`);
      if (!text || /CANNOT_OPEN/.test(text.slice(0, 200)) && text.length < 300) return "";
      return text.slice(0, 15000);
    } catch (e) {
      trace(`browse ${model} err ${String(e).slice(0, 80)}`);
    }
  }
  return "";
}

async function youtube(id: string, origUrl: string) {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const out: { title: string; author: string; description: string; transcript: string; links: string[]; notes: string[]; weak?: boolean } = {
    title: "",
    author: "",
    description: "",
    transcript: "",
    links: [],
    notes: [],
  };
  const oe = await getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`);
  if (oe) {
    out.title = oe.title || "";
    out.author = oe.author_name || "";
  }
  let pr: any = null;
  let ogDesc = "";
  try {
    const r = await get(watch + "&hl=en&has_verified=1&bpctr=9999999999", {
      headers: { Cookie: "CONSENT=YES+cb; SOCS=CAI" },
      ms: 10000,
    });
    const m = r.text.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\})\s*;\s*(?:var\s|<\/script>)/);
    if (m) pr = JSON.parse(m[1]);
    trace(`yt watch ${r.status} ${r.text.length}b pr ${!!pr} ${pr?.playabilityStatus?.status || ""} desc ${pr?.videoDetails?.shortDescription?.length || 0}`);
    ogDesc = meta(r.text, "og:description") || meta(r.text, "description");
  } catch (e) {
    out.notes.push("watch_page:" + String(e).slice(0, 80));
  }
  if (!pr?.videoDetails?.shortDescription) {
    // Innertube "next" (watch-page data) usually still carries the description when the player API is bot-gated.
    try {
      const r = await fetch("https://www.youtube.com/youtubei/v1/next?prettyPrint=false", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA_BROWSER },
        body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: "en", gl: "US" } }, videoId: id }),
        signal: AbortSignal.timeout(9000),
      });
      const j = await r.json();
      const secondary = (j?.contents?.twoColumnWatchNextResults?.results?.results?.contents || []).find((c: any) => c.videoSecondaryInfoRenderer)
        ?.videoSecondaryInfoRenderer;
      const d = secondary?.attributedDescription?.content || (secondary?.description?.runs || []).map((x: any) => x.text).join("");
      trace(`yt next ${r.status} desc ${d ? d.length : 0}`);
      if (d) out.description = d;
    } catch (e) {
      trace(`yt next err ${String(e).slice(0, 60)}`);
    }
  }
  if (!pr?.videoDetails?.shortDescription && !out.description) {
    // Innertube player API (no key needed for these clients).
    for (const client of [
      { clientName: "ANDROID", clientVersion: "19.44.38", androidSdkVersion: 30 },
      { clientName: "WEB", clientVersion: "2.20250101.00.00" },
    ]) {
      try {
        const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": client.clientName === "ANDROID" ? "com.google.android.youtube/19.44.38 (Linux; U; Android 11) gzip" : UA_BROWSER },
          body: JSON.stringify({ context: { client: { ...client, hl: "en", gl: "US" } }, videoId: id }),
          signal: AbortSignal.timeout(9000),
        });
        const j = await r.json();
        trace(`yt player ${client.clientName} ${r.status} ${j?.playabilityStatus?.status || ""} desc ${j?.videoDetails?.shortDescription?.length || 0}`);
        if (j?.videoDetails?.shortDescription) {
          pr = j;
          break;
        }
      } catch (_) {
        /* */
      }
    }
  }
  if (pr?.videoDetails) {
    out.title = out.title || pr.videoDetails.title || "";
    out.author = out.author || pr.videoDetails.author || "";
    out.description = pr.videoDetails.shortDescription || out.description;
  }
  // og:description is truncated (~160 chars) but better than nothing.
  if (!out.description && ogDesc.length > 60) {
    out.description = ogDesc;
    out.weak = true;
  }
  // Captions (best effort; YouTube often blocks these from datacenter IPs).
  const tracks: any[] = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const track = tracks.find((t) => /^en/.test(t.languageCode) && t.kind !== "asr") || tracks.find((t) => /^en/.test(t.languageCode)) || tracks[0];
  if (track?.baseUrl) {
    try {
      const r = await get(track.baseUrl.replace(/&fmt=[^&]*/, "") + "&fmt=json3", { ms: 8000 });
      trace(`yt captions ${r.status} ${r.text.length}b`);
      if (r.ok && r.text.trim().startsWith("{")) {
        const j = JSON.parse(r.text);
        out.transcript = (j.events || [])
          .map((e: any) => (e.segs || []).map((s: any) => s.utf8).join(""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 12000);
      } else if (r.ok && r.text.includes("<text")) {
        out.transcript = decode(r.text.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 12000);
      }
    } catch (_) {
      out.notes.push("captions_failed");
    }
  }
  out.links = [...new Set((out.description.match(/https?:\/\/[^\s)<>"']+/g) || []).map((s) => s.replace(/[.,!?;:]+$/, "")))];
  return out;
}

async function social(kind: string, url: string) {
  let title = "",
    text = "",
    author = "";
  if (kind === "x") {
    const j = await getJson(`https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(url.replace("//x.com", "//twitter.com"))}`);
    if (j?.html) {
      text = decode(String(j.html).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").trim();
      author = j.author_name || "";
      title = author ? `Post by ${author}` : "X post";
    }
  } else if (kind === "tiktok") {
    const j = await getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
    if (j?.title) {
      text = j.title;
      author = j.author_name || "";
      title = author ? `TikTok by ${author}` : "TikTok";
    }
  }
  let pageUrl = url;
  let html = "";
  if (text.length < 40) {
    for (const ua of [UA_BROWSER]) {
      try {
        const r = await get(url, { ua, ms: 9000 });
        trace(`social page ${r.status} ${r.text.length}b`);
        if (!r.ok) continue;
        html = r.text;
        pageUrl = r.url;
        const d = meta(r.text, "og:description") || meta(r.text, "description") || meta(r.text, "twitter:description");
        const t = meta(r.text, "og:title") || titleOf(r.text);
        if (d && d.length > text.length) text = d;
        if (t && !title) title = t;
        if (text.length >= 40) break;
      } catch (_) {
        /* */
      }
    }
  }
  return { title, text, author, html, pageUrl };
}

// ---------- Grok ----------
const SYS =
  "You turn recipes into a household grocery shopping list. " +
  "Input may be a recipe web page, a list of ingredient lines, a video title/description/transcript, or a social post. " +
  "Extract ONLY the ingredients needed to cook the recipe (ignore equipment, affiliate products, sponsors, merch, and other recipes linked in passing). " +
  "For each ingredient return a clean grocery item name a shopper would look for in a store, Title Case, singular unless naturally plural " +
  "(\"2 cloves garlic, minced\" -> name \"Garlic\", quantity \"2 cloves\", note \"minced\"; \"1 (15 oz) can black beans, drained\" -> \"Black Beans\", quantity \"1 can (15 oz)\"; " +
  "\"kosher salt and freshly ground black pepper\" -> two items \"Kosher Salt\" and \"Black Pepper\"). " +
  "quantity = amount with unit as one short human string (e.g. \"2 cups\", \"1 lb\", \"3\"), or empty. unit = just the unit or empty. note = prep/optional details, very short, or empty. " +
  "Merge duplicates (same grocery item used twice in the recipe -> one item, combine quantities like \"1 cup + 2 tbsp\"). " +
  "Set staple=true for common pantry staples most kitchens already have: salt, pepper, water, ice, cooking oils (olive/vegetable/canola), cooking spray, sugar, all-purpose flour, baking soda, baking powder. Otherwise false. " +
  "If a sub-recipe is included (sauce, dressing), include its ingredients too. Keep the recipe order. " +
  "title = the dish name (short, no channel names/emojis/clickbait). servings = yield if stated, else empty. " +
  "If the input contains no recipe or no identifiable ingredients, return found=false with an empty list; never invent ingredients that are not in the input.";

async function grokExtract(content: string) {
  await loadKey();
  if (!XAI) throw new UserError("ai_not_configured", "Recipe reading isn’t configured (AI key missing).");
  const schema = {
    type: "object",
    properties: {
      found: { type: "boolean" },
      title: { type: "string" },
      servings: { type: "string" },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            quantity: { type: "string" },
            unit: { type: "string" },
            note: { type: "string" },
            staple: { type: "boolean" },
          },
          required: ["name", "quantity", "unit", "note", "staple"],
          additionalProperties: false,
        },
      },
    },
    required: ["found", "title", "servings", "ingredients"],
    additionalProperties: false,
  };
  const models = goodModel ? [goodModel, ...MODELS.filter((m) => m !== goodModel)] : MODELS;
  let last = "";
  for (const model of models) {
    try {
      const r = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(40000),
        headers: { Authorization: `Bearer ${XAI}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 4000,
          messages: [
            { role: "system", content: SYS },
            { role: "user", content: content.slice(0, 30000) },
          ],
          response_format: { type: "json_schema", json_schema: { name: "recipe", strict: true, schema } },
        }),
      });
      const t = await r.text();
      if (!r.ok) {
        last = `${model} ${r.status}: ${t.slice(0, 160)}`;
        if (r.status === 404 || r.status === 400) continue;
        throw new Error(last);
      }
      const out = JSON.parse(JSON.parse(t).choices?.[0]?.message?.content || "{}");
      goodModel = model;
      return { model, out };
    } catch (e) {
      last = String(e).slice(0, 200);
    }
  }
  throw new Error(last || "extract_failed");
}

// Used only if Grok is unavailable but we have structured ingredient lines.
const STAPLE = /^(kosher |sea |table |fine )?salt$|^(black |white )?pepper$|^(salt and pepper)$|^water$|^ice$|^(extra[- ]virgin )?olive oil$|^(vegetable|canola|cooking) oil$|^cooking spray$|^(granulated )?sugar$|^(all[- ]purpose )?flour$|^baking (soda|powder)$/i;
function naiveParse(line: string) {
  const m = line.match(/^\s*([\d\s\/½¼¾⅓⅔⅛.,-]+)?\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|cloves?|cans?|pinch|dash|sticks?|packages?|slices?|bunch(?:es)?|heads?|large|medium|small)?\.?\s+(?:of\s+)?(.+)$/i);
  let name = (m ? m[3] : line).split(",")[0].replace(/\(.*?\)/g, "").trim();
  name = name.replace(/\b(chopped|minced|diced|sliced|fresh(ly)?|ground|finely|to taste|divided|optional)\b/gi, "").replace(/\s+/g, " ").trim();
  const qty = m ? [m[1], m[2]].filter(Boolean).join(" ").trim() : "";
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return { name, quantity: qty, unit: m?.[2] || "", note: "", staple: STAPLE.test(name.toLowerCase()) };
}

function tidy(list: any[]) {
  const seen = new Map<string, any>();
  for (const x of list || []) {
    const name = String(x?.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!name) continue;
    const k = name.toLowerCase().replace(/(es|s)$/, "");
    const row = {
      name,
      quantity: String(x.quantity || "").trim().slice(0, 40),
      unit: String(x.unit || "").trim().slice(0, 20),
      note: String(x.note || "").trim().slice(0, 80),
      staple: !!x.staple,
    };
    const prev = seen.get(k);
    if (prev) {
      if (row.quantity && prev.quantity && row.quantity !== prev.quantity) prev.quantity = `${prev.quantity} + ${row.quantity}`.slice(0, 40);
      else prev.quantity = prev.quantity || row.quantity;
    } else seen.set(k, row);
  }
  return [...seen.values()].slice(0, 60);
}

async function importRecipe(body: any) {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  let raw = typeof body.url === "string" ? body.url.trim() : "";
  if (!raw && /^https?:\/\/\S+$/i.test(text)) raw = text;
  if (!raw && text.length < 400) {
    // A link pasted along with other words (e.g. a share-sheet blurb).
    const m = text.match(/https?:\/\/[^\s<>"']+/);
    if (m) raw = m[0];
  }
  const notes: string[] = [];
  if (!raw) {
    if (text.length < 15) throw new UserError("no_input", "Paste a recipe link or the recipe text.");
    const { out, model } = await grokExtract(`Recipe text pasted by the user:\n\n${text.slice(0, 20000)}`);
    const ing = out.found ? tidy(out.ingredients) : [];
    if (!ing.length) throw new UserError("no_ingredients", "Couldn’t find ingredients in that text.");
    return { title: out.title || "Pasted recipe", servings: out.servings || "", source_url: null, source_kind: "text", method: "ai-text", model, ingredients: ing, notes };
  }
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let u: URL;
  try {
    u = new URL(raw);
  } catch (_) {
    throw new UserError("bad_url", "That doesn’t look like a link.");
  }
  if (isPrivateHost(u.hostname)) throw new UserError("bad_url", "That link can’t be opened.");

  const id = ytId(u);
  if (id) {
    const yt = await youtube(id, raw);
    notes.push(...yt.notes);
    if (!yt.description || yt.weak) {
      const b = await grokBrowse(`https://www.youtube.com/watch?v=${id}`, "youtube");
      if (b) {
        yt.description = b;
        yt.links = [...new Set(((b.match(/https?:\/\/[^\s)<>"'\]]+/g) || []) as string[]).map((s: string) => s.replace(/[.,!?;:]+$/, "")))];
        notes.push("description_via_grok");
      }
    }
    // A recipe link in the description is usually the most accurate source.
    let linked: { url: string; title: string; servings: string; lines: string[] } | null = null;
    let linkedText: { url: string; text: string } | null = null;
    const blocked: string[] = [];
    const candidates = yt.links.filter((l) => !SKIP_LINK.test(l)).slice(0, 4);
    const pages = await Promise.all(candidates.map((l) => readWeb(l).catch(() => null)));
    for (let k = 0; k < candidates.length; k++) {
      const l = candidates[k];
      const w = pages[k];
      if (!w) {
        if (/recipe|cook|kitchen|food|eat/i.test(l)) blocked.push(l);
        continue;
      }
      const rec = jsonLdRecipe(w.html);
      if (rec && rec.lines.length >= 2) {
        linked = { url: w.url, title: rec.title, servings: rec.servings, lines: rec.lines };
        break;
      }
      if (!linkedText && /ingredient/i.test(w.html)) {
        const t = cleanText(w.html, 6000);
        if (/ingredient/i.test(t)) linkedText = { url: w.url, text: t };
      }
    }
    const build = () =>
      [
        `YouTube video title: ${yt.title}`,
        yt.author ? `Channel: ${yt.author}` : "",
        linked ? `Recipe page linked from the description (${linked.url}), "${linked.title}" ingredient lines:\n${linked.lines.join("\n")}` : "",
        yt.description ? `Video description:\n${yt.description.slice(0, 8000)}` : "",
        !linked && linkedText ? `Page linked from the description (${linkedText.url}) text:\n${linkedText.text}` : "",
        yt.transcript ? `Transcript (auto captions, may be noisy):\n${yt.transcript}` : "",
        linked ? "Prefer the linked recipe page ingredient lines when they match the video." : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    if (!yt.description && !yt.transcript && !linked && !yt.title) {
      throw new UserError("unreadable", "Couldn’t read that YouTube video. Paste the recipe text or the ingredients instead.");
    }
    let { out, model } = await grokExtract(build());
    let ing = out.found ? tidy(out.ingredients) : [];
    if (!ing.length && !linked && blocked.length) {
      // Description only points at a recipe page that blocks our server: let Grok read it.
      const b = await grokBrowse(blocked[0], "web");
      if (b) {
        linkedText = { url: blocked[0], text: b };
        ({ out, model } = await grokExtract(build()));
        ing = out.found ? tidy(out.ingredients) : [];
      }
    }
    if (!ing.length) {
      throw new UserError(
        "no_ingredients",
        yt.description
          ? "That video doesn’t list the ingredients in its description" + (yt.transcript ? " or captions" : "") + ". Paste the recipe text instead."
          : "Couldn’t read that video’s description. Paste the recipe text instead.",
      );
    }
    return {
      title: out.title || yt.title || "YouTube recipe",
      servings: out.servings || linked?.servings || "",
      source_url: raw,
      source_kind: "youtube",
      method: ["ai", linked ? "linked-recipe" : linkedText ? "linked-page" : "", yt.description ? "description" : "", yt.transcript ? "captions" : ""].filter(Boolean).join("+"),
      linked_url: linked?.url || linkedText?.url || null,
      model,
      ingredients: ing,
      notes,
    };
  }

  const sk = socialKind(u);
  if (sk) {
    const s = await social(sk, raw);
    const rec = s.html ? jsonLdRecipe(s.html) : null;
    let body = rec ? rec.lines.join("\n") : s.text;
    let method = "ai-social";
    if ((!body || body.replace(/\s+/g, " ").length < 60) && (sk === "x" || sk === "threads" || sk === "pinterest")) {
      const b = await grokBrowse(raw, sk === "x" ? "x" : "web");
      if (b) {
        body = b;
        method = "ai-browse";
      }
    }
    const label = sk === "x" ? "X" : sk.charAt(0).toUpperCase() + sk.slice(1);
    if (!body || body.replace(/\s+/g, " ").length < 25) {
      throw new UserError("unreadable", `Couldn’t read that ${label} post (it may be private or need a login). Paste the recipe text instead.`);
    }
    const { out, model } = await grokExtract(`Social media post (${sk}) ${s.title ? `"${s.title}"` : ""}:\n\n${body.slice(0, 12000)}`);
    const ing = out.found ? tidy(out.ingredients) : [];
    if (!ing.length) throw new UserError("no_ingredients", `That ${label} post doesn’t list ingredients we could read. Paste the recipe text instead.`);
    return { title: out.title || s.title || "Recipe", servings: out.servings || "", source_url: raw, source_kind: sk, method, model, ingredients: ing, notes };
  }

  // Generic web page
  const w = await readWeb(raw);
  if (w) {
    const rec = jsonLdRecipe(w.html);
    const pageTitle = titleOf(w.html);
    if (rec) {
      try {
        const { out, model } = await grokExtract(
          `Recipe "${rec.title || pageTitle}"${rec.servings ? ` (yield: ${rec.servings})` : ""}. Ingredient lines from the page's structured recipe data:\n${rec.lines.join("\n")}`,
        );
        const ing = tidy(out.ingredients);
        if (ing.length) {
          return { title: rec.title || out.title || pageTitle, servings: rec.servings || out.servings || "", source_url: w.url, source_kind: "web", method: "jsonld+ai", model, ingredients: ing, notes };
        }
      } catch (e) {
        notes.push("ai_failed:" + String(e).slice(0, 80));
      }
      return { title: rec.title || pageTitle, servings: rec.servings, source_url: w.url, source_kind: "web", method: "jsonld", model: null, ingredients: tidy(rec.lines.map(naiveParse)), notes };
    }
    const txt = cleanText(w.html);
    if (txt.length >= 80) {
      const { out, model } = await grokExtract(`Web page "${pageTitle}" (${w.url}) text:\n\n${txt}`);
      const ing = out.found ? tidy(out.ingredients) : [];
      if (ing.length) return { title: out.title || pageTitle || "Recipe", servings: out.servings || "", source_url: w.url, source_kind: "web", method: "ai-page", model, ingredients: ing, notes };
    }
  }
  // Blocked, JavaScript-only, or no recipe found in the raw HTML: have Grok open the page itself.
  const b = await grokBrowse(raw, "web");
  if (!b) {
    throw new UserError(
      w ? "no_ingredients" : "fetch_failed",
      w ? "Couldn’t find a recipe on that page. Paste the recipe text instead." : "That site wouldn’t let us read the page. Paste the recipe text instead.",
    );
  }
  const { out, model } = await grokExtract(`Recipe page ${raw}, as read by a browsing assistant:\n\n${b}`);
  const ing = out.found ? tidy(out.ingredients) : [];
  if (!ing.length) throw new UserError("no_ingredients", "Couldn’t find a recipe on that page. Paste the recipe text instead.");
  return { title: out.title || "Recipe", servings: out.servings || "", source_url: raw, source_kind: "web", method: "ai-browse", model, ingredients: ing, notes };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });
  const t0 = Date.now();
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user) return json(req, 401, { error: "invalid_session", message: "Please sign in again." });
  const email = (u.user.email || "").toLowerCase();
  const { data: mem } = await admin.from("lh_members").select("household_id").or(`user_id.eq.${u.user.id},email.ilike.${email}`).limit(1);
  if (!mem?.[0]?.household_id) return json(req, 403, { error: "not_a_household_member", message: "Not on this household." });
  const body = await req.json().catch(() => ({}));
  TRACE = [];
  const dbg = () => (body.debug ? { trace: TRACE } : {});
  try {
    const res = await importRecipe(body);
    return json(req, 200, { ...res, ms: Date.now() - t0, ...dbg() });
  } catch (e) {
    if (e instanceof UserError) return json(req, 200, { error: e.code, message: e.message, ms: Date.now() - t0, ...dbg() });
    console.error("lh-recipe-import", String(e));
    return json(req, 200, {
      error: "failed",
      message: /abort|timed? ?out/i.test(String(e)) ? "That took too long. Try again, or paste the recipe text." : "Couldn’t read that recipe. Try again, or paste the recipe text.",
      detail: String(e).slice(0, 200),
      ms: Date.now() - t0,
      ...dbg(),
    });
  }
});
