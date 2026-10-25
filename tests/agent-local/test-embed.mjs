// Read-only embed tokens (TV / kiosk widget) against the local stack (never production).
// Run: node tests/agent-local/test-embed.mjs   (exit 1 if any check fails)
// Uses throwaway local tokens only and never prints token values.
import { createHash, randomBytes } from "node:crypto";
import { startStack, TOKEN, IDS, ANON_JWT, memberJwt, userJwt } from "./stack.mjs";

const results = [];
async function check(name, fn) {
  try { await fn(); results.push([name, "PASS", ""]); }
  catch (err) { results.push([name, "FAIL", String(err && err.message || err).split("\n")[0].slice(0, 240)]); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const sha = (t) => createHash("sha256").update(t).digest("hex");
const scrub = (s) => String(s).replace(/\blhe?_[A-Za-z0-9_-]{20,}/g, "[token]");
const redact = (v) => scrub(JSON.stringify(v, (k, x) => (k === "token" ? "[redacted]" : x)));

const s = await startStack({ port: Number(process.env.EMBED_STACK_PORT || 54490) });
const one = (q) => s.sql(q);
const rest = (path, { method = "GET", body, jwt = ANON_JWT, bearer } = {}) =>
  fetch(`${s.base}/rest/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${bearer || jwt}`, apikey: ANON_JWT, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
const rpc = (name, args = {}, jwt = ANON_JWT) => rest(`/rpc/${name}`, { method: "POST", body: args, jwt });
const ok = (r, what) => { assert(r.status >= 200 && r.status < 300, `${what}: HTTP ${r.status} ${redact(r.json).slice(0, 200)}`); return r.json; };
const embed = async (token) => ok(await rpc("lh_embed_list", { p_token: token }), "lh_embed_list");
const api = (path, token, method = "GET", body) =>
  fetch(`${s.apiBase}${path}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, text: await r.text() }));

const chris = memberJwt("chris"), ellen = memberJwt("ellen");
const OUTSIDER = { id: "c0000000-0000-4000-8000-0000000000d9", email: "outsider@example.test" };
const itemCount = () => one(`select count(*)||'|'||coalesce(string_agg(name||':'||status, ',' order by name), '') from list_hub.items`);

let tok = null, otherTok = null, tokId = null;
try {
  console.log(`local db ${s.db}; migrations: ${s.applied.map((f) => f.split("/").pop()).join(", ")}`);
  one(`insert into auth.users (id, email) values ('${OUTSIDER.id}', '${OUTSIDER.email}')`);
  // A realistic List: sections, a cache-only category, a store, a quantity, notes, a discreet item,
  // a checked-off item, a Wishlist item, and another household's item.
  one(`
    insert into list_hub.items (list_id, name, status, category, subsection, qty, notes, preferred_store_id, discreet, created_by, created_at) values
      ('${IDS.needs}', 'Bananas', 'needed', 'Food', null, '6', 'NOTE-ripe-ones-please', null, false, 'Chris', now() - interval '5 minutes'),
      ('${IDS.needs}', 'Paper towels', 'needed', null, null, '2 packs', null, '${IDS.costco}', false, 'Ellen', now() - interval '4 minutes'),
      ('${IDS.needs}', 'Dog food', 'needed', 'Pets', null, null, null, '${IDS.publix}', false, 'Chris', now() - interval '3 minutes'),
      ('${IDS.needs}', 'Private thing', 'needed', 'Health', null, null, null, null, true, 'Chris', now() - interval '2 minutes'),
      ('${IDS.needs}', 'Already bought', 'have', 'Food', null, null, null, null, false, 'Chris', now() - interval '1 minutes'),
      ('${IDS.wish}', 'Kayak', 'needed', null, null, null, null, null, false, 'Chris', now()),
      ('${IDS.otherNeeds}', 'Other home oat milk', 'needed', 'Food', null, null, null, null, false, 'Someone', now());
    insert into list_hub.category_cache (household_id, name_key, category, subsection, source) values
      ('${IDS.household}', 'paper towels', 'Household', 'Paper & wraps', 'ai');
  `);

  await check("member can create a read-only embed token (lhe_, shown once, only the SHA-256 stored)", async () => {
    const r = ok(await rpc("lh_create_embed_token", { p_label: "Kitchen TV" }, chris), "create");
    tok = r.token; tokId = r.id;
    assert(typeof tok === "string" && /^lhe_[A-Za-z0-9_-]{40,}$/.test(tok), "token shape");
    assert(r.label === "Kitchen TV" && r.created_by === "Chris", `reply ${redact(r)}`);
    assert(one(`select count(*) from list_hub.embed_tokens where id='${tokId}' and token_hash='${sha(tok)}' and household_id='${IDS.household}'`) === "1", "hash row missing");
    assert(one(`select count(*) from list_hub.embed_tokens where row_to_json(embed_tokens)::text like '%${tok.slice(4, 24)}%'`) === "0", "plain token stored");
    assert(one(`select count(*) from list_hub.agent_tokens where token_hash='${sha(tok)}'`) === "0", "landed in agent_tokens");
  });

  await check("valid embed token renders the main List by section (name, quantity, store, section, subsection only)", async () => {
    const d = await embed(tok);
    assert(d.status === "ok" && d.household === "Test Home", `status ${d.status} household ${d.household}`);
    const names = d.items.map((i) => i.name);
    for (const n of ["Eggs", "Bananas", "Paper towels", "Dog food"]) assert(names.includes(n), `missing ${n} in ${names}`);
    for (const n of ["Private thing", "Already bought", "Kayak", "Camping chair", "Other home oat milk"]) assert(!names.includes(n), `leaked ${n}`);
    const allowed = ["name", "quantity", "store", "section", "subsection", "pinned"].sort().join(",");
    for (const i of d.items) assert(Object.keys(i).sort().join(",") === allowed, `keys ${Object.keys(i)}`);
    const pt = d.items.find((i) => i.name === "Paper towels");
    assert(pt.section === "Household" && pt.subsection === "Paper & wraps" && pt.store === "Costco" && pt.quantity === "2 packs", `paper towels ${JSON.stringify(pt)}`);
    assert(d.items.find((i) => i.name === "Bananas").quantity === "6", "qty");
    const raw = JSON.stringify(d);
    assert(!/NOTE-ripe/.test(raw), "notes leaked");
    assert(!/@example\.test/.test(raw), "email leaked");
    assert(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(raw), "an id leaked");
    assert(!/"(Chris|Ellen)"/.test(raw), "a member name leaked");
    assert(one(`select last_used_at is not null from list_hub.embed_tokens where id='${tokId}'`) === "t", "last_used_at not stamped");
  });

  await check("members list tokens (label, never the token or hash); Ellen sees Chris's token", async () => {
    const l = ok(await rpc("lh_list_embed_tokens", {}, ellen), "list");
    const row = l.find((t) => t.id === tokId);
    assert(row && row.label === "Kitchen TV", `rows ${redact(l)}`);
    assert(!JSON.stringify(l).includes(tok.slice(4, 24)) && !JSON.stringify(l).includes(sha(tok)), "token or hash returned");
    assert(!("token" in row) && !("token_hash" in row), `keys ${Object.keys(row)}`);
  });

  await check("anon and non-members can't create, list, or revoke embed tokens, or read the table", async () => {
    assert((await rpc("lh_create_embed_token", { p_label: "x" })).status >= 400, "anon created");
    assert((await rpc("lh_list_embed_tokens", {})).status >= 400, "anon listed");
    assert((await rpc("lh_revoke_embed_token", { p_id: tokId })).status >= 400, "anon revoked");
    const out = userJwt(OUTSIDER.id, OUTSIDER.email);
    assert((await rpc("lh_create_embed_token", { p_label: "x" }, out)).status >= 400, "outsider created");
    assert((await rpc("lh_list_embed_tokens", {}, out)).status >= 400, "outsider listed");
    assert((await rpc("lh_revoke_embed_token", { p_id: tokId }, out)).status >= 400, "outsider revoked");
    assert((await rest("/embed_tokens")).status >= 400, "table exposed over REST");
    let anonRead = "read";
    try { anonRead = one(`set role anon; select count(*) from list_hub.embed_tokens`); } catch (e) { anonRead = /permission denied/.test(String(e.message)) ? "denied" : String(e.message); }
    assert(anonRead === "denied", `anon table read: ${anonRead}`);
    const authRows = one(`set role authenticated; set request.jwt.claims = '{"role":"authenticated","sub":"${IDS.chris}","email":"chris@example.test"}'; select count(*) from list_hub.embed_tokens`);
    assert(authRows === "0", `a signed-in member read ${authRows} raw token rows`);
  });

  await check("embed token can't write: PostgREST refuses it as a bearer, nothing changes", async () => {
    const before = itemCount();
    const tries = [
      await rest("/lh_items", { method: "POST", bearer: tok, body: { list_id: IDS.needs, name: "Injected" } }),
      await rest(`/lh_items?id=eq.${IDS.memberItem}`, { method: "PATCH", bearer: tok, body: { status: "removed" } }),
      await rest(`/lh_items?id=eq.${IDS.memberItem}`, { method: "DELETE", bearer: tok }),
      await rest("/rpc/lh_create_embed_token", { method: "POST", bearer: tok, body: { p_label: "x" } }),
      await rest("/rpc/lh_create_agent_token", { method: "POST", bearer: tok, body: { name: "x" } }),
    ];
    for (const t of tries) assert(t.status === 401 || t.status === 403, `got HTTP ${t.status}`);
    assert(itemCount() === before, "items changed");
  });

  await check("embed token can't use the agent API (reads or writes all 401)", async () => {
    const before = itemCount();
    const calls = [
      await api("/list?format=json", tok),
      await api("/wishlist", tok),
      await api("/items", tok, "POST", { name: "Injected by embed" }),
      await api(`/items/${IDS.memberItem}/status`, tok, "POST", { status: "in_cart" }),
      await api(`/items/${IDS.memberItem}/remove`, tok, "POST", {}),
    ];
    for (const c of calls) assert(c.status === 401, `got HTTP ${c.status}: ${scrub(c.text).slice(0, 120)}`);
    assert(itemCount() === before, "items changed");
    // and the agent token still works there, so the 401s above are about the token kind
    assert((await api("/list?format=json", TOKEN)).status === 200, "agent token broke");
  });

  await check("agent token can't be used as an embed token; bad tokens are refused the same way", async () => {
    for (const t of [TOKEN, "lhe_" + TOKEN.slice(3), "lhe_" + randomBytes(32).toString("base64url"), "", "lhe_short", "x".repeat(500), tok.toUpperCase()]) {
      const d = await embed(t);
      assert(d.status === "invalid" && !("items" in d), `${scrub(t).slice(0, 12)} -> ${redact(d).slice(0, 80)}`);
    }
  });

  await check("no cross-household leak: admin (SQL editor) token for Other Home sees only Other Home", async () => {
    const r = JSON.parse(one(`select public.lh_create_embed_token('Other TV', '${IDS.otherHousehold}')`));
    otherTok = r.token;
    const d = await embed(otherTok);
    assert(d.status === "ok" && d.household === "Other Home", `other ${d.household}`);
    const names = d.items.map((i) => i.name).join(",");
    assert(names === "Other home oat milk", `other items ${names}`);
    const mine = (await embed(tok)).items.map((i) => i.name);
    assert(!mine.includes("Other home oat milk"), "Test Home token sees Other Home");
    // members can't mint, list, or revoke for another household
    assert((await rpc("lh_create_embed_token", { p_label: "x", p_household_id: IDS.otherHousehold }, chris)).status >= 400, "Chris minted for Other Home");
    assert((await rpc("lh_list_embed_tokens", { p_household_id: IDS.otherHousehold }, chris)).status >= 400, "Chris listed Other Home");
    const mineList = ok(await rpc("lh_list_embed_tokens", {}, chris), "list");
    assert(!mineList.some((t) => t.id === r.id), "Other Home token in Test Home list");
    assert((await rpc("lh_revoke_embed_token", { p_id: r.id }, chris)).status >= 400, "Chris revoked Other Home token");
    assert((await embed(otherTok)).status === "ok", "Other Home token was revoked");
  });

  await check("revoked token is refused right away and drops off the list", async () => {
    const r = ok(await rpc("lh_revoke_embed_token", { p_id: tokId }, ellen), "revoke");
    assert(r.ok === true, `revoke ${redact(r)}`);
    assert((await embed(tok)).status === "invalid", "revoked token still works");
    const l = ok(await rpc("lh_list_embed_tokens", {}, chris), "list");
    assert(!l.some((t) => t.id === tokId), "revoked token still listed");
    assert((await rpc("lh_revoke_embed_token", { p_id: tokId }, chris)).status >= 400, "double revoke not refused");
  });
} finally {
  await s.stop();
}
let failed = 0;
for (const [name, status, why] of results) {
  if (status === "FAIL") failed++;
  console.log(`${status}  ${name}${why ? `\n      ${scrub(why)}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
