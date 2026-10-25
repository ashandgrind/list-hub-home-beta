# List embed (TV and dashboard widget)

A read-only, login-free view of a household's main List, grouped by section and aisle the same way the app groups it. Built for wall TVs and home dashboards (iframe), usable by any household.

## URL format

```
https://<list hub host>/listhub/embed#token=<embed token>
https://<list hub host>/listhub/embed#token=<embed token>&refresh=60&theme=dark&columns=auto&store=Costco&scroll=1
```

Hosts that serve List Hub at the root (for example `list-hub-home-beta.vercel.app`) also answer at `/embed`.

The token goes after `#`, so it is never sent to a server, never lands in access logs and never leaks in a Referer header. `?token=` also works; the page moves it into the `#` part on load.

| Param | Default | Values |
| --- | --- | --- |
| `token` | required | an embed token (`lhe_...`) |
| `refresh` | `60` | seconds between refreshes, 15 to 3600 |
| `theme` | `dark` | `dark` or `light` |
| `columns` | `auto` | `auto` (fits the width) or `1` to `4` |
| `store` | none | show only items for one store (case-insensitive), for example `Costco` |
| `scroll` | `1` | `0` or `off` turns off the slow auto-scroll used when the list is taller than the screen |

The page also refreshes when it becomes visible again. If List Hub can't be reached it keeps showing the last list with an "Offline" note and keeps retrying.

## What it shows

Only items that are still needed on the household's main List (`needs`, or `grocery` for older households): name, quantity, store, section and aisle. No notes, emails, member names or ids. Items marked discreet are left out.

An invalid or revoked token shows a plain message and stops refreshing.

## Tokens

Embed tokens are separate from AI agent tokens (`lh_...`). An embed token can only read the list through the embed; it does not work with the agent API or for any write. An agent token does not work as an embed token. Only a SHA-256 hash is stored. Each token belongs to one household, has a label, and can be revoked at any time. A household can have up to 20 active embed tokens.

**In the app (any member):** Menu > TV and embed. Enter a label (for example "Kitchen TV"), tap **Create link**, then copy the link. The full link is shown once; if you lose it, revoke it and create a new one. Active links are listed with when they were last used; tap **Revoke** to turn one off right away.

**In the Supabase SQL editor (admin, any household):**

```sql
-- create: returns the token once, keep it out of chats and tickets
select * from public.lh_create_embed_token('Kitchen TV', <household id>);
-- list active tokens (no token values)
select * from public.lh_list_embed_tokens(<household id>);
-- revoke
select public.lh_revoke_embed_token('<token id>');
```

Leave out the household id to use your own household.

## Framing

The embed route sends `Content-Security-Policy: frame-ancestors *` (and no `X-Frame-Options`), so any page can show it in an iframe:

```html
<iframe src="https://hq.cruxibl.com/listhub/embed#token=..." style="border:0;width:100%;height:100%"></iframe>
```

When a proxy in front of List Hub adds `X-Frame-Options`, modern browsers still follow the CSP `frame-ancestors` rule from the route. The rest of the app keeps its existing headers.

## How it works

`embed.html` + `embed.js` + `embed.css` are static. `embed.js` calls the security definer RPC `public.lh_embed_list(token)` with the public anon key. The RPC checks the token hash, refuses revoked tokens, and returns only the fields above. Migration: `supabase/migrations/20261025120000_list_hub_embed_tokens.sql`. No edge function.
