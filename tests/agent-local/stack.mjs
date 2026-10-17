// Local List Hub stack for tests: Postgres (schema snapshot + this repo's newer
// migrations) + PostgREST + the real lh-agent-api edge function under Deno,
// behind one proxy that looks like https://<ref>.supabase.co.
//
// Needs: a local Postgres superuser (PGHOST/PGUSER/PGPASSWORD, default
// localhost/postgres/postgres), `psql`, `postgrest`, and `deno` on PATH.
// Never points at production.
import { spawn, execFileSync } from "node:child_process";
import { createHmac, createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..");
const SNAPSHOT_CUTOFF = "20261016000000"; // migrations newer than the snapshot get applied
export const JWT_SECRET = "local-test-secret-local-test-secret-0123456789";
export const IDS = {
  // Same id as the production household so the app's old hardcoded id lines up (fail-first checks).
  household: "a0000000-0000-4000-8000-000000000001",
  otherHousehold: "b0000000-0000-4000-8000-000000000002",
  chris: "c0000000-0000-4000-8000-0000000000c1",
  ellen: "c0000000-0000-4000-8000-0000000000e1",
  needs: "d0000000-0000-4000-8000-0000000000a1",
  wish: "d0000000-0000-4000-8000-0000000000a2",
  otherNeeds: "d0000000-0000-4000-8000-0000000000b1",
  publix: "e0000000-0000-4000-8000-0000000000f1",
  costco: "e0000000-0000-4000-8000-0000000000f2",
  token: "f0000000-0000-4000-8000-000000000001",
  memberItem: "a1000000-0000-4000-8000-000000000001",
  wishItem: "a1000000-0000-4000-8000-000000000002",
};
export const TOKEN = "lh_localtesttoken_house_0123456789abcdefghijklmnop";
export const HOUSEHOLD_NAME = "Test Home";

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function signJwt(claims) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400, ...claims }));
  const sig = b64url(createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}
export const SERVICE_JWT = signJwt({ role: "service_role", iss: "supabase" });
export const ANON_JWT = signJwt({ role: "anon", iss: "supabase" });
export function memberJwt(who = "chris") {
  const email = who === "chris" ? "chris@example.test" : "ellen@example.test";
  return signJwt({ role: "authenticated", aud: "authenticated", sub: IDS[who], email });
}
// Any signed-in user (does not need to be a member).
export function userJwt(sub, email) {
  return signJwt({ role: "authenticated", aud: "authenticated", sub, email });
}

const pgEnv = {
  ...process.env,
  PGHOST: process.env.PGHOST || "localhost",
  PGUSER: process.env.PGUSER || "postgres",
  PGPASSWORD: process.env.PGPASSWORD || "postgres",
};
function psql(db, args) {
  return execFileSync("psql", ["-X", "-q", "--set=client_min_messages=warning", "-v", "ON_ERROR_STOP=1", "-d", db, ...args], { env: pgEnv, encoding: "utf8" });
}
export function sql(db, query) {
  return psql(db, ["-At", "-c", query]).trim();
}

function seedSql() {
  const hash = createHash("sha256").update(TOKEN).digest("hex");
  return `
INSERT INTO auth.users (id, email) VALUES ('${IDS.chris}', 'chris@example.test'), ('${IDS.ellen}', 'ellen@example.test');
INSERT INTO list_hub.households (id, name, access_code) VALUES ('${IDS.household}', '${HOUSEHOLD_NAME}', 'x'), ('${IDS.otherHousehold}', 'Other Home', 'y');
INSERT INTO list_hub.members (household_id, email, display_name, role, user_id) VALUES
  ('${IDS.household}', 'chris@example.test', 'Chris', 'owner', '${IDS.chris}'),
  ('${IDS.household}', 'ellen@example.test', 'Ellen', 'member', '${IDS.ellen}');
INSERT INTO list_hub.lists (id, household_id, slug, name, kind, status) VALUES
  ('${IDS.needs}', '${IDS.household}', 'list', 'List', 'needs', 'open'),
  ('${IDS.wish}', '${IDS.household}', 'wish', 'Wishlist', 'wish', 'open'),
  ('${IDS.otherNeeds}', '${IDS.otherHousehold}', 'list', 'List', 'needs', 'open');
INSERT INTO list_hub.stores (id, household_id, slug, name, kind, sort_order) VALUES
  ('${IDS.publix}', '${IDS.household}', 'publix', 'Publix', 'grocery', 1),
  ('${IDS.costco}', '${IDS.household}', 'costco', 'Costco', 'club', 2);
INSERT INTO list_hub.agent_tokens (id, household_id, name, token_hash, created_by) VALUES
  ('${IDS.token}', '${IDS.household}', 'house', '${hash}', 'Chris');
SET request.jwt.claims = '{"role":"authenticated","sub":"${IDS.chris}","email":"chris@example.test"}';
INSERT INTO list_hub.items (id, list_id, name, status, category) VALUES
  ('${IDS.memberItem}', '${IDS.needs}', 'Eggs', 'needed', 'Food'),
  ('${IDS.wishItem}', '${IDS.wish}', 'Camping chair', 'needed', 'Outdoor & Sports');
RESET request.jwt.claims;
`;
}

export function newerMigrations() {
  const dir = join(repo, "supabase", "migrations");
  return readdirSync(dir).filter((f) => f.endsWith(".sql") && f.slice(0, 14) > SNAPSHOT_CUTOFF).sort().map((f) => join(dir, f));
}

function waitFor(url, headers = {}, tries = 80) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      fetch(url, { headers }).then((r) => (r.status < 500 ? resolve() : n > 0 ? setTimeout(() => attempt(n - 1), 250) : reject(new Error(`${url} -> ${r.status}`))),
        () => (n > 0 ? setTimeout(() => attempt(n - 1), 250) : reject(new Error(`${url} never came up`))));
    };
    attempt(tries);
  });
}

