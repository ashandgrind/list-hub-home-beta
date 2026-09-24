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
4. Open the email on the **same phone/browser**
5. You land signed in as Chris or Ellen (from member display name)

### Password fallback

1. Open the app → **Password** tab
2. Enter the same allowlisted email + password (min 6 chars)
3. First time: tap **Create password** (self-serve for allowlisted emails only)
4. Later: **Sign in**

Other emails are rejected with a clear message.

## Supabase Auth redirect URL (manual dashboard click)

Magic links need Site URL / Redirect URLs to include:

- `https://list-hub-live.vercel.app`
- `https://list-hub-live.vercel.app/**`
- Optional: `http://localhost:3000`

Set in **Supabase Dashboard → Authentication → URL Configuration**.
This agent could not set Auth URL config via API.

Until redirects are set, use the **Password** tab.

## Features shipped

- [x] Magic link OTP + password fallback; allowlist via members; sign out; localStorage session
- [x] Store optional (“Let Shopping Buddy / usual”); prefs lookup on add; UI hint
- [x] “+ Add store…” → insert stores for household
- [x] History suggestion chips + upsert item prefs on add
- [x] Voice add (Web Speech API) + confirm chips
- [x] Barcode (BarcodeDetector / file) + Open Food Facts
- [x] Grocery / Wish / Watch, check/delete, finalize/reopen, discreet, created_by, dark mobile UI

## Deploy notes

- Repo: https://github.com/ashandgrind/list-hub-home-beta
- `index.html` is the source of truth for DOM ids the decoded app binds on init (`barcode-btn`, `scan-modal`, `scan-close`, `scan-file-btn`, `scan-video`, `scan-hint`, `toast`, `voice-confirm`, plus auth/list nodes).
- `list-hub-live.vercel.app` still serves a small CDN boot shell that can have Magic/Password auth while missing those voice/barcode nodes. `app.js` **self-upgrades** any shell that is missing a required id (not just a missing magic-link form) by fetching this repo’s `index.html`, then loads `app.b64.0..3.txt`.
- After merge, pin jsDelivr to the fix commit SHA (see the PR) so the live shell picks up the new loader:
  `https://cdn.jsdelivr.net/gh/ashandgrind/list-hub-home-beta@<SHA>/app.js`
- New Vercel projects (`list-hub-live-v7`, `list-hub-home`) are behind team SSO — cannot replace the production alias without dashboard permission.
- Prefer magic link; password fallback until Auth redirects are configured.

## Do not

- Email Ellen from agents
- Touch tattoo-shop tables
- Spend money
