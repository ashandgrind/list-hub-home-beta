-- List Hub: two-level categories (section > subsection / store aisle).
--
-- Safe to apply while the currently deployed app is still live:
--   * `category` stays the legacy section (Food, Household, …) so the old
--     List grouping and CHECK constraints keep working.
--   * `lh_bootstrap().cats` remains `{ name_key: category_string }`.
--   * New fields (`subsection` on items/cache, `subcats` on bootstrap) are
--     ignored by the old client.
--   * The new client works BEFORE this file is applied (it infers aisles
--     locally) and AFTER (it persists them).
--
-- Apply on project dphkvcdohqsvefbdhsfx (SQL editor or `supabase db push`).
-- Does not touch Auth, Site URL, or tattoo-shop tables.
--
-- After applying, deploy the updated `lh-categorize` function from
-- `supabase/functions/lh-categorize/index.ts` so AI returns section+subsection.

-- ---------------------------------------------------------------------------
-- columns
-- ---------------------------------------------------------------------------
ALTER TABLE list_hub.items
  ADD COLUMN IF NOT EXISTS subsection text;

ALTER TABLE list_hub.category_cache
  ADD COLUMN IF NOT EXISTS subsection text;

ALTER TABLE list_hub.trip_items
  ADD COLUMN IF NOT EXISTS subsection text;

COMMENT ON COLUMN list_hub.items.subsection IS
  'Store-aisle / second-level category (Produce, Dairy & Eggs, …). category remains the legacy section.';
COMMENT ON COLUMN list_hub.category_cache.subsection IS
  'Cached aisle for name_key. category remains the legacy section for old clients.';

-- Allow new section names on category without dropping the old ones.
-- The live app still writes the original 10 values.
ALTER TABLE list_hub.items
  DROP CONSTRAINT IF EXISTS items_category_check;
ALTER TABLE list_hub.items
  ADD CONSTRAINT items_category_check
  CHECK (
    category IS NULL
    OR category = ANY (ARRAY[
      'Food'::text, 'Household'::text, 'Personal care'::text, 'Personal Care'::text,
      'Health'::text, 'Electronics'::text, 'Pets'::text, 'Baby'::text,
      'Hardware'::text, 'Clothing'::text, 'Other'::text,
      'Outdoor & Sports'::text, 'Auto'::text
    ])
  );

ALTER TABLE list_hub.category_cache
  DROP CONSTRAINT IF EXISTS category_cache_category_check;
ALTER TABLE list_hub.category_cache
  ADD CONSTRAINT category_cache_category_check
  CHECK (
    category = ANY (ARRAY[
      'Food'::text, 'Household'::text, 'Personal care'::text, 'Personal Care'::text,
      'Health'::text, 'Electronics'::text, 'Pets'::text, 'Baby'::text,
      'Hardware'::text, 'Clothing'::text, 'Other'::text,
      'Outdoor & Sports'::text, 'Auto'::text
    ])
  );

