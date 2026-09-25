# List Hub Finds (Shopping Buddy)

A **Find** is a deal or listing someone logged against a list item (usually a Wishlist item). The household shopping AI assistant — **Shopping Buddy** — can insert these with the Supabase **service role**. Household members (Chris / Ellen) can also add and remove Finds from the app.

Do not change Auth settings or the Site URL. All tables live in schema `list_hub`.

## Apply the migration first

File: [`supabase/migrations/20260925183000_list_hub_wishlist_finds.sql`](../supabase/migrations/20260925183000_list_hub_wishlist_finds.sql)

Until that SQL has been applied to project `dphkvcdohqsvefbdhsfx`, `list_hub.finds` / `list_hub.log_find` will not exist.

## Table insert shape (`list_hub.finds`)

`household_id` and attribution columns are filled by a trigger. Send:

| Column | Type | Required | Notes |
| --- | --- | --- | --- |
| `item_id` | uuid | yes | Wishlist/list item |
| `title` | text | yes | Short listing title |
| `price` | numeric(12,2) | no | USD; lowest price Find is the “best” |
| `source` | text | no | Seller/channel: `Amazon`, `eBay`, `FB Marketplace`, `Best Buy`, … |
| `url` | text | no | Listing URL |
| `condition` | text | no | `new` \| `used` \| `refurb` |
| `notes` | text | no | Optional |
| `found_at` | timestamptz | no | Defaults to `now()` |
| `found_by` | text | no | Service role → stored as `Shopping Buddy` |
| `found_by_kind` | text | no | Pass `assistant` for Shopping Buddy |

Example (service role, SQL):

```sql
insert into list_hub.finds (item_id, title, price, source, url, condition, notes, found_by_kind)
values (
  '6f3b413e-9f37-420f-a682-7ae142ca2317',  -- NVIDIA DGX Spark
  'DGX Spark 128GB — Amazon reseller',
  3999.00,
  'Amazon',
  'https://www.amazon.com/...',
  'new',
  'Ships in 2 weeks',
  'assistant'
);
```

Example (service role, PostgREST / supabase-js). Prefer the RPC below. Direct insert via the public view also works:

```js
const { data, error } = await supabase
  .from('lh_finds')
  .insert({
    item_id: '6f3b413e-9f37-420f-a682-7ae142ca2317',
    title: 'DGX Spark 128GB — Amazon reseller',
    price: 3999,
    source: 'Amazon',
    url: 'https://www.amazon.com/...',
    condition: 'new',
    notes: 'Ships in 2 weeks',
    found_by_kind: 'assistant'
  })
  .select()
  .single();
```

Current Wishlist item ids (Pollock Home):

| Item | id |
| --- | --- |
| Traeger Woodbridge Elite | `fdb9d08f-8e83-41d5-82dd-c1c330c8e48c` |
| NVIDIA DGX Spark | `6f3b413e-9f37-420f-a682-7ae142ca2317` |
| New PC | `5faeb9d9-b409-44a6-a65b-fb6aa73e6321` |

Look up others with:

```sql
select i.id, i.name, l.kind
from list_hub.items i
join list_hub.lists l on l.id = i.list_id
where l.household_id = 'a0000000-0000-4000-8000-000000000001'
  and i.status = 'needed';
```

## RPC `list_hub.log_find`

```sql
select list_hub.log_find(
  p_item_id    := '6f3b413e-9f37-420f-a682-7ae142ca2317',
  p_title      := 'DGX Spark 128GB — Amazon reseller',
  p_price      := 3999.00,
  p_source     := 'Amazon',
  p_url        := 'https://www.amazon.com/...',
  p_condition  := 'new',          -- new | used | refurb
  p_notes      := 'Ships in 2 weeks',
  p_found_at   := now(),          -- optional
  p_found_by   := 'Shopping Buddy' -- optional; service role always stores Shopping Buddy
);
```

Arguments:

| Arg | Type | Default |
| --- | --- | --- |
| `p_item_id` | uuid | required |
| `p_title` | text | required |
| `p_price` | numeric | null |
| `p_source` | text | null |
| `p_url` | text | null |
| `p_condition` | text | null |
| `p_notes` | text | null |
| `p_found_at` | timestamptz | `now()` |
| `p_found_by` | text | null |

- **service_role**: always attributed as Shopping Buddy (`found_by_kind = assistant`).
- **Signed-in household member**: attributed as Chris / Ellen from `list_hub.members`.
- RLS: only members of that household can read/write their Finds. service_role bypasses RLS.

`list_hub` is not the default PostgREST schema. From supabase-js with the service role, call SQL (above) or insert into `lh_finds` in `public`.

## Wishlist fields Shopping Buddy may also update

On `list_hub.items` (also exposed on `public.lh_items` after this migration):

| Column | Type | Meaning |
| --- | --- | --- |
| `notes` | text | Description |
| `target_price` | numeric(12,2) | Goal price |
| `preferred_store_id` | uuid | Household store |
| `preferred_source` | text | “eBay”, “FB Marketplace”, … |
| `product_links` | jsonb | `[{ "url": "https://…", "label": "Amazon" }, …]` or `["https://…"]` |

Items added by the assistant should insert with `created_by = 'Shopping Buddy'` (or `added_by_kind = 'assistant'`). A trigger sets the display name. New member inserts are stamped from the signed-in user. Older rows stay `added_by_kind = unknown` and the UI omits “who added it”.
