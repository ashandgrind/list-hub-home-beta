# Local agent API harness

Runs the real `lh-agent-api` edge function and this repo's newer migrations against a
throwaway local Postgres. Never touches production.

Pieces:

- `supabase-stub.sql`: minimal Supabase roles and `auth.uid()` / `auth.jwt()` / `auth.role()`.
- `prod-schema-2026-10-16.sql`: schema-only snapshot of `list_hub` (tables, constraints, functions, public `lh_*` views, triggers, RLS) read from the live project on 2026-10-16. No data.
- Migrations in `supabase/migrations/` dated after 2026-10-16 are applied on top.
- `grants.sql`: approximate Supabase default grants.
- `stack.mjs`: creates the database, seeds a test household ("Test Home", Chris, Ellen, Publix, Costco, one token named `house`), starts PostgREST and the edge function under Deno, and fronts them with one proxy shaped like `https://<ref>.supabase.co` (`/rest/v1`, `/functions/v1`, a stub `/auth/v1/user`).

Needs `psql`, `postgrest` (v12+), `deno` (v2), and a local Postgres superuser
(`PGHOST`, `PGUSER`, `PGPASSWORD`; default `localhost` / `postgres` / `postgres`).

```bash
node tests/agent-local/test-agent-api.mjs     # API + migration checks
node tests/agent-local/verify-agent-ui.mjs    # app UI against the same stack (Playwright), writes screenshots
```

Both exit 1 when any check fails.
