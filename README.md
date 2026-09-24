# List Hub · Home Beta

Phone-friendly household list hub for **Chris & Ellen** (Shopping Buddy / master shopper).

## Live URL

**https://list-hub-live.vercel.app**

## How to sign in (Chris & Ellen)

Auth is **email magic link** (preferred) with **email + password** fallback.

### Magic link (phone-friendly)

1. Open https://list-hub-live.vercel.app
2. Enter your household email (`christian@cruxibl.com` or `emfischer412@gmail.com`)
3. Tap **Send magic link**
4. Open the email on the same phone/browser and tap the link
5. You land signed in; header shows your name (Chris / Ellen)
6. Tap **Sign out** when done

Only emails in `lh_members` for this household are allowed. Others see a clear rejection.

### Password fallback

If magic-link email is blocked or redirect URLs are not set yet:

1. Switch to the **Password** tab
2. First time: enter email + new password (≥6 chars) → **Create password**
3. Later: **Sign in**
4. Session stays in `localStorage` via the Supabase client

## Supabase Auth redirect (manual step)

Magic links need the site URL allowlisted in Supabase:

1. Supabase Dashboard → project `dphkvcdohqsvefbdhsfx` → **Authentication** → **URL Configuration**
2. **Site URL**: `https://list-hub-live.vercel.app`
3. **Redirect URLs** add:
   - `https://list-hub-live.vercel.app`
   - `https://list-hub-live.vercel.app/**`
   - `http://localhost:3000/**` (optional, local)

Until that is set, use the **Password** tab.

Email auth is already enabled (`mailer_autoconfirm: true`).

## Features shipped

1. **Auth** — magic link OTP + password fallback; allowlist via `lh_members`; auto `who` from `display_name`; sign out
2. **Store optional** — default “Let Shopping Buddy / usual”; blank looks up item prefs / history; UI hint “leave blank to decide later”
3. **Add custom store** — picker option “+ Add store…” → insert into `lh_stores` (`kind=other`, `sort_order=50`)
4. **History suggestions** — chips while typing from past `lh_items` + prefs; tap to fill name/qty/store; upsert prefs on add
5. **Voice add** — mic → Web Speech API → parse qty / “and” / commas → confirm chips → insert
6. **Barcode** — camera (`BarcodeDetector`) or photo; Open Food Facts lookup; prefill name
7. **Existing** — Grocery / Wish / Watch tabs, check/uncheck/delete, finalize/reopen, discreet, `created_by`, mobile dark UI

## How Shopping Buddy uses the DB

Supabase project: `dphkvcdohqsvefbdhsfx`

| View | Underlying |
|------|------------|
| `lh_households` | `list_hub.households` |
| `lh_stores` | `list_hub.stores` |
| `lh_lists` | `list_hub.lists` |
| `lh_items` | `list_hub.items` |
| `lh_members` | `list_hub.members` |
| item prefs view | `list_hub.item_prefs` |

Household id: `a0000000-0000-4000-8000-000000000001`

Item statuses: `needed` | `have` | `checked` | `dropped`  
List statuses: `open` | `finalized` | `archived`

## Stack / files

Static site (no build):

- `index.html` / `styles.css` / `app.js` — source
- `index.bundled.html` — single-file deploy (inline CSS/JS; Supabase JS from CDN)
- Vercel project: `list-hub-live` (SSO protection disabled for public home-beta access)

## Deploy notes

Prior CDN flakiness → production serves **bundled HTML**. Push source to GitHub `ashandgrind/list-hub-home-beta` and redeploy Vercel with the bundled `index.html`.

## Known beta limits

- No auto-push to Publix / Sam's / Walmart apps yet
- Anon key embedded in client (private household beta)
- No realtime sync (refresh on action)
- Voice / barcode need a modern Chromium or Safari with permissions
