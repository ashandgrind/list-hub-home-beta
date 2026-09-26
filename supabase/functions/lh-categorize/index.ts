// lh-categorize: two-level auto-category for List Hub via xAI.
// Returns legacy `category` (old client) plus section + subsection (new client).
// Cache writes keep `category` as the legacy section so the deployed app
// keeps working if this function is shipped before the SQL migration.
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const LEGACY = ["Food", "Household", "Personal care", "Health", "Electronics", "Pets", "Baby", "Hardware", "Clothing", "Other"];
const SECTIONS = ["Food", "Household", "Personal Care", "Pets", "Electronics", "Outdoor & Sports", "Clothing", "Auto", "Other"];
const SUBS: Record<string, string[]> = {
  Food: ["Produce", "Meat & Seafood", "Deli", "Dairy & Eggs", "Bakery & Bread", "Breakfast & Cereal", "Pantry", "Snacks", "Beverages", "Frozen"],
  Household: ["Cleaning", "Paper & Plastic", "Laundry", "Kitchen", "Home & Garden", "Tools & Hardware"],
  "Personal Care": ["Health & Medicine", "Hygiene", "Beauty", "Baby"],
  Pets: [""],
  Electronics: ["Computers", "Accessories & Cables", "Audio & Video", "Smart Home"],
  "Outdoor & Sports": [""],
  Clothing: [""],
  Auto: [""],
  Other: [""],
};
const ALL_SUBS = Object.entries(SUBS).flatMap(([sec, list]) => list.filter(Boolean).map((sub) => ({ sec, sub })));
const MODELS = (Deno.env.get("LH_CAT_MODELS") || "grok-4.20-non-reasoning,grok-4-1-fast-non-reasoning,grok-4.3").split(",");
const ORIGINS = [
  "https://list-hub-live.vercel.app",
  "https://pollock-lists.vercel.app",
  "https://list-hub-home-beta.vercel.app",
  "https://hq.cruxibl.com",
  "https://cruxibl.com",
  "https://lh.test",
];

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
const key = (s: string) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120);

function legacyOf(section: string, subsection: string) {
  if (subsection === "Baby") return "Baby";
  if (subsection === "Health & Medicine") return "Health";
  if (subsection === "Tools & Hardware") return "Hardware";
  if (section === "Outdoor & Sports" || section === "Auto") return "Hardware";
  if (section === "Personal Care") return "Personal care";
  if (LEGACY.includes(section)) return section;
  return "Other";
}

function normalize(section: string, subsection: string) {
  const subHit = ALL_SUBS.find((x) => x.sub === subsection);
  const sec = subHit?.sec || (SECTIONS.includes(section) ? section : section === "Personal care" ? "Personal Care" : "Other");
  const allowed = SUBS[sec] || [""];
  const sub = allowed.includes(subsection) ? subsection : allowed[0] || "";
  return { section: sec, subsection: sub, category: legacyOf(sec, sub) };
}

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

const SYS =
  "You categorize household shopping list items into a section and optional subsection (store aisle). " +
  "Sections/subsections: Food (Produce; Meat & Seafood; Deli; Dairy & Eggs; Bakery & Bread; Breakfast & Cereal; Pantry; Snacks; Beverages; Frozen), " +
  "Household (Cleaning; Paper & Plastic; Laundry; Kitchen; Home & Garden; Tools & Hardware), " +
  "Personal Care (Health & Medicine; Hygiene; Beauty; Baby), Pets, Electronics (Computers; Accessories & Cables; Audio & Video; Smart Home), " +
  "Outdoor & Sports, Clothing, Auto, Other. " +
  "Brand names count as their product (Tide=Household/Laundry, Duracell=Electronics/Accessories & Cables, Traeger=Outdoor & Sports). " +
  "Return one result per input item, same order. Use empty subsection for Pets, Outdoor & Sports, Clothing, Auto, Other.";

