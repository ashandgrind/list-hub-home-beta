// lh-transcribe: record-then-transcribe for List Hub voice add (Chrome on iPhone has no Web Speech).
// Auth: requires a signed-in Supabase user whose email/user_id is in list_hub.members (fallback public.lh_members).
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://list-hub-live.vercel.app",
  "https://pollock-lists.vercel.app",
  "https://cruxibl.com",
  "https://www.cruxibl.com",
  "https://listhub-hq.vercel.app",
  "https://hq.cruxibl.com",
  "https://lh.test",
];
const MAX_BYTES = 8 * 1024 * 1024;
const PROVIDERS = ["XAI_API_KEY", "OPENAI_API_KEY", "GROQ_API_KEY", "DEEPGRAM_API_KEY"] as const;

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.includes(o) || /^https:\/\/pollock-lists-[a-z0-9-]+\.vercel\.app$/.test(o) ? o : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}
// Keys: Edge Function secrets (env) first, else the xAI key stored in Supabase Vault (lh_xai_api_key, service_role-only RPC).
const KEYS: Record<string, string> = {};
let vaultAt = 0;
async function loadKeys() {
  for (const k of PROVIDERS) { const v = (Deno.env.get(k) || "").trim(); if (v) KEYS[k] = v; }
  if (!KEYS.XAI_API_KEY && Date.now() - vaultAt > 60_000) {
    vaultAt = Date.now();
    try {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
      const { data } = await admin.rpc("lh_stt_key_get");
      if (typeof data === "string" && data.trim()) KEYS.XAI_API_KEY = data.trim();
    } catch (_) { /* vault unavailable */ }
  }
}
function provider(): string | null {
  for (const k of PROVIDERS) if (KEYS[k]) return k;
  return null;
}
function extFor(type: string) {
  if (/mp4|m4a|aac/.test(type)) return "m4a";
  if (/webm/.test(type)) return "webm";
  if (/ogg/.test(type)) return "ogg";
  if (/wav/.test(type)) return "wav";
  if (/mpeg|mp3/.test(type)) return "mp3";
  return "m4a";
}
const PROMPT = "Grocery and household shopping list items, e.g. milk, 2 dozen eggs, isopropyl alcohol, paper towels.";

async function transcribe(audio: Blob, type: string): Promise<string> {
  const p = provider();
  if (p === "XAI_API_KEY") {
    const fd = new FormData();
    fd.append("language", "en");
    fd.append("format", "true");
    fd.append("file", new File([audio], "voice." + extFor(type), { type: type || "audio/mp4" }));
    const r = await fetch("https://api.x.ai/v1/stt", { method: "POST", headers: { Authorization: `Bearer ${KEYS[p]}` }, body: fd });
    const t = await r.text();
    if (!r.ok) throw new Error(`xai ${r.status}: ${t.slice(0, 300)}`);
    return (JSON.parse(t).text || "").trim();
  }
  if (p === "OPENAI_API_KEY" || p === "GROQ_API_KEY") {
    const groq = p === "GROQ_API_KEY";
    const fd = new FormData();
    fd.append("file", new File([audio], "voice." + extFor(type), { type: type || "audio/mp4" }));
    fd.append("model", groq ? "whisper-large-v3-turbo" : (Deno.env.get("OPENAI_STT_MODEL") || "gpt-4o-mini-transcribe"));
    fd.append("language", "en");
    fd.append("prompt", PROMPT);
    fd.append("response_format", "json");
    const url = groq ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions";
    const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${KEYS[p]}` }, body: fd });
    const t = await r.text();
    if (!r.ok) throw new Error(`${groq ? "groq" : "openai"} ${r.status}: ${t.slice(0, 300)}`);
    return (JSON.parse(t).text || "").trim();
  }
  if (p === "DEEPGRAM_API_KEY") {
    const r = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&language=en-US", {
      method: "POST",
      headers: { Authorization: `Token ${KEYS[p]}`, "Content-Type": type || "audio/mp4" },
      body: audio,
    });
    const t = await r.text();
    if (!r.ok) throw new Error(`deepgram ${r.status}: ${t.slice(0, 300)}`);
    const j = JSON.parse(t);
    return (j?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "").trim();
  }
  throw new Error("stt_not_configured");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  await loadKeys();
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.has("probe")) {
    // presence only (never values): lets the client skip recording when STT isn't set up
    return json(req, 200, { ok: true, configured: !!provider(), provider: provider()?.replace("_API_KEY", "").toLowerCase() || null });
  }
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(req, 401, { error: "not_signed_in" });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user) return json(req, 401, { error: "invalid_session" });
  const email = (u.user.email || "").toLowerCase();
  let member = false;
  for (const [schema, table] of [["list_hub", "members"], ["public", "lh_members"]]) {
    const q = await admin.schema(schema).from(table).select("email,user_id").or(`user_id.eq.${u.user.id},email.ilike.${email}`).limit(1);
    if (!q.error) { member = (q.data || []).length > 0; if (member) break; }
  }
  if (!member) return json(req, 403, { error: "not_a_household_member" });

  if (!provider()) return json(req, 503, { error: "stt_not_configured", need: "XAI_API_KEY or OPENAI_API_KEY (or GROQ_API_KEY / DEEPGRAM_API_KEY)" });

  let audio: Blob | null = null; let type = "";
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) {
    const fd = await req.formData();
    const f = fd.get("audio");
    if (f instanceof File) { audio = f; type = f.type || String(fd.get("type") || ""); }
  } else {
    audio = await req.blob(); type = ct;
  }
  if (!audio || audio.size < 200) return json(req, 400, { error: "no_audio" });
  if (audio.size > MAX_BYTES) return json(req, 413, { error: "audio_too_large" });
  try {
    const text = await transcribe(audio, type.split(";")[0]);
    return json(req, 200, { text, provider: provider()?.replace("_API_KEY", "").toLowerCase() });
  } catch (e) {
    console.error("stt failed", String(e));
    return json(req, 502, { error: "stt_failed", detail: String(e).slice(0, 200) });
  }
});
