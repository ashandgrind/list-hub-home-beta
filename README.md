# List Hub

Phone-friendly household lists for **Chris & Ellen**, with Shopping Buddy as the household shopping assistant.

Live: **https://hq.cruxibl.com/listhub/** (primary; auto-deploys from `main`)

Legacy: https://list-hub-live.vercel.app and https://pollock-lists.vercel.app (Vercel project `pollock-lists`, not updated from this repo)

This repo is the source for the live two-list app (List + Wishlist, trip planning, magic-link auth, voice add, barcode scan). Schema: Supabase project `dphkvcdohqsvefbdhsfx`, `list_hub` (public `lh_*` views).

## Features

- Email magic link + password fallback (household allowlist only)
- **List** (everyday / groceries) and **Wishlist**
- Auto-categories (local + `lh-categorize`) and store prefs
- Voice add and barcode scan (iPhone Safari / Chrome)
- Store trip planning
- Who added each item (Chris / Ellen / Shopping Buddy; older rows omit this)
- Wishlist detail sheet: notes, target price, store/source, links, **Finds** log
- **Find options** on Wishlist items (once / daily / weekly research jobs for Shopping Buddy)
- Shopping Buddy can poll due jobs and log Finds — see [docs/finds.md](docs/finds.md)

## Sign in

1. Open the live URL
2. Enter `christian@cruxibl.com` or `emfischer412@gmail.com`
3. Use **Email link** (open it on the same phone) or the **Password** tab

## Schema / migration

New wishlist columns, `list_hub.finds`, RLS, and `list_hub.log_find` are in:

`supabase/migrations/20260925183000_list_hub_wishlist_finds.sql`

Find requests (once / daily / weekly), RLS, `list_hub.due_find_requests()`, and `list_hub.complete_find_run()` are in:

`supabase/migrations/20260925190000_list_hub_find_requests.sql`

Apply those files on project `dphkvcdohqsvefbdhsfx` **before** expecting Finds / Find options to persist. They only change `list_hub` plus the existing public `lh_*` wrappers (`lh_items`, `lh_finds`, `lh_find_requests`, `lh_due_find_requests`, `lh_complete_find_run`). They do **not** change Auth or the Site URL.

## Deploy

**Merge to `main` = deploy.** Vercel project `list-hub-home-beta` (team ashandgrind1) is git-linked to this repo and builds every push to `main` to production (`https://list-hub-home-beta.vercel.app`).

`https://hq.cruxibl.com/listhub/` is served by the HQ Cloudflare tunnel (`hq`, config on the HQ desktop at `C:\Users\chris\.cloudflared\config.yml`): requests whose path starts with `/listhub` go straight to `list-hub-home-beta.vercel.app`; everything else on hq.cruxibl.com stays on Mission Control.

Cache safety: `scripts/build.mjs` (no dependencies) copies `app.js` / `styles.css` into `dist/assets/` with content-hashed names and rewrites `index.html` to point at them. `vercel.json` serves HTML with `Cache-Control: no-cache` and hashed assets as immutable, so a new release reaches phones on the next load. Keep asset references in `index.html` relative (no leading `/`) so the app works both at `/` and under `/listhub/`. Auth redirects use `lhAuthRedirect()` (current origin + directory).

`<meta name="list-hub-commit">` in the served HTML shows which commit is live.

GitHub Pages workflow still deploys `main` as a static site (secondary).

## Do not

- Email Ellen from agents
- Touch tattoo-shop tables or Auth / Site URL
- Spend money
