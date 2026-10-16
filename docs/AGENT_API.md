# List Hub Agent API

Any AI assistant (Grok Bot, ChatGPT, Claude, a custom agent) can read the household's List and Wishlist, add grocery items, remove items, and mark progress while shopping.

Tokens are created in the app: **Menu > AI agents**. The plaintext token is shown **once**. Only a SHA-256 hash is stored. Each token has a **label** (defaults to its name). Items the token adds show that label as who added them, and a household member can tap the label in Menu > AI agents to rename it. Renaming relabels items the token already added, because the app shows the token's current label.

Do not change Auth settings or the Site URL. Tables live in schema `list_hub`. OpenAPI version: `1.1.0`.

## Deploy (backend first, then the app)

Project: `dphkvcdohqsvefbdhsfx`. Merging to `main` deploys the front end only. Migrations and the edge function are manual.

1. Apply the migrations in order (SQL editor or `supabase db push`). Both are additive.

   - [`20260928120000_list_hub_agent_tokens.sql`](../supabase/migrations/20260928120000_list_hub_agent_tokens.sql) (already live): `list_hub.agent_tokens`, `items.agent_state` / `items.agent_note`, token RPCs.
   - [`20261016210000_list_hub_token_labels_removals.sql`](../supabase/migrations/20261016210000_list_hub_token_labels_removals.sql): `agent_tokens.label`, `items.added_by_token_id`, `items.agent_by_token_id`, `list_hub.item_removals` + `items_log_removal` trigger, updated `set_item_adder`, RPCs `lh_rename_agent_token`, `lh_agent_token_labels`, `lh_agent_remove_item`, `lh_item_removals`.

2. Deploy the edge function with **JWT verification OFF**. Auth is the `lh_` bearer token, checked with the service role.

   ```bash
   supabase functions deploy lh-agent-api \
     --project-ref dphkvcdohqsvefbdhsfx \
     --no-verify-jwt
   ```

   Source: [`supabase/functions/lh-agent-api/index.ts`](../supabase/functions/lh-agent-api/index.ts). Config: [`supabase/config.toml`](../supabase/config.toml) (`verify_jwt = false`).

