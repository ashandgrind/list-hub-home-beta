// Agent API + migration checks against the local stack (never production).
// Run: node tests/agent-local/test-agent-api.mjs   (exit 1 if any check fails)
import { startStack, TOKEN, IDS, SERVICE_JWT, memberJwt } from "./stack.mjs";

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push([name, "PASS", ""]);
  } catch (err) {
    results.push([name, "FAIL", String(err && err.message || err).split("\n")[0].slice(0, 220)]);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const s = await startStack();
const api = (path, { method = "GET", body, token = TOKEN } = {}) =>
  fetch(s.apiBase + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
const rest = (path, { method = "GET", body, jwt = SERVICE_JWT, prefer } = {}) =>
  fetch(`${s.base}/rest/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, apikey: jwt, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
const one = (q) => s.sql(q);

let plainId = null, fullId = null;
try {
  console.log(`local db ${s.db}; migrations applied on top of the snapshot: ${s.applied.map((f) => f.split("/").pop()).join(", ") || "(none)"}`);

  await check("add: API insert stamps the token id and label (not Shopping Buddy)", async () => {
    const r = await api("/items", { method: "POST", body: { name: "beef jerky" } });
    assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.json)}`);
    plainId = r.json.item.id;
    const row = one(`select created_by || '|' || coalesce(added_by_token_id::text, '') from list_hub.items where id = '${plainId}'`);
    assert(row === `house|${IDS.token}`, `row is "${row}", want "house|${IDS.token}"`);
  });

  await check("add: accepts quantity, store and note", async () => {
    const r = await api("/items", { method: "POST", body: { name: "Paper towels", quantity: "2 packs", store: "costco", note: "the big ones" } });
    assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.json)}`);
    fullId = r.json.item.id;
    const row = one(`select coalesce(qty,'') || '|' || coalesce(notes,'') || '|' || coalesce(preferred_store_id::text,'') from list_hub.items where id = '${fullId}'`);
    assert(row === `2 packs|the big ones|${IDS.costco}`, `row is "${row}"`);
    assert(r.json.item.preferred_store === "Costco", `response preferred_store ${r.json.item.preferred_store}`);
  });

  await check("add: validates lengths and unknown store", async () => {
    const longQty = await api("/items", { method: "POST", body: { name: "Milk", quantity: "x".repeat(61) } });
    assert(longQty.status === 400 && longQty.json.error === "bad_quantity", `long quantity -> ${longQty.status} ${JSON.stringify(longQty.json)}`);
    const longNote = await api("/items", { method: "POST", body: { name: "Milk", note: "x".repeat(241) } });
    assert(longNote.status === 400 && longNote.json.error === "bad_note", `long note -> ${longNote.status}`);
    const longName = await api("/items", { method: "POST", body: { name: "x".repeat(201) } });
    assert(longName.status === 400 && longName.json.error === "bad_name", `long name -> ${longName.status}`);
    const badStore = await api("/items", { method: "POST", body: { name: "Milk", store: "Target" } });
    assert(badStore.status === 400 && badStore.json.error === "unknown_store", `unknown store -> ${badStore.status} ${JSON.stringify(badStore.json)}`);
    const milk = one(`select count(*) from list_hub.items where name = 'Milk'`);
    assert(milk === "0", `rejected adds still inserted ${milk} rows`);
  });

  await check("labels: renaming a token changes the label for items it already added", async () => {
    const r = await rest("/rpc/lh_rename_agent_token", { method: "POST", body: { id: IDS.token, label: "Kitchen tablet" }, jwt: memberJwt("ellen") });
    assert(r.status === 200, `rename -> ${r.status} ${JSON.stringify(r.json)}`);
    const labels = await rest("/rpc/lh_agent_token_labels", { method: "POST", body: {}, jwt: memberJwt("chris") });
    assert(labels.status === 200 && labels.json[IDS.token] === "Kitchen tablet", `labels -> ${labels.status} ${JSON.stringify(labels.json)}`);
    const stamped = one(`select count(*) from list_hub.items where added_by_token_id = '${IDS.token}'`);
    assert(stamped === "2", `items stamped with the token: ${stamped}`);
    const list = await rest("/rpc/lh_list_agent_tokens", { method: "POST", body: {}, jwt: memberJwt("chris") });
    assert(list.json[0].label === "Kitchen tablet" && list.json[0].name === "house", `list -> ${JSON.stringify(list.json)}`);
    const tooLong = await rest("/rpc/lh_rename_agent_token", { method: "POST", body: { id: IDS.token, label: "   " }, jwt: memberJwt("chris") });
    assert(tooLong.status >= 400, `empty label accepted (${tooLong.status})`);
    const anon = await rest("/rpc/lh_rename_agent_token", { method: "POST", body: { id: IDS.token, label: "Hacked" }, jwt: memberJwt("chris").replace(/\..*$/, "") + ".x.y" });
    assert(anon.status >= 400, `bad JWT rename accepted (${anon.status})`);
  });

  await check("remove: API remove deletes the item and writes a removal log row with the token", async () => {
    const r = await api(`/items/${plainId}/remove`, { method: "POST" });
    assert(r.status === 200 && r.json.removed === "deleted", `remove -> ${r.status} ${JSON.stringify(r.json)}`);
    assert(one(`select count(*) from list_hub.items where id = '${plainId}'`) === "0", "item still there");
    const log = one(`select item_name || '|' || list_kind || '|' || removed_by_kind || '|' || coalesce(removed_by_token_id::text,'') || '|' || coalesce(removed_by_label,'') from list_hub.item_removals where item_id = '${plainId}'`);
    assert(log === `beef jerky|needs|agent|${IDS.token}|Kitchen tablet`, `log row is "${log}"`);
  });

  await check("remove: wishlist items can be removed and are logged", async () => {
    const r = await api(`/items/${IDS.wishItem}/remove`, { method: "POST" });
    assert(r.status === 200, `remove -> ${r.status} ${JSON.stringify(r.json)}`);
    const log = one(`select list_kind || '|' || removed_by_kind from list_hub.item_removals where item_id = '${IDS.wishItem}'`);
    assert(log === "wish|agent", `log row is "${log}"`);
  });

  await check("remove: an app (member) delete is logged as the member", async () => {
    const r = await rest(`/lh_items?id=eq.${IDS.memberItem}`, { method: "DELETE", jwt: memberJwt("chris"), prefer: "return=representation" });
    assert(r.status === 200 && r.json.length === 1, `delete -> ${r.status} ${JSON.stringify(r.json)}`);
    const log = one(`select removed_by_kind || '|' || removed_by_label || '|' || coalesce(removed_by_user_id::text,'') from list_hub.item_removals where item_id = '${IDS.memberItem}'`);
    assert(log === `member|Chris|${IDS.chris}`, `log row is "${log}"`);
    const mine = await rest("/rpc/lh_item_removals", { method: "POST", body: {}, jwt: memberJwt("ellen") });
    assert(mine.status === 200 && mine.json.length === 3, `lh_item_removals -> ${mine.status} ${JSON.stringify(mine.json).slice(0, 120)}`);
  });

  await check("remove: another household's item is refused", async () => {
    const other = one(`insert into list_hub.items (list_id, name) values ('${IDS.otherNeeds}', 'Not yours') returning id`).split("\n")[0];
    const r = await api(`/items/${other}/remove`, { method: "POST" });
    assert(r.status === 404, `remove -> ${r.status}`);
    assert(one(`select count(*) from list_hub.items where id = '${other}'`) === "1", "other household item was deleted");
  });

  await check("status: bought stamps the token on the item and the purchase row", async () => {
    const r = await api(`/items/${fullId}/status`, { method: "POST", body: { status: "bought", store: "Costco" } });
    assert(r.status === 200 && r.json.by === "Kitchen tablet", `status -> ${r.status} ${JSON.stringify(r.json)}`);
    const item = one(`select status || '|' || coalesce(agent_by_token_id::text,'') from list_hub.items where id = '${fullId}'`);
    assert(item === `checked|${IDS.token}`, `item is "${item}"`);
    const p = one(`select coalesce(created_by,'') from list_hub.purchases where item_id = '${fullId}'`);
    assert(p === "Kitchen tablet", `purchase created_by is "${p}"`);
  });

  await check("fallback: a service-role insert with no token is still Shopping Buddy", async () => {
    const r = await rest("/lh_items", { method: "POST", body: { list_id: IDS.needs, name: "Bot item" }, prefer: "return=representation" });
    assert(r.status === 201, `insert -> ${r.status} ${JSON.stringify(r.json)}`);
    assert(r.json[0].created_by === "Shopping Buddy" && r.json[0].added_by_kind === "assistant", `row ${JSON.stringify(r.json[0])}`);
  });

  await check("openapi: version bumped and add body documents quantity/store/note", async () => {
    const r = await fetch(`${s.apiBase}/openapi.json`).then((x) => x.json());
    assert(r.info.version === "1.1.0", `version ${r.info.version}`);
    const props = Object.keys(r.components.schemas.AddBody.properties);
    assert(["name", "quantity", "store", "note"].every((k) => props.includes(k)), `AddBody has ${props}`);
    assert(!/Pollock/.test(JSON.stringify(r)), "spec still says Pollock");
  });
} finally {
  await s.stop();
}

let failed = 0;
for (const [name, status, why] of results) {
  if (status === "FAIL") failed++;
  console.log(`${status}  ${name}${why ? `\n      ${why}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
