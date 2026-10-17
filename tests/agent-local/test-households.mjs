// Households + invites checks against the local stack (never production).
// Run: node tests/agent-local/test-households.mjs   (exit 1 if any check fails)
// Never prints invite token values.
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { startStack, TOKEN, IDS, ANON_JWT, memberJwt, userJwt } from "./stack.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const results = [];
async function check(name, fn) {
  try { await fn(); results.push([name, "PASS", ""]); }
  catch (err) { results.push([name, "FAIL", String(err && err.message || err).split("\n")[0].slice(0, 240)]); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const sha = (t) => createHash("sha256").update(t).digest("hex");
const redact = (v) => JSON.stringify(v, (k, x) => (k === "token" ? "[redacted]" : x));

const U = {
  john: { id: "c0000000-0000-4000-8000-0000000000a1", email: "john@example.test" },
  jane: { id: "c0000000-0000-4000-8000-0000000000a2", email: "jane@example.test" },
  sam: { id: "c0000000-0000-4000-8000-0000000000a3", email: "sam@example.test" },
  kim: { id: "c0000000-0000-4000-8000-0000000000a4", email: "kim@example.test" },
  lee: { id: "c0000000-0000-4000-8000-0000000000a5", email: "lee@example.test" },
};
const jwtOf = (u) => userJwt(u.id, u.email);

const s = await startStack({ port: 54460 });
const one = (q) => s.sql(q);
const rest = (path, { method = "GET", body, jwt = ANON_JWT, prefer } = {}) =>
  fetch(`${s.base}/rest/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, apikey: ANON_JWT, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));
const rpc = (name, args = {}, jwt = ANON_JWT) => rest(`/rpc/${name}`, { method: "POST", body: args, jwt });
const ok = (r, what) => { assert(r.status >= 200 && r.status < 300, `${what}: HTTP ${r.status} ${redact(r.json).slice(0, 160)}`); return r.json; };

const chris = memberJwt("chris"), ellen = memberJwt("ellen");
const hh1Counts = () => one(`select (select count(*) from list_hub.items i join list_hub.lists l on l.id=i.list_id where l.household_id='${IDS.household}')||'|'||(select count(*) from list_hub.stores where household_id='${IDS.household}')||'|'||(select count(*) from list_hub.lists where household_id='${IDS.household}')||'|'||(select count(*) from list_hub.members where household_id='${IDS.household}')||'|'||(select string_agg(i.name, ',' order by i.name) from list_hub.items i join list_hub.lists l on l.id=i.list_id where l.household_id='${IDS.household}')`);

let fleet = null, ownerInvite = null, janeInvite = null;
try {
  for (const u of Object.values(U)) one(`insert into auth.users (id, email) values ('${u.id}', '${u.email}')`);
  const hh1Before = hh1Counts();
  console.log(`local db ${s.db}; migrations: ${s.applied.map((f) => f.split("/").pop()).join(", ")}`);

  await check("admin: migration seed makes only the original household's owner an admin", async () => {
    const mig = readFileSync(join(here, "..", "..", "supabase", "migrations", "20261017000000_list_hub_households_invites.sql"), "utf8");
    const seed = mig.match(/INSERT INTO list_hub\.admins[\s\S]*?ON CONFLICT \(user_id\) DO NOTHING;/);
    assert(seed, "seed statement not found in the migration");
    one(seed[0]);
    const admins = one(`select string_agg(user_id::text, ',') from list_hub.admins`);
    assert(admins === IDS.chris, `admins = ${admins}`);
    assert((await rpc("lh_is_admin", {}, chris)).json === true, "Chris is not admin");
    assert((await rpc("lh_is_admin", {}, ellen)).json === false, "Ellen is admin");
  });

  await check("admin: only an admin can create a household (member and anon refused)", async () => {
    const e = await rpc("lh_admin_create_household", { p_name: "Nope", p_owner_email: "x@example.test" }, ellen);
    assert(e.status >= 400, `Ellen got ${e.status}`);
    const a = await rpc("lh_admin_create_household", { p_name: "Nope", p_owner_email: "x@example.test" });
    assert(a.status >= 400, `anon got ${a.status}`);
    assert(one(`select count(*) from list_hub.households where name='Nope'`) === "0", "a household was created");
  });

  await check("admin: create household = empty List + Wishlist, no items, no stores, owner invite (hash only)", async () => {
    const r = ok(await rpc("lh_admin_create_household", { p_name: "Fleet Home", p_owner_email: "John@Example.test ", p_owner_name: "John" }, chris), "create");
    fleet = r.household_id; ownerInvite = r.invite;
    assert(r.ok && fleet && ownerInvite && ownerInvite.token && ownerInvite.token.startsWith("lhi_"), `bad reply ${redact(r)}`);
    assert(ownerInvite.role === "owner" && ownerInvite.email === "john@example.test", `invite ${redact(ownerInvite)}`);
    const lists = one(`select string_agg(kind||':'||slug||':'||name, ',' order by kind) from list_hub.lists where household_id='${fleet}'`);
    assert(lists === "needs:list:List,wish:wish:Wishlist", `lists ${lists}`);
    const counts = one(`select (select count(*) from list_hub.items i join list_hub.lists l on l.id=i.list_id where l.household_id='${fleet}')||'|'||(select count(*) from list_hub.stores where household_id='${fleet}')||'|'||(select count(*) from list_hub.members where household_id='${fleet}')`);
    assert(counts === "0|0|0", `items|stores|members = ${counts}`);
    const stored = one(`select token_hash = '${sha(ownerInvite.token)}' and expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute' from list_hub.household_invites where id='${ownerInvite.id}'`);
    assert(stored === "t", "stored hash or 7-day expiry wrong");
    const leak = one(`select count(*) from list_hub.household_invites where row_to_json(household_invites)::text like '%${ownerInvite.token.slice(4, 20)}%'`);
    assert(leak === "0", "plain token found in the table");
  });

  await check("invites are reachable only through the RPCs (no public view; anon cannot list)", async () => {
    const r = await rest("/rpc/lh_list_invites", { method: "POST", body: {}, jwt: ANON_JWT });
    assert(r.status >= 400, `anon list_invites ${r.status}`);
    const v = await rest("/household_invites?select=*", { jwt: chris });
    assert(v.status === 404 || v.status >= 400, `public household_invites answered ${v.status}`);
    const asMember = one(`begin; set local role authenticated; set local request.jwt.claims = '{"role":"authenticated","sub":"${IDS.chris}","email":"chris@example.test"}'; select count(*) from list_hub.household_invites; rollback;`).split("\n").filter(Boolean).pop();
    assert(asMember === "0", `RLS let a member read ${asMember} invite rows directly`);
  });

  await check("owner invite: John's email is let in by lh_auth_hint, accepts, and lands in his household", async () => {
    const hint = ok(await rpc("lh_auth_hint", { p_email: "john@example.test" }), "hint");
    assert(hint.member === true && hint.invited === true, `hint ${JSON.stringify(hint)}`);
    const prev = ok(await rpc("lh_invite_preview", { p_token: ownerInvite.token }), "preview");
    assert(prev.status === "pending" && prev.household_name === "Fleet Home" && prev.email_hint === "j***@example.test", `preview ${JSON.stringify(prev)}`);
    const acc = ok(await rpc("lh_accept_invite", { p_token: ownerInvite.token }, jwtOf(U.john)), "accept");
    assert(acc.ok && acc.household_id === fleet && acc.role === "owner" && acc.display_name === "John", `accept ${JSON.stringify(acc)}`);
    const boot = ok(await rpc("lh_bootstrap", {}, jwtOf(U.john)), "bootstrap");
    assert(boot.member && boot.member.household_id === fleet && boot.household && boot.household.name === "Fleet Home", `boot member ${JSON.stringify(boot.member)}`);
    assert(boot.items.length === 0 && boot.stores.length === 0 && boot.lists.length === 2, "not empty");
  });

  await check("spouse invite works end to end (John invites Jane, Jane signs in and joins)", async () => {
    janeInvite = ok(await rpc("lh_create_invite", { p_email: "jane@example.test", p_display_name: "Jane" }, jwtOf(U.john)), "create invite");
    assert(janeInvite.token && janeInvite.role === "member", `invite ${redact(janeInvite)}`);
    const hint = ok(await rpc("lh_auth_hint", { p_email: "Jane@example.test" }), "hint");
    assert(hint.member === true && hint.invited === true, `hint ${JSON.stringify(hint)}`);
    const pending = ok(await rpc("lh_list_invites", {}, jwtOf(U.john)), "list");
    assert(pending.some((i) => i.id === janeInvite.id && i.status === "pending" && i.created_by_name === "John"), "not listed as pending");
    assert(!JSON.stringify(pending).includes("token"), "list_invites exposes token fields");
    const acc = ok(await rpc("lh_accept_invite", { p_token: janeInvite.token }, jwtOf(U.jane)), "accept");
    assert(acc.ok && acc.household_id === fleet && acc.role === "member" && acc.display_name === "Jane", `accept ${JSON.stringify(acc)}`);
    const boot = ok(await rpc("lh_bootstrap", {}, jwtOf(U.jane)), "bootstrap");
    assert(boot.member.household_id === fleet && boot.member.role === "member", "Jane not in Fleet Home");
    const after = ok(await rpc("lh_list_invites", {}, jwtOf(U.jane)), "list");
    assert(after.some((i) => i.id === janeInvite.id && i.status === "used" && i.used_by_email === "jane@example.test"), "not marked used");
  });

  await check("non-invited email refused (hint, accept, bootstrap, invite)", async () => {
    const hint = ok(await rpc("lh_auth_hint", { p_email: "sam@example.test" }), "hint");
    assert(hint.member === false, `hint ${JSON.stringify(hint)}`);
    const pend = ok(await rpc("lh_create_invite", { p_email: "kim@example.test" }, jwtOf(U.john)), "invite kim");
    const wrong = ok(await rpc("lh_accept_invite", { p_token: pend.token }, jwtOf(U.sam)), "accept");
    assert(wrong.ok === false && wrong.error === "wrong_email", `sam accepting kim's invite: ${JSON.stringify(wrong)}`);
    const hint2 = ok(await rpc("lh_auth_hint", { p_email: "sam@example.test", p_invite: pend.token }), "hint+token");
    assert(hint2.member === false, "sam let in with someone else's invite token");
    const junk = ok(await rpc("lh_accept_invite", { p_token: "lhi_" + "x".repeat(43) }, jwtOf(U.sam)), "junk");
    assert(junk.ok === false && junk.error === "not_found", `junk ${JSON.stringify(junk)}`);
    const boot = ok(await rpc("lh_bootstrap", {}, jwtOf(U.sam)), "bootstrap");
    assert(boot.member === null, "sam got a member row");
    const inv = await rpc("lh_create_invite", { p_email: "x@example.test" }, jwtOf(U.sam));
    assert(inv.status >= 400, `sam could invite: ${inv.status}`);
    const anonAccept = await rpc("lh_accept_invite", { p_token: pend.token });
    assert(anonAccept.status >= 400, `anon accept ${anonAccept.status}`);
    assert(one(`select count(*) from list_hub.members where lower(email)='sam@example.test'`) === "0", "sam is a member");
  });

  await check("expired, used and cancelled invites refused (hint and accept); resend issues a working new link", async () => {
    const exp = ok(await rpc("lh_create_invite", { p_email: "lee@example.test" }, jwtOf(U.john)), "invite lee");
    one(`update list_hub.household_invites set expires_at = now() - interval '1 minute' where id='${exp.id}'`);
    const h1 = ok(await rpc("lh_auth_hint", { p_email: "lee@example.test" }), "hint");
    assert(h1.member === false, "expired invite still lets lee in");
    const a1 = ok(await rpc("lh_accept_invite", { p_token: exp.token }, jwtOf(U.lee)), "accept expired");
    assert(a1.ok === false && a1.error === "expired", `expired: ${JSON.stringify(a1)}`);
    assert(ok(await rpc("lh_invite_preview", { p_token: exp.token }), "preview").status === "expired", "preview not expired");

    const used = ok(await rpc("lh_accept_invite", { p_token: janeInvite.token }, jwtOf(U.lee)), "accept used");
    assert(used.ok === false && used.error === "used", `used (email-bound): ${JSON.stringify(used)}`);
    const link = ok(await rpc("lh_create_invite", {}, jwtOf(U.john)), "link invite");
    assert(link.email === null, "link invite has an email");
    const takeLink = ok(await rpc("lh_accept_invite", { p_token: link.token }, jwtOf(U.kim)), "kim takes link");
    assert(takeLink.ok === true, `kim link accept ${JSON.stringify(takeLink)}`);
    const secondUse = ok(await rpc("lh_accept_invite", { p_token: link.token }, jwtOf(U.lee)), "second use");
    assert(secondUse.ok === false && secondUse.error === "used", `second use: ${JSON.stringify(secondUse)}`);

    const resend = ok(await rpc("lh_resend_invite", { p_id: exp.id }, jwtOf(U.jane)), "resend");
    assert(resend.ok && resend.token && resend.replaces === exp.id && resend.email === "lee@example.test", `resend ${redact(resend)}`);
    const canc = ok(await rpc("lh_cancel_invite", { p_id: resend.id }, jwtOf(U.jane)), "cancel");
    assert(canc.ok === true, "cancel failed");
    const h2 = ok(await rpc("lh_auth_hint", { p_email: "lee@example.test" }), "hint after cancel");
    assert(h2.member === false, "cancelled invite still lets lee in");
    const a2 = ok(await rpc("lh_accept_invite", { p_token: resend.token }, jwtOf(U.lee)), "accept cancelled");
    assert(a2.ok === false && a2.error === "cancelled", `cancelled: ${JSON.stringify(a2)}`);
    const again = ok(await rpc("lh_resend_invite", { p_id: resend.id }, jwtOf(U.john)), "resend cancelled");
    const a3 = ok(await rpc("lh_accept_invite", { p_token: again.token }, jwtOf(U.lee)), "accept resent");
    assert(a3.ok === true && a3.household_id === fleet, `resent link: ${JSON.stringify(a3)}`);
    const a4 = ok(await rpc("lh_accept_invite", { p_token: exp.token }, jwtOf(U.sam)), "old link after resend");
    assert(a4.ok === false, "old expired link worked");
  });

  await check("second household refused for an existing member (accept, invite, admin create, direct insert)", async () => {
    const link = ok(await rpc("lh_create_invite", {}, jwtOf(U.john)), "link");
    const r = ok(await rpc("lh_accept_invite", { p_token: link.token }, ellen), "ellen accepts");
    assert(r.ok === false && r.error === "already_member", `ellen: ${JSON.stringify(r)}`);
    assert(ok(await rpc("lh_invite_preview", { p_token: link.token }), "preview").status === "pending", "refused accept consumed the invite");
    const inv = await rpc("lh_create_invite", { p_email: "chris@example.test" }, jwtOf(U.john));
    assert(inv.status >= 400 && /already_member/.test(JSON.stringify(inv.json)), `invite existing member: ${inv.status}`);
    const adm = await rpc("lh_admin_create_household", { p_name: "Ellen 2", p_owner_email: "ellen@example.test" }, chris);
    assert(adm.status >= 400 && /already_member/.test(JSON.stringify(adm.json)), `admin create for member: ${adm.status}`);
    let blocked = false;
    try { one(`insert into list_hub.members (household_id, email, display_name, role, user_id) values ('${fleet}', 'ellen@example.test', 'Ellen', 'member', '${IDS.ellen}')`); }
    catch (e) { blocked = /members_one_household/.test(String(e.stderr || e.message)); }
    assert(blocked, "direct insert of a second membership was not blocked by the one-household index");
    const boot = ok(await rpc("lh_bootstrap", {}, ellen), "bootstrap");
    assert(boot.member.household_id === IDS.household, "Ellen moved households");
  });

  await check("one-household rule is removable: members stays many-to-many and bootstrap is deterministic", async () => {
    // In a rolled-back transaction: drop the two indexes, give John an older row in household 1.
    const out = one(`begin;
      drop index list_hub.members_one_household_email_uq; drop index list_hub.members_one_household_user_uq;
      insert into list_hub.members (household_id, email, display_name, role, user_id, created_at) values ('${IDS.household}', 'john@example.test', 'John', 'member', '${U.john.id}', now() - interval '1 day');
      set local request.jwt.claims = '{"role":"authenticated","sub":"${U.john.id}","email":"john@example.test"}';
      select string_agg(x, ',') from (select (public.lh_bootstrap()->'member'->>'household_id') x from generate_series(1,5)) t;
      rollback;`);
    const picks = out.split("\n").filter(Boolean).pop();
    assert(picks === Array(5).fill(IDS.household).join(","), `picks ${picks}`);
    assert(one(`select count(*) from pg_indexes where indexname like 'members_one_household_%'`) === "2", "indexes not restored");
    const cols = one(`select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='list_hub' and table_name='members'`);
    assert(cols === "household_id,email,display_name,role,user_id,created_at", `members columns ${cols}`);
    const hhCols = one(`select count(*) from information_schema.columns where table_schema='auth' and column_name='household_id'`);
    assert(hhCols === "0", "a household_id was added to a user row");
  });

  await check("second household isolated both ways (reads and writes)", async () => {
    const fleetNeeds = one(`select id from list_hub.lists where household_id='${fleet}' and kind='needs'`);
    const jj = jwtOf(U.john);
    const add = ok(await rest("/lh_items", { method: "POST", jwt: jj, prefer: "return=representation", body: { list_id: fleetNeeds, name: "Fleet milk", status: "needed" } }), "john adds");
    const fleetItem = add[0].id;
    const st = await rest("/lh_stores", { method: "POST", jwt: jj, prefer: "return=representation", body: { household_id: fleet, name: "Fleet Mart", slug: "fleet-mart", kind: "grocery" } });
    assert(st.status === 201, `john adds store ${st.status}`);
    for (const view of ["lh_items", "lh_lists", "lh_stores", "lh_members", "lh_households"]) {
      const j = ok(await rest(`/${view}?select=*`, { jwt: jj }), `john ${view}`);
      const c = ok(await rest(`/${view}?select=*`, { jwt: chris }), `chris ${view}`);
      const jText = JSON.stringify(j), cText = JSON.stringify(c);
      assert(!jText.includes(IDS.household) && !jText.includes("Eggs") && !jText.includes("Publix") && !jText.includes("chris@example.test"), `John sees household 1 in ${view}`);
      assert(!cText.includes(fleet) && !cText.includes("Fleet milk") && !cText.includes("Fleet Mart") && !cText.includes("john@example.test"), `Chris sees Fleet Home in ${view}`);
    }
    const jw = await rest("/lh_items", { method: "POST", jwt: jj, body: { list_id: IDS.needs, name: "intruder", status: "needed" } });
    assert(jw.status >= 400, `John wrote into household 1: ${jw.status}`);
    const cw = await rest("/lh_items", { method: "POST", jwt: chris, body: { list_id: fleetNeeds, name: "intruder", status: "needed" } });
    assert(cw.status >= 400, `Chris wrote into Fleet Home: ${cw.status}`);
    const js = await rest("/lh_stores", { method: "POST", jwt: jj, body: { household_id: IDS.household, name: "X", slug: "x", kind: "other" } });
    assert(js.status >= 400, `John added a store to household 1: ${js.status}`);
    const jp = ok(await rest(`/lh_items?id=eq.${IDS.memberItem}`, { method: "PATCH", jwt: jj, prefer: "return=representation", body: { name: "hacked" } }), "john patch");
    assert(jp.length === 0, "John updated a household 1 item");
    const cd = ok(await rest(`/lh_items?id=eq.${fleetItem}`, { method: "DELETE", jwt: chris, prefer: "return=representation" }), "chris delete");
    assert(cd.length === 0, "Chris deleted a Fleet item");
    const hh1Inv = ok(await rpc("lh_create_invite", { p_email: "pat@example.test" }, ellen), "ellen invite");
    const jl = ok(await rpc("lh_list_invites", {}, jj), "john list");
    assert(!jl.some((i) => i.id === hh1Inv.id), "John sees household 1 invites");
    const jc = ok(await rpc("lh_cancel_invite", { p_id: hh1Inv.id }, jj), "john cancel");
    assert(jc.ok === false, "John cancelled a household 1 invite");
    const jr = ok(await rpc("lh_resend_invite", { p_id: hh1Inv.id }, jj), "john resend");
    assert(jr.ok === false, "John resent a household 1 invite");
    one(`update list_hub.household_invites set cancelled_at = now() where id='${hh1Inv.id}'`);
    const agent = await fetch(`${s.apiBase}/list?format=json`, { headers: { Authorization: `Bearer ${TOKEN}` } }).then((r) => r.json());
    assert(!JSON.stringify(agent).includes("Fleet milk"), "household 1 agent token sees Fleet items");
  });

  await check("household 1 unaffected (items, stores, lists, members; Chris still bootstraps Test Home)", async () => {
    const after = hh1Counts();
    assert(after === hh1Before, `before ${hh1Before} after ${after}`);
    const boot = ok(await rpc("lh_bootstrap", {}, chris), "bootstrap");
    assert(boot.member.household_id === IDS.household && boot.household && boot.household.name === "Test Home", `chris boot ${JSON.stringify(boot.household)}`);
    const hint = ok(await rpc("lh_auth_hint", { p_email: "chris@example.test" }), "hint");
    assert(hint.member === true && hint.invited === false, `chris hint ${JSON.stringify(hint)}`);
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