3. **Secrets:** none to add. The function uses the auto-injected `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

4. Merge the app (Vercel builds the front end).

The new app degrades gracefully if step 1 is not applied yet (labels fall back to Shopping Buddy, rename shows an error). The new edge function needs step 1 for remove (`lh_agent_remove_item`) and token stamps, so apply the migration first.

## Base URL

```
https://dphkvcdohqsvefbdhsfx.supabase.co/functions/v1/lh-agent-api
```

OpenAPI 3.1 (no token required): `GET {base}/openapi.json`

## Auth

```
Authorization: Bearer lh_...
```

Unknown, missing, or revoked tokens return `401` with `{ "error": "unauthorized", "message": "..." }`. Light rate limit: 60 requests per minute per IP and per token (`429`). CORS is open so agent platforms can call the API from a browser.

## Endpoints

### `GET /list?format=json|markdown|csv&status=open`

Open grocery List items (`items.status = 'needed'`). Default format is `json`. Markdown is grouped by preferred store, then section, then subsection.

Each item: `id`, `name`, `quantity`, `note`, `section`, `subsection`, `preferred_store` (or `null`), `agent_state`.

### `GET /wishlist?format=json|markdown|csv&status=open`

Same shape for Wishlist items.

### `POST /items`

```json
{ "name": "beef jerky", "quantity": "2", "store": "Publix", "note": "original flavor" }
```

Adds one row to the household grocery list (not the wishlist), `status` `needed`.

| Field | Required | Limit | Notes |
| --- | --- | --- | --- |
| `name` | yes | 200 chars | whitespace collapsed |
| `quantity` | no | 60 chars | free text (`"2"`, `"2 dozen"`), stored in `items.qty` |
| `store` | no | 80 chars | name, slug, or id of a household store. Unknown store returns `400 unknown_store` with `stores` (the known names) |
| `note` | no | 240 chars | stored in `items.notes` |

The row is stamped with `added_by_token_id` and `created_by` = the token's label. Response:

```json
{ "ok": true, "added_by": "House", "item": { "id": "...", "name": "beef jerky", "quantity": "2", "note": "original flavor", "preferred_store": "Publix", "...": "..." } }
```

### `POST /items/{id}/remove`

Hard-deletes that row (List or Wishlist), the same write as the app remove button. No purchase is recorded. The delete runs through `lh_agent_remove_item`, so the `items_log_removal` trigger writes a row to `list_hub.item_removals` with the token id and label.

```json
{ "ok": true, "id": "...", "name": "beef jerky", "removed": "deleted", "removed_by": "House" }
```

### `POST /items/{id}/status`

```json
{ "status": "in_cart" | "bought" | "unavailable", "store": "Publix", "note": "optional" }
```

| Agent status | What List Hub does |
| --- | --- |
| `in_cart` | Sets `agent_state = in_cart`. Item stays **needed** (still on the open list). |
| `unavailable` | Sets `agent_state = unavailable`. Item stays **needed**. |
| `bought` | Sets `status = checked` (same as tapping the check). The purchase trigger records a checkoff. |

Every status call sets `items.agent_by_token_id` to the calling token. For `bought`, the purchase row's `created_by` is changed from `system` to the token's label. `store` may be a store name, slug, or id; when it matches, `preferred_store_id` is updated. The response includes `by` (the token label).

## Removal log

`list_hub.item_removals` gets one row per deleted item, from the app or the API:

`household_id, item_id, item_name, item_qty, list_id, list_kind, list_name, item_status, removed_by_kind (agent | member | service | unknown), removed_by_token_id, removed_by_user_id, removed_by_label, removed_at`

No foreign keys, so the log outlives the item, list, and token. RLS: household members can SELECT their household's rows. Signed-in members can read recent removals with `lh_item_removals(p_limit)`.

## RPCs (signed-in household members)

| RPC | Returns |
| --- | --- |
| `lh_create_agent_token(name text)` | `{ id, name, label, token, created_at, created_by }`. **Token only this once** |
| `lh_list_agent_tokens()` | `[{ id, name, label, created_by, created_at, last_used_at, revoked_at }]` (active only) |
| `lh_rename_agent_token(id uuid, label text)` | `{ ok, id, name, label }` (label 1 to 80 chars) |
| `lh_agent_token_labels()` | `{ "<token id>": "<label>" }` for every token in the household, revoked included (so old items keep their label) |
| `lh_revoke_agent_token(id uuid)` | `{ ok, id, revoked_at }` |
| `lh_item_removals(p_limit int default 50)` | recent removal log rows |

Service role only: `lh_agent_remove_item(p_item_id uuid, p_token_id uuid)`.

RLS on `list_hub.agent_tokens` is SELECT for household members only. Insert, rename, and revoke go through the SECURITY DEFINER RPCs.

## Who added it (labels)

- Member adds: the member's display name (Chris, Ellen).
- Token adds: the token's **current** label, title-cased (`house` shows as `House`).
- Shopping Buddy bot (service role, no token): `Shopping Buddy`. Also the fallback when a token label cannot be loaded.

## Token format

Prefix `lh_`, then 32 random bytes encoded as base64url. Stored as `encode(digest(token, 'sha256'), 'hex')` via `list_hub.agent_token_hash`.

## App: instructions for your AI

Menu > AI agents shows a copyable "Instructions for your AI" block (built by `agentInstructionsSnippet()` in `app.js`). It is the same for every token and uses the household name from `lh_households`.

## App: Export for AI (no token)

On the **List** tab, **Export for AI** builds the same store, section markdown from the list already on the phone and uses the Web Share sheet when the browser has it (iPhone Chrome / Safari). If share is cancelled or missing, it copies to the clipboard.
