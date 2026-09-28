// lh-agent-api: household list/wishlist for AI agents (Grok, ChatGPT, Claude, …).
// Auth: Authorization: Bearer lh_...  (verify_jwt MUST be OFF)
// Deploy: supabase functions deploy lh-agent-api --project-ref dphkvcdohqsvefbdhsfx --no-verify-jwt
// Secrets: none extra. Uses auto-injected SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const PROJECT_REF = "dphkvcdohqsvefbdhsfx";
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const hub = admin.schema("list_hub");

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(req: Request, status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

function text(req: Request, status: number, body: string, type: string) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders(req), "Content-Type": type },
  });
}

function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

function rateLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 2000) {
    for (const [k, arr] of hits) {
      if (!arr.length || now - arr[arr.length - 1] > RATE_WINDOW_MS) hits.delete(k);
    }
  }
  return recent.length > RATE_LIMIT;
}

async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearerToken(req: Request) {
  const raw = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

function routePath(req: Request) {
  const url = new URL(req.url);
  let path = url.pathname.replace(/\/+$/, "") || "/";
  const marker = "/lh-agent-api";
  const idx = path.lastIndexOf(marker);
  if (idx >= 0) path = path.slice(idx + marker.length) || "/";
  if (!path.startsWith("/")) path = "/" + path;
  return { url, path };
}

function apiBase(req: Request) {
  const url = new URL(req.url);
  const marker = "/lh-agent-api";
  const idx = url.pathname.lastIndexOf(marker);
  const prefix = idx >= 0 ? url.pathname.slice(0, idx + marker.length) : "/functions/v1/lh-agent-api";
  return `${url.origin}${prefix}`;
}

type AgentToken = { id: string; household_id: string; name: string };

async function authAgent(req: Request): Promise<{ token: AgentToken } | { error: Response }> {
  const raw = bearerToken(req);
  if (!raw || !raw.startsWith("lh_")) {
    return { error: json(req, 401, { error: "unauthorized", message: "Send Authorization: Bearer lh_… (create a token in List Hub → Menu → AI agents)." }) };
  }
  const hash = await sha256Hex(raw);
  const { data, error } = await hub
    .from("agent_tokens")
    .select("id, household_id, name, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) {
    console.error("lh-agent-api token lookup", error.message);
    return { error: json(req, 500, { error: "lookup_failed", message: "Could not check that token." }) };
  }
  if (!data || data.revoked_at) {
    return { error: json(req, 401, { error: "unauthorized", message: "Unknown or revoked agent token." }) };
  }
  hub.from("agent_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {}, () => {});
  return { token: { id: data.id, household_id: data.household_id, name: data.name } };
}

type ItemRow = {
  id: string;
  name: string;
  qty: string | null;
  notes: string | null;
  category: string | null;
  subsection: string | null;
  preferred_store_id: string | null;
  status: string;
  agent_state: string | null;
  agent_note: string | null;
  store_name: string | null;
};

function exportItem(row: ItemRow) {
  return {
    id: row.id,
    name: row.name,
    quantity: row.qty || null,
    note: row.notes || row.agent_note || null,
    section: row.category || null,
    subsection: row.subsection || null,
    preferred_store: row.store_name || null,
    agent_state: row.agent_state || null,
  };
}

function storeKey(name: string | null) {
  return name && name.trim() ? name.trim() : "Any store";
}

function sortExportItems(rows: ReturnType<typeof exportItem>[]) {
  const sectionOrder = [
    "Food",
    "Household",
    "Personal care",
    "Personal Care",
    "Health",
    "Pets",
    "Electronics",
    "Outdoor & Sports",
    "Clothing",
    "Auto",
    "Hardware",
    "Baby",
    "Other",
  ];
  const subOrder: Record<string, string[]> = {
    Food: ["Produce", "Meat & Seafood", "Deli", "Dairy & Eggs", "Bakery & Bread", "Breakfast & Cereal", "Pantry", "Snacks", "Beverages", "Frozen"],
    Household: ["Cleaning", "Paper & Plastic", "Laundry", "Kitchen", "Home & Garden", "Tools & Hardware"],
    "Personal Care": ["Health & Medicine", "Hygiene", "Beauty", "Baby"],
    "Personal care": ["Health & Medicine", "Hygiene", "Beauty", "Baby"],
    Electronics: ["Computers", "Accessories & Cables", "Audio & Video", "Smart Home"],
  };
  const si = (s: string | null) => {
    const i = sectionOrder.indexOf(s || "");
    return i < 0 ? 99 : i;
  };
  const subi = (section: string | null, sub: string | null) => {
    const list = subOrder[section || ""] || [];
    const i = list.indexOf(sub || "");
    return i < 0 ? 99 : i;
  };
  return rows.slice().sort((a, b) => {
    const sa = storeKey(a.preferred_store);
    const sb = storeKey(b.preferred_store);
    if (sa === "Any store" && sb !== "Any store") return 1;
    if (sb === "Any store" && sa !== "Any store") return -1;
    if (sa !== sb) return sa.localeCompare(sb);
    const sec = si(a.section) - si(b.section);
    if (sec) return sec;
    const sub = subi(a.section, a.subsection) - subi(b.section, b.subsection);
    if (sub) return sub;
    return a.name.localeCompare(b.name);
  });
}

function toMarkdown(kindLabel: string, rows: ReturnType<typeof exportItem>[]) {
  const items = sortExportItems(rows);
  const lines = [`# List Hub — ${kindLabel}`, ""];
  if (!items.length) {
    lines.push("_Nothing open._", "");
    return lines.join("\n");
  }
  let store = "";
  let section = "";
  let subsection = "";
  for (const item of items) {
    const nextStore = storeKey(item.preferred_store);
    if (nextStore !== store) {
      store = nextStore;
      section = "";
      subsection = "";
      lines.push(`## ${store}`, "");
    }
    const nextSection = item.section || "Other";
    if (nextSection !== section) {
      section = nextSection;
      subsection = "";
      lines.push(`### ${section}`, "");
    }
    const nextSub = item.subsection || "";
    if (nextSub && nextSub !== subsection) {
      subsection = nextSub;
      lines.push(`#### ${subsection}`, "");
    }
    const qtyNote = [item.quantity, item.note].filter(Boolean).join(" · ");
    const state = item.agent_state ? ` (${item.agent_state.replace("_", " ")})` : "";
    lines.push(`- [ ] ${item.name}${qtyNote ? ` — ${qtyNote}` : ""}${state}  \`${item.id}\``);
  }
  lines.push("");
  return lines.join("\n");
}

function csvCell(value: unknown) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: ReturnType<typeof exportItem>[]) {
  const items = sortExportItems(rows);
  const header = ["id", "name", "quantity", "note", "section", "subsection", "preferred_store", "agent_state"];
  const lines = [header.join(",")];
  for (const item of items) {
    lines.push(
      [
        item.id,
        item.name,
        item.quantity,
        item.note,
        item.section,
        item.subsection,
        item.preferred_store,
        item.agent_state,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}

async function loadOpenItems(householdId: string, wish: boolean) {
  const { data: lists, error: le } = await hub
    .from("lists")
    .select("id, kind, status")
    .eq("household_id", householdId)
    .neq("status", "archived");
  if (le) throw le;
  const listIds = (lists || [])
    .filter((row: { kind: string }) => (wish ? row.kind === "wish" : row.kind !== "wish"))
    .map((row: { id: string }) => row.id);
  if (!listIds.length) return [];
  const { data: items, error: ie } = await hub
    .from("items")
    .select("id, name, qty, notes, category, subsection, preferred_store_id, status, agent_state, agent_note")
    .in("list_id", listIds)
    .eq("status", "needed")
    .order("created_at", { ascending: true });
  if (ie) throw ie;
  const storeIds = [...new Set((items || []).map((row: { preferred_store_id: string | null }) => row.preferred_store_id).filter(Boolean))];
  let storeNames: Record<string, string> = {};
  if (storeIds.length) {
    const { data: stores } = await hub.from("stores").select("id, name").in("id", storeIds);
    storeNames = Object.fromEntries((stores || []).map((s: { id: string; name: string }) => [s.id, s.name]));
  }
  return (items || []).map((row: ItemRow) =>
    exportItem({
      ...row,
      store_name: row.preferred_store_id ? storeNames[row.preferred_store_id] || null : null,
    }),
  );
}

function formatPayload(kind: "list" | "wishlist", format: string, rows: ReturnType<typeof exportItem>[]) {
  const label = kind === "wishlist" ? "Wishlist" : "List";
  if (format === "markdown" || format === "md") return { kind: "text", body: toMarkdown(label, rows), type: "text/markdown; charset=utf-8" };
  if (format === "csv") return { kind: "text", body: toCsv(rows), type: "text/csv; charset=utf-8" };
  return {
    kind: "json",
    body: {
      kind,
      status: "open",
      generated_at: new Date().toISOString(),
      count: rows.length,
      items: sortExportItems(rows),
    },
  };
}

async function resolveStore(householdId: string, store: string | null) {
  const q = String(store || "").trim();
  if (!q) return null;
  const { data: stores } = await hub.from("stores").select("id, name, slug").eq("household_id", householdId);
  const lower = q.toLowerCase();
  const hit = (stores || []).find(
    (s: { id: string; name: string; slug: string }) => s.id === q || s.name.toLowerCase() === lower || s.slug === lower,
  );
  return hit || null;
}

async function updateItemStatus(householdId: string, itemId: string, body: { status?: string; store?: string; note?: string }) {
  const status = String(body.status || "").trim().toLowerCase();
  if (!["in_cart", "bought", "unavailable"].includes(status)) {
    return { code: 400, body: { error: "bad_status", message: "status must be in_cart, bought, or unavailable." } };
  }
  const { data: item, error } = await hub
    .from("items")
    .select("id, list_id, name, status, preferred_store_id, notes, agent_state, agent_note")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  if (!item) return { code: 404, body: { error: "not_found", message: "No item with that id." } };
  const { data: list } = await hub.from("lists").select("id, household_id").eq("id", item.list_id).maybeSingle();
  if (!list || list.household_id !== householdId) {
    return { code: 404, body: { error: "not_found", message: "No item with that id on this household." } };
  }
  const store = await resolveStore(householdId, body.store || null);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 240) : "";
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now, agent_note: note || item.agent_note || null };
  if (store) patch.preferred_store_id = store.id;
  if (status === "bought") {
    // Check-off: existing items_record_purchase trigger records the purchase.
    patch.status = "checked";
    patch.bought_at = now;
    patch.agent_state = null;
  } else {
    patch.agent_state = status;
  }
  const { data: updated, error: ue } = await hub.from("items").update(patch).eq("id", itemId).select("id, name, status, preferred_store_id, agent_state, agent_note, qty, notes, category, subsection").maybeSingle();
  if (ue) throw ue;
  return {
    code: 200,
    body: {
      ok: true,
      id: itemId,
      status,
      mapped_status: status === "bought" ? "checked" : item.status,
      agent_state: status === "bought" ? null : status,
      store: store ? store.name : null,
      item: updated,
    },
  };
}

function openApiSpec(req: Request) {
  const base = apiBase(req);
  return {
    openapi: "3.1.0",
    info: {
      title: "List Hub Agent API",
      version: "1.0.0",
      description:
        "Read the Pollock household grocery List and Wishlist, then mark items in_cart / bought / unavailable after filling a store cart. Authenticate with a household agent token (prefix lh_).",
    },
    servers: [{ url: base, description: "List Hub agent API" }],
    security: [{ AgentToken: [] }],
    tags: [{ name: "list" }, { name: "wishlist" }, { name: "items" }],
    paths: {
      "/list": {
        get: {
          tags: ["list"],
          summary: "Open grocery list",
          description: "Open List items (status=needed). Markdown is grouped by preferred store, then section, then subsection.",
          parameters: [
            {
              name: "format",
              in: "query",
              schema: { type: "string", enum: ["json", "markdown", "csv"], default: "json" },
            },
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["open"], default: "open" },
            },
          ],
          responses: {
            "200": {
              description: "Open list items",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ItemList" } },
                "text/markdown": { schema: { type: "string" } },
                "text/csv": { schema: { type: "string" } },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "429": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/wishlist": {
        get: {
          tags: ["wishlist"],
          summary: "Open wishlist",
          parameters: [
            {
              name: "format",
              in: "query",
              schema: { type: "string", enum: ["json", "markdown", "csv"], default: "json" },
            },
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["open"], default: "open" },
            },
          ],
          responses: {
            "200": {
              description: "Open wishlist items",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/ItemList" } },
                "text/markdown": { schema: { type: "string" } },
                "text/csv": { schema: { type: "string" } },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/items/{id}/status": {
        post: {
          tags: ["items"],
          summary: "Mark agent progress",
          description:
            "in_cart = added to a store cart (item stays on the list). bought = checked off (records a purchase). unavailable = store did not have it (item stays on the list).",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/StatusBody" } },
            },
          },
          responses: {
            "200": { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/StatusResult" } } } },
            "400": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/openapi.json": {
        get: {
          tags: ["list"],
          summary: "This OpenAPI document",
          security: [],
          responses: { "200": { description: "OpenAPI 3.1" } },
        },
      },
    },
    components: {
      securitySchemes: {
        AgentToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "lh_",
          description: "Household agent token from List Hub → Menu → AI agents. Prefix lh_.",
        },
      },
      schemas: {
        Item: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            quantity: { type: ["string", "null"] },
            note: { type: ["string", "null"] },
            section: { type: ["string", "null"] },
            subsection: { type: ["string", "null"] },
            preferred_store: { type: ["string", "null"] },
            agent_state: { type: ["string", "null"], enum: ["in_cart", "unavailable", null] },
          },
        },
        ItemList: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["list", "wishlist"] },
            status: { type: "string", enum: ["open"] },
            generated_at: { type: "string", format: "date-time" },
            count: { type: "integer" },
            items: { type: "array", items: { $ref: "#/components/schemas/Item" } },
          },
        },
        StatusBody: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["in_cart", "bought", "unavailable"] },
            store: { type: "string", description: "Store name, slug, or id" },
            note: { type: "string" },
          },
        },
        StatusResult: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            id: { type: "string" },
            status: { type: "string" },
            mapped_status: { type: "string" },
            agent_state: { type: ["string", "null"] },
            store: { type: ["string", "null"] },
          },
        },
        Error: {
          type: "object",
          properties: { error: { type: "string" }, message: { type: "string" } },
        },
      },
      responses: {
        Error: {
          description: "Error",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  const { url, path } = routePath(req);
  if (rateLimited("ip:" + clientIp(req))) {
    return json(req, 429, { error: "rate_limited", message: "Too many requests. Try again in a minute." }, { "Retry-After": "60" });
  }
  try {
    if (req.method === "GET" && (path === "/openapi.json" || path === "/openapi")) {
      return json(req, 200, openApiSpec(req));
    }

    const authed = await authAgent(req);
    if ("error" in authed) return authed.error;
    if (rateLimited("tok:" + authed.token.id)) {
      return json(req, 429, { error: "rate_limited", message: "Too many requests for this token. Try again in a minute." }, { "Retry-After": "60" });
    }

    if (req.method === "GET" && (path === "/list" || path === "/wishlist")) {
      const format = (url.searchParams.get("format") || "json").toLowerCase();
      const status = (url.searchParams.get("status") || "open").toLowerCase();
      if (status !== "open") {
        return json(req, 400, { error: "bad_status", message: "Only status=open is supported." });
      }
      if (!["json", "markdown", "md", "csv"].includes(format)) {
        return json(req, 400, { error: "bad_format", message: "format must be json, markdown, or csv." });
      }
      const kind = path === "/wishlist" ? "wishlist" : "list";
      const rows = await loadOpenItems(authed.token.household_id, kind === "wishlist");
      const payload = formatPayload(kind, format, rows);
      if (payload.kind === "text") return text(req, 200, payload.body as string, payload.type as string);
      return json(req, 200, payload.body);
    }

    const statusMatch = path.match(/^\/items\/([0-9a-f-]{36})\/status$/i);
    if (req.method === "POST" && statusMatch) {
      const body = await req.json().catch(() => ({}));
      const result = await updateItemStatus(authed.token.household_id, statusMatch[1], body || {});
      return json(req, result.code, result.body);
    }

    if (path === "/" || path === "") {
      return json(req, 200, {
        name: "List Hub Agent API",
        docs: apiBase(req) + "/openapi.json",
        endpoints: ["GET /list", "GET /wishlist", "POST /items/{id}/status", "GET /openapi.json"],
      });
    }

    return json(req, 404, { error: "not_found", message: `No endpoint ${req.method} ${path}. See GET /openapi.json.` });
  } catch (err) {
    console.error("lh-agent-api", String(err));
    return json(req, 500, { error: "failed", message: "Something went wrong.", detail: String(err).slice(0, 200) });
  }
});

void PROJECT_REF;
