// lh-product-lookup: server-side barcode lookup for List Hub (UPCitemdb has no browser CORS).
// Auth: signed-in Supabase user in list_hub.members (fallback public.lh_members). No guessing: only real database hits.
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = ["https://list-hub-live.vercel.app", "https://pollock-lists.vercel.app", "https://lh.test"];
function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.includes(o) || /^https:\/\/pollock-lists-[a-z0-9-]+\.vercel\.app$/.test(o) ? o : ALLOWED_ORIGINS[0];
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin" };
}
function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

async function upcitemdb(code: string) {
  const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, { headers: { Accept: "application/json", "User-Agent": "ListHubHomeBeta/1.0" } });
  const t = await r.text();
  let j: any = {}; try { j = JSON.parse(t); } catch (_) { /* ignore */ }
  if (r.status === 429 || j.code === "EXCEED_LIMIT" || j.code === "TOO_FAST") return { found: false, reason: "upcitemdb_rate_limited" };
  const it = j?.items?.[0];
  if (!r.ok || !it) return { found: false, reason: `upcitemdb_${j.code || r.status}` };
  return { found: true, name: String(it.title || "").trim(), brand: String(it.brand || "").trim(), quantity: String(it.size || "").trim(), source: "upcitemdb" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const code = (new URL(req.url).searchParams.get("code") || "").replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) return json(req, 400, { found: false, error: "bad_code" });
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user) return json(req, 401, { found: false, error: "invalid_session" });
  const email = (u.user.email || "").toLowerCase();
  let member = false;
  for (const [schema, table] of [["list_hub", "members"], ["public", "lh_members"]]) {
    const q = await admin.schema(schema).from(table).select("email").or(`user_id.eq.${u.user.id},email.ilike.${email}`).limit(1);
    if (!q.error) { member = (q.data || []).length > 0; if (member) break; }
  }
  if (!member) return json(req, 403, { found: false, error: "not_a_household_member" });
  try {
    const r = await upcitemdb(code);
    return json(req, 200, { code, ...r });
  } catch (e) {
    return json(req, 200, { code, found: false, reason: "lookup_error", detail: String(e).slice(0, 120) });
  }
});