-- ---------------------------------------------------------------------------
-- classifier used to backfill existing rows (mirrors categories.js)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_hub.guess_aisle(p_name text, p_category text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  t text := ' ' || lower(trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'))) || ' ';
BEGIN
  IF t ~* '\m(dog|dogs|puppy|puppies|cat food|cat litter|kitten|kitty|pet|pets|litter|kibble|purina|friskies|pedigree|cats?)\M' THEN
    RETURN '';
  END IF;
  IF t ~* '\m(baby|babies|diaper|diapers|wipes|formula|pacifier|infant|toddler|pampers|huggies)\M' THEN
    RETURN 'Baby';
  END IF;
  IF t ~* '\m(medicine|meds|tylenol|advil|ibuprofen|vitamin|band-?aid|first aid|nyquil|melatonin)\M' THEN
    RETURN 'Health & Medicine';
  END IF;
  IF t ~* '\m(makeup|mascara|lipstick|moisturizer|sunscreen|perfume|cologne|serum)\M' THEN
    RETURN 'Beauty';
  END IF;
  IF t ~* '\m(shampoo|conditioner|toothpaste|toothbrush|deodorant|razor|body wash|floss|lotion|dove|colgate|crest)\M' THEN
    RETURN 'Hygiene';
  END IF;
  IF t ~* '\m(pc|laptop|desktop|macbook|computer|nvidia|gpu|dgx|monitor|keyboard)\M' THEN
    RETURN 'Computers';
  END IF;
  IF t ~* '\m(headphones|earbuds|airpods|speaker|soundbar|\ytv\y|hdmi|roku)\M' THEN
    RETURN 'Audio & Video';
  END IF;
  IF t ~* '\m(smart plug|alexa|echo dot|google nest|thermostat|smart home)\M' THEN
    RETURN 'Smart Home';
  END IF;
  IF t ~* '\m(batter(y|ies)|charger|cable|usb|phone case|duracell|energizer)\M' THEN
    RETURN 'Accessories & Cables';
  END IF;
  IF t ~* '\m(motor oil|wiper|antifreeze|coolant|car wash|tire|automotive)\M' THEN
    RETURN 'Auto';
  END IF;
  IF t ~* '\m(traeger|weber|grill|smoker|camping|tent|kayak|bike|bicycle|yoga|soccer)\M' THEN
    RETURN 'Outdoor & Sports';
  END IF;
  IF t ~* '\m(laundry|detergent|fabric softener|dryer sheets|tide|downy|bleach)\M' THEN
    RETURN 'Laundry';
  END IF;
  IF t ~* '\m(cleaner|lysol|clorox|windex|sponge|mop|dish soap|dishwasher|dawn|cascade)\M' THEN
    RETURN 'Cleaning';
  END IF;
  IF t ~* '\m(paper towel|toilet paper|tissue|kleenex|napkin|trash bag|foil|ziploc|bounty|charmin|glad)\M' THEN
    RETURN 'Paper & Plastic';
  END IF;
  IF t ~* '\m(light ?bulb|cutting board|air fryer|coffee maker|skillet)\M' THEN
    RETURN 'Kitchen';
  END IF;
  IF t ~* '\m(hose|mulch|fertilizer|potting soil|weed killer|lawn|garden|candle)\M' THEN
    RETURN 'Home & Garden';
  END IF;
  IF t ~* '\m(screw|nail|bolt|drill|hammer|wrench|screwdriver|duct tape|wd-?40)\M' THEN
    RETURN 'Tools & Hardware';
  END IF;
  IF t ~* '\m(sock|shirt|pants|jeans|hoodie|shoes|sneakers|underwear|jacket)\M' THEN
    RETURN 'Clothing';
  END IF;
  IF t ~* '\m(frozen|ice cream|popsicle|eggo|pizza rolls|tater tots|frozen pizza)\M' THEN
    RETURN 'Frozen';
  END IF;
  IF t ~* '\m(banana|apple|orange|lemon|lime|grape|berr|avocado|tomato|potato|onion|garlic|lettuce|spinach|carrot|broccoli|pepper|cucumber|mushroom|produce|fruit|veggie|vegetable|salad)\M' THEN
    RETURN 'Produce';
  END IF;
  IF t ~* '\m(chicken|beef|steak|pork|bacon|sausage|turkey|fish|salmon|shrimp|tofu|ground beef|hot dog)\M' THEN
    RETURN 'Meat & Seafood';
  END IF;
  IF t ~* '\m(deli|lunch meat|salami|hummus|rotisserie)\M' THEN
    RETURN 'Deli';
  END IF;
  IF t ~* '\m(milk|egg|butter|cheese|yogurt|yoghurt|oikos|cream|creamer|cottage cheese)\M' THEN
    RETURN 'Dairy & Eggs';
  END IF;
  IF t ~* '\m(bread|bagel|tortilla|bun|muffin|croissant|donut|bakery)\M' THEN
    RETURN 'Bakery & Bread';
  END IF;
  IF t ~* '\m(cereal|oats|oatmeal|granola|fruity pebbles|cheerios|pancake|waffle|pop tart)\M' THEN
    RETURN 'Breakfast & Cereal';
  END IF;
  IF t ~* '\m(juice|coffee|tea|soda|beer|wine|seltzer|kombucha|gatorade|coke|pepsi|la croix)\M' THEN
    RETURN 'Beverages';
  END IF;
  IF t ~* '\m(chips|cracker|cookie|snack|protein bar|candy|chocolate|popcorn|pretzel|nuts)\M' THEN
    RETURN 'Snacks';
  END IF;
  IF t ~* '\m(canned|beans|rice|pasta|flour|sugar|ketchup|mustard|mayo|sauce|salsa|peanut butter|soup|spice|oil|vinegar)\M' THEN
    RETURN 'Pantry';
  END IF;

  IF p_category IN ('Food') THEN RETURN 'Pantry'; END IF;
  IF p_category IN ('Household') THEN RETURN 'Cleaning'; END IF;
  IF p_category IN ('Personal care', 'Personal Care') THEN RETURN 'Hygiene'; END IF;
  IF p_category IN ('Health') THEN RETURN 'Health & Medicine'; END IF;
  IF p_category IN ('Baby') THEN RETURN 'Baby'; END IF;
  IF p_category IN ('Electronics') THEN RETURN 'Accessories & Cables'; END IF;
  IF p_category IN ('Hardware') THEN RETURN 'Tools & Hardware'; END IF;
  RETURN '';
END;
$function$;

CREATE OR REPLACE FUNCTION list_hub.guess_legacy(p_name text, p_category text DEFAULT NULL)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE list_hub.guess_aisle(p_name, p_category)
    WHEN 'Baby' THEN 'Baby'
    WHEN 'Health & Medicine' THEN 'Health'
    WHEN 'Tools & Hardware' THEN 'Hardware'
    WHEN 'Auto' THEN 'Hardware'
    WHEN 'Outdoor & Sports' THEN 'Hardware'
    WHEN 'Computers' THEN 'Electronics'
    WHEN 'Accessories & Cables' THEN 'Electronics'
    WHEN 'Audio & Video' THEN 'Electronics'
    WHEN 'Smart Home' THEN 'Electronics'
    WHEN 'Hygiene' THEN 'Personal care'
    WHEN 'Beauty' THEN 'Personal care'
    WHEN 'Cleaning' THEN 'Household'
    WHEN 'Laundry' THEN 'Household'
    WHEN 'Paper & Plastic' THEN 'Household'
    WHEN 'Kitchen' THEN 'Household'
    WHEN 'Home & Garden' THEN 'Household'
    WHEN 'Clothing' THEN 'Clothing'
    WHEN '' THEN
      CASE
        WHEN lower(coalesce(p_name, '')) ~ '\m(dog|cat|pet|litter|kibble)\M' THEN 'Pets'
        ELSE coalesce(p_category, 'Other')
      END
    ELSE 'Food'
  END;
$function$;

-- Reclassify existing items. Keep user-chosen sections. Fill aisles for everyone.
UPDATE list_hub.items
SET
  subsection = list_hub.guess_aisle(name, category),
  category = CASE
    WHEN category_source IS DISTINCT FROM 'user'
         AND (category IS NULL OR category = 'Other')
      THEN list_hub.guess_legacy(name, category)
    ELSE category
  END,
  updated_at = now()
WHERE subsection IS NULL
   OR (category_source IS DISTINCT FROM 'user' AND (category IS NULL OR category = 'Other'));

UPDATE list_hub.category_cache
SET
  subsection = list_hub.guess_aisle(name_key, category),
  category = CASE
    WHEN source IS DISTINCT FROM 'user'
         AND (category IS NULL OR category = 'Other')
      THEN list_hub.guess_legacy(name_key, category)
    ELSE category
  END,
  updated_at = now();

UPDATE list_hub.trip_items
SET subsection = list_hub.guess_aisle(name, category)
WHERE subsection IS NULL;

-- ---------------------------------------------------------------------------
-- views (additive column only; keep existing security_invoker + local check option)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW list_hub.lh_items
WITH (security_invoker = true) AS
SELECT
  id, list_id, name, qty, notes, preferred_store_id, status, discreet, sort_order,
  created_by, created_at, updated_at, category, category_source, barcode,
  bought_at, trip_id, target_price, preferred_source, product_links,
  added_by_user_id, added_by_kind, subsection
FROM list_hub.items;

CREATE OR REPLACE VIEW public.lh_items
WITH (security_invoker = true) AS
SELECT
  id, list_id, name, qty, notes, preferred_store_id, status, discreet, sort_order,
  created_by, created_at, updated_at, category, category_source, barcode,
  bought_at, trip_id, target_price, preferred_source, product_links,
  added_by_user_id, added_by_kind, subsection
FROM list_hub.items;

CREATE OR REPLACE VIEW public.lh_category_cache
WITH (security_invoker = true) AS
SELECT household_id, name_key, category, source, updated_at, subsection
FROM list_hub.category_cache
WHERE list_hub.is_member(household_id)
   OR COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
WITH LOCAL CHECK OPTION;

CREATE OR REPLACE VIEW public.lh_trip_items
WITH (security_invoker = true) AS
SELECT id, trip_id, household_id, item_id, name, qty, category, checked,
       checked_at, sort_order, created_at, subsection
FROM list_hub.trip_items
WHERE list_hub.is_member(household_id)
WITH LOCAL CHECK OPTION;

GRANT SELECT, INSERT, UPDATE, DELETE ON list_hub.lh_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lh_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lh_category_cache TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lh_trip_items TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- lh_bootstrap: extra keys only. `cats` stays name_key -> category string.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lh_bootstrap()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare m list_hub.members; hh uuid;
begin
  select * into m from list_hub.members x
    where x.user_id = auth.uid() or lower(x.email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
  if m.household_id is null then return json_build_object('member', null); end if;
  hh := m.household_id;
  return json_build_object(
    'member', json_build_object('household_id', m.household_id, 'email', m.email, 'display_name', m.display_name, 'role', m.role, 'user_id', m.user_id),
    'stores', coalesce((select json_agg(s order by s.sort_order, s.name) from (select id, slug, name, kind, sort_order, app_hint from list_hub.stores where household_id = hh and active) s), '[]'),
    'lists', coalesce((select json_agg(l) from (select id, slug, name, kind, status from list_hub.lists where household_id = hh and status <> 'archived') l), '[]'),
    'items', coalesce((select json_agg(i order by i.created_at) from (
        select it.id, it.list_id, it.name, it.qty, it.notes, it.preferred_store_id, it.status, it.discreet, it.created_by, it.created_at,
               it.category, it.category_source, it.barcode, it.subsection
        from list_hub.items it join list_hub.lists l on l.id = it.list_id
        where l.household_id = hh and l.status <> 'archived' and it.status in ('needed','have','checked')) i), '[]'),
    'history', coalesce((select json_agg(h) from (
        select min(it.name) as name, lower(trim(it.name)) as name_key, max(it.qty) as qty, (array_agg(it.preferred_store_id order by it.created_at desc) filter (where it.preferred_store_id is not null))[1] as preferred_store_id,
               (array_agg(it.category order by it.created_at desc) filter (where it.category is not null))[1] as category,
               (array_agg(it.subsection order by it.created_at desc) filter (where it.subsection is not null))[1] as subsection,
               count(*) as count, max(it.created_at) as last_at
        from list_hub.items it join list_hub.lists l on l.id = it.list_id
        where l.household_id = hh group by lower(trim(it.name)) order by count(*) desc, max(it.created_at) desc limit 400) h), '[]'),
    'prefs', coalesce((select json_agg(p) from (select name_key, preferred_store_id, use_count, last_used_at from list_hub.item_prefs where household_id = hh) p), '[]'),
    'cats', coalesce((select json_object_agg(name_key, category) from list_hub.category_cache where household_id = hh), '{}'),
    'subcats', coalesce((select json_object_agg(name_key, subsection) from list_hub.category_cache where household_id = hh and subsection is not null and subsection <> ''), '{}'),
    'trips', coalesce((select json_agg(t order by t.created_at desc) from (
        select tr.id, tr.store_id, tr.store_name, tr.status, tr.created_by, tr.created_at, tr.export_target, tr.export_status,
               coalesce((select json_agg(ti order by ti.sort_order, ti.created_at) from (select id, item_id, name, qty, category, subsection, checked, sort_order, created_at from list_hub.trip_items where trip_id = tr.id) ti), '[]') as items
        from list_hub.trips tr where tr.household_id = hh and tr.status = 'active') t), '[]')
  );
end
$function$;

GRANT EXECUTE ON FUNCTION public.lh_bootstrap() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION list_hub.guess_aisle(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION list_hub.guess_legacy(text, text) TO authenticated, service_role;
