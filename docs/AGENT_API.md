# List Hub Agent API

Any AI assistant (Grok Bot, ChatGPT, Claude, a custom agent) can read the household’s current List / Wishlist and mark progress after filling a native store cart.

Tokens are created in the app: **Menu → AI agents**. The plaintext token is shown **once**. Only a SHA-256 hash is stored.

Do not change Auth settings or the Site URL. Tables live in schema `list_hub`.

## Deploy (backend first, then merge the app)

Project: `dphkvcdohqsvefbdhsfx`.

1. Apply the migration (SQL editor or `supabase db push`):

   [`supabase/migrations/20260928120000_list_hub_agent_tokens.sql`](../supabase/migrations/20260928120000_list_hub_agent_tokens.sql)

   Additive only: `list_hub.agent_tokens`, `items.agent_state` / `items.agent_note`, and public RPCs `lh_create_agent_token`, `lh_list_agent_tokens`, `lh_revoke_agent_token`. Does **not** replace `lh_bootstrap` or Auth.

2. Deploy the edge function with **JWT verification OFF**. Auth is the `lh_` bearer token, checked with the service role.

   ```bash
   supabase functions deploy lh-agent-api \
     --project-ref dphkvcdohqsvefbdhsfx \
     --no-verify-jwt
   ```

   Dashboard equivalent: Edge Functions → `lh-agent-api` → uncheck **Verify JWT**.

   Function source: [`supabase/functions/lh-agent-api/index.ts`](../supabase/functions/lh-agent-api/index.ts)

   Config flag: [`supabase/config.toml`](../supabase/config.toml) (`[functions.lh-agent-api] verify_jwt = false`).

3. **Secrets:** none to add. The function uses the auto-injected `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. No xAI / other keys.

4. After the SQL and function are live, merge the app PR so Menu / Export for AI can call the RPCs.

Until step 1 is applied, Menu → AI agents will say the migration is missing. **Export for AI** on the List tab still works — it copies the list already loaded in the app and does not need a token.

## Base URL

```
https://dphkvcdohqsvefbdhsfx.supabase.co/functions/v1/lh-agent-api
```

OpenAPI 3.1 (no token required): `GET {base}/openapi.json`

## Auth

```
Authorization: Bearer lh_…
```

Unknown, missing, or revoked tokens return `401` with `{ "error": "unauthorized", "message": "…" }`. Light rate limit: 60 requests / minute per IP and per token (`429`). CORS is open so agent platforms can call the API from a browser.

## Endpoints

### `GET /list?format=json|markdown|csv&status=open`

Open grocery List items (`items.status = 'needed'`). Default format is `json`. Markdown is grouped by preferred store, then section, then subsection.

Each item: `id`, `name`, `quantity`, `note`, `section`, `subsection`, `preferred_store` (or `null`), `agent_state`.

### `GET /wishlist?format=json|markdown|csv&status=open`

Same shape for Wishlist items.

### `POST /items/{id}/status`

```json
{ "status": "in_cart" | "bought" | "unavailable", "store": "Publix", "note": "optional" }
```

| Agent status | What List Hub does |
| --- | --- |
| `in_cart` | Sets `agent_state = in_cart`. Item stays **needed** (still on the open list). |
| `unavailable` | Sets `agent_state = unavailable`. Item stays **needed**. |
| `bought` | Sets `status = checked` (same as tapping ✓). The existing purchase trigger records a checkoff. |

`store` may be a store name, slug, or id; when it matches, `preferred_store_id` is updated so the purchase event has a store.

## RPCs (signed-in household members)

| RPC | Returns |
| --- | --- |
| `lh_create_agent_token(name text)` | `{ id, name, token, created_at, created_by }` — **token only this once** |
| `lh_list_agent_tokens()` | `[{ id, name, created_by, created_at, last_used_at, revoked_at }]` |
| `lh_revoke_agent_token(id uuid)` | `{ ok, id, revoked_at }` |

RLS on `list_hub.agent_tokens` is SELECT for household members only. Insert / revoke go through the SECURITY DEFINER RPCs.

## Token format

Prefix `lh_`, then 32 random bytes encoded as base64url. Stored as `encode(digest(token, 'sha256'), 'hex')` via `list_hub.agent_token_hash`.

## App: Export for AI (no token)

On the **List** tab, **Export for AI** builds the same store → section markdown from the list already on the phone and uses the Web Share sheet when the browser has it (iPhone Chrome / Safari). If share is cancelled or missing, it copies to the clipboard.