export async function startStack({ port = 54399 } = {}) {
  const db = `lh_test_${process.pid}_${Date.now() % 100000}`;
  psql("postgres", ["-c", `CREATE DATABASE ${db}`]);
  const applied = newerMigrations();
  try {
    psql(db, ["-f", join(here, "supabase-stub.sql")]);
    psql(db, ["-f", join(here, "prod-schema-2026-10-16.sql")]);
    for (const f of applied) psql(db, ["-f", f]);
    psql(db, ["-f", join(here, "grants.sql")]);
    psql(db, ["-c", seedSql()]);
  } catch (err) {
    try { psql("postgres", ["-c", `DROP DATABASE IF EXISTS ${db} WITH (FORCE)`]); } catch {}
    throw err;
  }

  const work = mkdtempSync(join(tmpdir(), "lh-stack-"));
  const restPort = port + 1, fnPort = port + 2;
  const conf = join(work, "postgrest.conf");
  writeFileSync(conf, [
    `db-uri = "postgres://authenticator:authpw@${pgEnv.PGHOST}:5432/${db}"`,
    `db-schemas = "public"`,
    `db-anon-role = "anon"`,
    `jwt-secret = "${JWT_SECRET}"`,
    `server-port = ${restPort}`,
    `server-host = "127.0.0.1"`,
  ].join("\n"));
  const procs = [];
  const logs = { rest: "", fn: "" };
  const rest = spawn("postgrest", [conf], { stdio: ["ignore", "pipe", "pipe"] });
  rest.stdout.on("data", (d) => (logs.rest += d)); rest.stderr.on("data", (d) => (logs.rest += d));
  procs.push(rest);

  const base = `http://127.0.0.1:${port}`;
  // Wrapper pins Deno.serve to fnPort, then loads the real function source unchanged.
  const wrapper = join(work, "serve.ts");
  writeFileSync(wrapper, [
    `const orig = Deno.serve.bind(Deno);`,
    `// @ts-ignore test shim`,
    `Deno.serve = (handler: any) => orig({ port: ${fnPort}, hostname: "127.0.0.1", onListen() {} }, handler);`,
    `await import(${JSON.stringify("file://" + join(repo, "supabase/functions/lh-agent-api/index.ts"))});`,
  ].join("\n"));
  const fn = spawn("deno", ["run", "--allow-net", "--allow-env", "--allow-read", "--no-check", "--quiet", wrapper], {
    env: { ...process.env, SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: SERVICE_JWT },
    stdio: ["ignore", "pipe", "pipe"],
  });
  fn.stdout.on("data", (d) => (logs.fn += d)); fn.stderr.on("data", (d) => (logs.fn += d));
  procs.push(fn);

  // One origin that looks like Supabase: /rest/v1 -> PostgREST, /functions/v1/lh-agent-api -> Deno, /auth/v1 -> stub.
  const proxy = createServer(async (req, res) => {
    const cors = {
      "access-control-allow-origin": req.headers.origin || "*",
      "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, prefer, accept-profile, content-profile, x-supabase-api-version",
      "access-control-allow-methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "access-control-expose-headers": "content-range",
    };
    if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }
    const url = req.url || "/";
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    if (url.startsWith("/auth/v1/user")) {
      const auth = String(req.headers.authorization || "");
      const claims = JSON.parse(Buffer.from(auth.split(".")[1] || "e30", "base64url").toString() || "{}");
      res.writeHead(200, { ...cors, "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: claims.sub, email: claims.email, aud: "authenticated", role: "authenticated", user_metadata: { has_password: true }, app_metadata: {} }));
      return;
    }
    if (url.startsWith("/auth/v1/")) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); res.end("{}"); return; }
    let target;
    if (url.startsWith("/rest/v1/")) target = `http://127.0.0.1:${restPort}${url.slice("/rest/v1".length)}`;
    else if (url.startsWith("/functions/v1/")) target = `http://127.0.0.1:${fnPort}${url.slice("/functions/v1".length)}`;
    else { res.writeHead(404, cors); res.end("no route"); return; }
    const headers = { ...req.headers };
    delete headers.host; delete headers["content-length"]; delete headers.connection;
    // Supabase's gateway turns a bare apikey into the role JWT; mimic that.
    if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
    if (target.includes(`:${restPort}`) && String(headers.authorization || "").includes(" lh_")) delete headers.authorization;
    try {
      const r = await fetch(target, { method: req.method, headers, body });
      const out = Buffer.from(await r.arrayBuffer());
      const h = Object.fromEntries([...r.headers].filter(([k]) => !["content-encoding", "content-length", "transfer-encoding", "connection"].includes(k) && !k.startsWith("access-control-")));
      res.writeHead(r.status, { ...h, ...cors });
      res.end(out);
    } catch (err) {
      res.writeHead(502, cors); res.end(String(err));
    }
  });
  await new Promise((r) => proxy.listen(port, "127.0.0.1", r));

  await waitFor(`http://127.0.0.1:${restPort}/`, { Authorization: `Bearer ${SERVICE_JWT}` });
  await waitFor(`http://127.0.0.1:${fnPort}/lh-agent-api/openapi.json`);

  const stop = async () => {
    for (const p of procs) p.kill("SIGTERM");
    await new Promise((r) => proxy.close(r));
    await new Promise((r) => setTimeout(r, 300));
    try { psql("postgres", ["-c", `DROP DATABASE IF EXISTS ${db} WITH (FORCE)`]); } catch {}
  };
  return { db, base, apiBase: `${base}/functions/v1/lh-agent-api`, applied, logs, stop, sql: (q) => sql(db, q) };
}