async function classify(names: string[], hints: (string | null)[]) {
  const schema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            section: { type: "string", enum: SECTIONS },
            subsection: { type: "string" },
          },
          required: ["name", "section", "subsection"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  };
  const user = names.map((n, i) => `${i + 1}. ${n}${hints[i] ? ` (product info: ${hints[i]})` : ""}`).join("\n");
  const models = goodModel ? [goodModel, ...MODELS.filter((m) => m !== goodModel)] : MODELS;
  let last = "";
  for (const model of models) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        signal: ctl.signal,
        headers: { Authorization: `Bearer ${XAI}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 80 + names.length * 40,
          messages: [
            { role: "system", content: SYS },
            { role: "user", content: user },
          ],
          response_format: { type: "json_schema", json_schema: { name: "categories", strict: true, schema } },
        }),
      });
      const t = await r.text();
      if (!r.ok) {
        last = `${model} ${r.status}: ${t.slice(0, 160)}`;
        if (r.status === 404 || r.status === 400) continue;
        throw new Error(last);
      }
      const out = JSON.parse(JSON.parse(t).choices?.[0]?.message?.content || "{}").items || [];
      goodModel = model;
      return {
        model,
        cats: names.map((_, i) => {
          const row = out[i] || {};
          return normalize(row.section || "Other", row.subsection || "");
        }),
      };
    } catch (e) {
      last = String(e).slice(0, 200);
      if (ctl.signal.aborted) break;
    } finally {
      clearTimeout(to);
    }
  }
  throw new Error(last || "classify_failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });
  const t0 = Date.now();
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user) return json(req, 401, { error: "invalid_session" });
  const email = (u.user.email || "").toLowerCase();
  const { data: mem } = await admin.from("lh_members").select("household_id").or(`user_id.eq.${u.user.id},email.ilike.${email}`).limit(1);
  const hh = mem?.[0]?.household_id;
  if (!hh) return json(req, 403, { error: "not_a_household_member" });
  const body = await req.json().catch(() => ({}));
  const items = (Array.isArray(body.items) ? body.items : [])
    .slice(0, 25)
    .map((x: any) => (typeof x === "string" ? { name: x } : x))
    .filter((x: any) => x && key(x.name));
  if (!items.length) return json(req, 400, { error: "no_items" });
  const keys = items.map((x: any) => key(x.name));
  let cachedRows: any[] | null = null;
  {
    const withSub = await admin.from("lh_category_cache").select("name_key,category,subsection,source").eq("household_id", hh).in("name_key", keys);
    if (withSub.error) {
      const legacy = await admin.from("lh_category_cache").select("name_key,category,source").eq("household_id", hh).in("name_key", keys);
      cachedRows = legacy.data || [];
    } else {
      cachedRows = withSub.data || [];
    }
  }
  const cmap = new Map((cachedRows || []).map((c: any) => [c.name_key, c]));
  const results: any[] = items.map((x: any, i: number) => {
    const c: any = cmap.get(keys[i]);
    if (!c?.category) return { name: x.name, name_key: keys[i], category: null, section: null, subsection: null, source: null };
    const n = normalize(c.category, c.subsection || "");
    return { name: x.name, name_key: keys[i], ...n, source: "cache" };
  });
  const todo = results.map((r, i) => (r.category ? -1 : i)).filter((i) => i >= 0);
  let model = null,
    err = null;
  if (todo.length) {
    await loadKey();
    if (!XAI) err = "ai_not_configured";
    else {
      try {
        const out = await classify(
          todo.map((i) => String(items[i].name).slice(0, 120)),
          todo.map((i) => (items[i].hint ? String(items[i].hint).slice(0, 160) : null)),
        );
        model = out.model;
        const up: any[] = [];
        todo.forEach((i, k) => {
          if (out.cats[k]) {
            Object.assign(results[i], out.cats[k], { source: "ai" });
            up.push({
              household_id: hh,
              name_key: keys[i],
              category: out.cats[k].category,
              subsection: out.cats[k].subsection || "",
              source: "ai",
              updated_at: new Date().toISOString(),
            });
          }
        });
        if (up.length) {
          const withSub = await admin.from("lh_category_cache").upsert(up, { onConflict: "household_id,name_key", ignoreDuplicates: true });
          if (withSub.error) {
            await admin.from("lh_category_cache").upsert(
              up.map(({ subsection: _s, ...row }) => row),
              { onConflict: "household_id,name_key", ignoreDuplicates: true },
            );
          }
        }
      } catch (e) {
        err = String(e).slice(0, 200);
      }
    }
  }
  return json(req, 200, { results, model, error: err, ms: Date.now() - t0 });
});
