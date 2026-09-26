-- List Hub: purchase history + "probably still have it" awareness.
--
-- Additive only (new tables / functions / trigger / views). Scope: list_hub plus
-- new public lh_* wrappers. Does not touch Auth, Site URL, or non-List-Hub tables.
--
--   list_hub.purchases             one row per purchase event (checkoff now; store order imports later)
--   list_hub.repurchase_overrides  per-item learned multiplier (user says "I actually need it")
--   list_hub.purchase_name_key(text)                 normalizer shared by trigger / importers
--   list_hub.repurchase_default_days(name_key, sub)  category fallback interval (days)
--   list_hub.repurchase_stats(household)             per-item last purchase, median gap, interval, probably_have
--   public.lh_repurchase()                           same, for the signed-in member's household (app)
--   public.lh_repurchase_signal(name, kind)          learning signal: shortens that item's interval (x0.7)
--   public.lh_purchases                              security_invoker view for members / service_role importers
--
-- Importing store order history later: insert into list_hub.purchases with
--   source = 'publix' | 'sams' | 'walmart' | 'amazon' (any lowercase slug), purchased_at = order date,
--   name = product/item name (name_key is filled automatically), store_name, qty,
--   external_ref = '<order id>:<line id>' (unique per household+source, so re-imports are idempotent).

CREATE TABLE IF NOT EXISTS list_hub.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES list_hub.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_key text NOT NULL,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'checkoff',
  store_id uuid REFERENCES list_hub.stores(id) ON DELETE SET NULL,
  store_name text,
  qty text,
  category text,
  subsection text,
  item_id uuid REFERENCES list_hub.items(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES list_hub.trips(id) ON DELETE SET NULL,
  external_ref text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchases_name_check CHECK (char_length(trim(name)) >= 1),
  CONSTRAINT purchases_source_check CHECK (source ~ '^[a-z0-9_-]{2,32}$')
);
CREATE INDEX IF NOT EXISTS purchases_hh_key_idx ON list_hub.purchases (household_id, name_key, purchased_at DESC);
CREATE INDEX IF NOT EXISTS purchases_item_idx ON list_hub.purchases (item_id, purchased_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS purchases_external_ref_uq
  ON list_hub.purchases (household_id, source, external_ref) WHERE external_ref IS NOT NULL;
COMMENT ON TABLE list_hub.purchases IS
  'Purchase events. source=checkoff (List check-off / trip), backfill, or a store slug (publix, sams, walmart, amazon) for imported order history. external_ref de-duplicates imports.';

CREATE TABLE IF NOT EXISTS list_hub.repurchase_overrides (
  household_id uuid NOT NULL REFERENCES list_hub.households(id) ON DELETE CASCADE,
  name_key text NOT NULL,
  factor numeric(6,3) NOT NULL DEFAULT 1,
  signals integer NOT NULL DEFAULT 0,
  last_signal text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, name_key),
  CONSTRAINT repurchase_overrides_factor_check CHECK (factor > 0 AND factor <= 3)
);
COMMENT ON TABLE list_hub.repurchase_overrides IS
  'Learned per-item multiplier on the repurchase interval. Each "I still needed it" signal multiplies by 0.7 (floor 0.1).';

CREATE OR REPLACE FUNCTION list_hub.purchase_name_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT left(regexp_replace(lower(trim(coalesce(p, ''))), '\s+', ' ', 'g'), 120);
$$;

CREATE OR REPLACE FUNCTION list_hub.purchases_fill()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  NEW.name := trim(NEW.name);
  NEW.name_key := list_hub.purchase_name_key(coalesce(nullif(NEW.name_key, ''), NEW.name));
  NEW.source := lower(trim(coalesce(NEW.source, 'checkoff')));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS purchases_fill ON list_hub.purchases;
CREATE TRIGGER purchases_fill BEFORE INSERT OR UPDATE ON list_hub.purchases
  FOR EACH ROW EXECUTE FUNCTION list_hub.purchases_fill();

ALTER TABLE list_hub.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS purchases_member ON list_hub.purchases;
CREATE POLICY purchases_member ON list_hub.purchases FOR ALL TO authenticated
  USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON list_hub.purchases TO authenticated, service_role;

ALTER TABLE list_hub.repurchase_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS repurchase_overrides_member ON list_hub.repurchase_overrides;
CREATE POLICY repurchase_overrides_member ON list_hub.repurchase_overrides FOR ALL TO authenticated
  USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON list_hub.repurchase_overrides TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Record purchases when a List item is checked off / bought (works for any client).
--   needed -> checked | bought  : insert event (store from trip, else preferred store)
--   checked -> needed           : undo = delete that item's checkoff event from the last 24h
--   checked -> bought (Clear / trip finish) : no second event
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_hub.items_record_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_hh uuid;
  v_kind text;
  v_store uuid;
  v_store_name text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT l.household_id, l.kind INTO v_hh, v_kind FROM list_hub.lists l WHERE l.id = NEW.list_id;
  IF v_hh IS NULL OR v_kind = 'wish' THEN RETURN NEW; END IF;

  IF OLD.status = 'checked' AND NEW.status = 'needed' THEN
    DELETE FROM list_hub.purchases
     WHERE item_id = NEW.id AND source = 'checkoff' AND purchased_at > now() - interval '24 hours';
    RETURN NEW;
  END IF;

  IF NEW.status IN ('checked', 'bought') AND OLD.status NOT IN ('checked', 'bought') THEN
    IF EXISTS (SELECT 1 FROM list_hub.purchases p WHERE p.item_id = NEW.id AND p.purchased_at > now() - interval '24 hours') THEN
      RETURN NEW;
    END IF;
    IF NEW.trip_id IS NOT NULL THEN
      SELECT t.store_id, t.store_name INTO v_store, v_store_name FROM list_hub.trips t WHERE t.id = NEW.trip_id;
    END IF;
    IF v_store IS NULL AND NEW.preferred_store_id IS NOT NULL THEN
      SELECT s.id, s.name INTO v_store, v_store_name FROM list_hub.stores s WHERE s.id = NEW.preferred_store_id;
    END IF;
    INSERT INTO list_hub.purchases (household_id, name, purchased_at, source, store_id, store_name, qty, category, subsection, item_id, trip_id, created_by)
    VALUES (v_hh, NEW.name, coalesce(NEW.bought_at, now()), 'checkoff', v_store, v_store_name, NEW.qty, NEW.category, NEW.subsection, NEW.id, NEW.trip_id,
            coalesce(auth.jwt() ->> 'email', 'system'));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS items_record_purchase ON list_hub.items;
CREATE TRIGGER items_record_purchase AFTER UPDATE OF status ON list_hub.items
  FOR EACH ROW EXECUTE FUNCTION list_hub.items_record_purchase();

-- ---------------------------------------------------------------------------
-- Interval defaults (days). 0 = never suppress (fresh food goes fast).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_hub.repurchase_default_days(p_name_key text, p_subsection text DEFAULT NULL)
RETURNS TABLE (days integer, basis text)
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT d.days, d.basis FROM (
    SELECT CASE
      WHEN coalesce(p_subsection, '') IN ('Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery & Bread', 'Deli')
           AND k !~ '(powder|dried|ground |flakes|seasoning|extract)' THEN 0
      WHEN k ~ '(^|\s)(salt|pepper(corns)?|paprika|cumin|oregano|thyme|rosemary|cinnamon|nutmeg|cloves|cayenne|turmeric|curry|chili powder|garlic powder|onion powder|red pepper flakes|bay leaves?|italian seasoning|seasoning|spices?|allspice|cardamom|coriander|dill weed|sesame seeds|vanilla|extract|msg|bouillon)(\s|$)'
           AND k !~ '(bell pepper|jalape|poblano|serrano|fresh )' THEN 180
      WHEN k ~ '(flour|sugar|baking soda|baking powder|yeast|cornstarch|cocoa|chocolate chips|molasses|cornmeal|shortening|sprinkles|food coloring|gelatin)' THEN 120
      WHEN k ~ '(oil|vinegar|soy sauce|tamari|sauce|ketchup|mustard|mayo|mayonnaise|honey|syrup|dressing|salsa|sriracha|sambal|worcestershire|relish|jam|jelly|peanut butter|nutella|cooking spray|hoisin|miso|tahini|chili crisp|gochujang|pesto)' THEN 90
      WHEN coalesce(p_subsection, '') IN ('Pantry') OR k ~ '(canned|(^|\s)cans?(\s|$)|beans|lentils|rice|pasta|spaghetti|penne|noodles|oats|quinoa|couscous|broth|stock|tomato paste|diced tomatoes|crushed tomatoes|tomato sauce|tuna|breadcrumbs|panko|crackers)' THEN 60
      ELSE 0
    END AS days,
    CASE
      WHEN coalesce(p_subsection, '') IN ('Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery & Bread', 'Deli')
           AND k !~ '(powder|dried|ground |flakes|seasoning|extract)' THEN 'fresh'
      WHEN k ~ '(^|\s)(salt|pepper(corns)?|paprika|cumin|oregano|thyme|rosemary|cinnamon|nutmeg|cloves|cayenne|turmeric|curry|chili powder|garlic powder|onion powder|red pepper flakes|bay leaves?|italian seasoning|seasoning|spices?|allspice|cardamom|coriander|dill weed|sesame seeds|vanilla|extract|msg|bouillon)(\s|$)'
           AND k !~ '(bell pepper|jalape|poblano|serrano|fresh )' THEN 'spices'
      WHEN k ~ '(flour|sugar|baking soda|baking powder|yeast|cornstarch|cocoa|chocolate chips|molasses|cornmeal|shortening|sprinkles|food coloring|gelatin)' THEN 'baking'
      WHEN k ~ '(oil|vinegar|soy sauce|tamari|sauce|ketchup|mustard|mayo|mayonnaise|honey|syrup|dressing|salsa|sriracha|sambal|worcestershire|relish|jam|jelly|peanut butter|nutella|cooking spray|hoisin|miso|tahini|chili crisp|gochujang|pesto)' THEN 'condiments'
      WHEN coalesce(p_subsection, '') IN ('Pantry') OR k ~ '(canned|(^|\s)cans?(\s|$)|beans|lentils|rice|pasta|spaghetti|penne|noodles|oats|quinoa|couscous|broth|stock|tomato paste|diced tomatoes|crushed tomatoes|tomato sauce|tuna|breadcrumbs|panko|crackers)' THEN 'dry-goods'
      ELSE 'default'
    END AS basis
    FROM (SELECT list_hub.purchase_name_key(p_name_key) AS k) x
  ) d;
$$;

-- ---------------------------------------------------------------------------
-- Per-item stats. interval_days = median gap (2+ purchases) else category default,
-- times the learned factor. probably_have only when confident.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_hub.repurchase_stats(p_household uuid)
RETURNS TABLE (
  name_key text, name text, purchase_count integer, last_purchased_at timestamptz, last_store text, last_source text,
  median_gap_days numeric, default_days integer, default_basis text, factor numeric,
  interval_days numeric, confident boolean, probably_have boolean, days_since numeric
)
LANGUAGE sql STABLE SET search_path TO '' AS $$
  WITH p AS (
    SELECT pu.*, lag(pu.purchased_at) OVER (PARTITION BY pu.name_key ORDER BY pu.purchased_at) AS prev_at
    FROM list_hub.purchases pu WHERE pu.household_id = p_household
  ), agg AS (
    SELECT p.name_key,
           (array_agg(p.name ORDER BY p.purchased_at DESC))[1] AS name,
           count(*)::int AS n,
           max(p.purchased_at) AS last_at,
           (array_agg(p.store_name ORDER BY p.purchased_at DESC))[1] AS last_store,
           (array_agg(p.source ORDER BY p.purchased_at DESC))[1] AS last_source,
           (array_agg(p.subsection ORDER BY p.purchased_at DESC) FILTER (WHERE p.subsection IS NOT NULL AND p.subsection <> ''))[1] AS sub,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (p.purchased_at - p.prev_at)) / 86400.0)
             FILTER (WHERE p.prev_at IS NOT NULL AND p.purchased_at - p.prev_at > interval '12 hours') AS med
    FROM p GROUP BY p.name_key
  ), s AS (
    SELECT a.*, coalesce(a.sub, cc.subsection) AS sub2, coalesce(o.factor, 1) AS f
    FROM agg a
    LEFT JOIN list_hub.category_cache cc ON cc.household_id = p_household AND cc.name_key = a.name_key
    LEFT JOIN list_hub.repurchase_overrides o ON o.household_id = p_household AND o.name_key = a.name_key
  )
  SELECT s.name_key, s.name, s.n, s.last_at, s.last_store, s.last_source,
         round(s.med::numeric, 1), d.days, d.basis, s.f,
         round((CASE WHEN s.med IS NOT NULL THEN s.med::numeric ELSE d.days END) * s.f, 1) AS interval_days,
         (s.med IS NOT NULL OR d.days >= 90) AS confident,
         ((s.med IS NOT NULL OR d.days >= 90)
           AND (CASE WHEN s.med IS NOT NULL THEN s.med::numeric ELSE d.days END) * s.f >= 1
           AND now() - s.last_at < make_interval(secs => 0.7 * (CASE WHEN s.med IS NOT NULL THEN s.med::numeric ELSE d.days END) * s.f * 86400)) AS probably_have,
         round((extract(epoch FROM (now() - s.last_at)) / 86400.0)::numeric, 1)
  FROM s CROSS JOIN LATERAL list_hub.repurchase_default_days(s.name_key, s.sub2) d;
$$;
GRANT EXECUTE ON FUNCTION list_hub.repurchase_stats(uuid) TO authenticated, service_role;

-- App wrappers (public schema, like lh_bootstrap)
CREATE OR REPLACE FUNCTION public.lh_repurchase()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE hh uuid;
BEGIN
  SELECT m.household_id INTO hh FROM list_hub.members m
   WHERE m.user_id = auth.uid() OR lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')) LIMIT 1;
  IF hh IS NULL THEN RETURN '[]'::json; END IF;
  RETURN coalesce((SELECT json_agg(r) FROM list_hub.repurchase_stats(hh) r), '[]'::json);
END $$;
GRANT EXECUTE ON FUNCTION public.lh_repurchase() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lh_repurchase_signal(p_name text, p_kind text DEFAULT 'add')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE hh uuid; k text := list_hub.purchase_name_key(p_name); r list_hub.repurchase_overrides;
BEGIN
  SELECT m.household_id INTO hh FROM list_hub.members m
   WHERE m.user_id = auth.uid() OR lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')) LIMIT 1;
  IF hh IS NULL THEN RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501'; END IF;
  IF k = '' THEN RETURN json_build_object('ok', false); END IF;
  INSERT INTO list_hub.repurchase_overrides AS o (household_id, name_key, factor, signals, last_signal, updated_at)
  VALUES (hh, k, 0.7, 1, left(coalesce(p_kind, 'add'), 32), now())
  ON CONFLICT (household_id, name_key) DO UPDATE
    SET factor = greatest(0.1, round(o.factor * 0.7, 3)), signals = o.signals + 1, last_signal = excluded.last_signal, updated_at = now()
  RETURNING * INTO r;
  RETURN json_build_object('ok', true, 'name_key', r.name_key, 'factor', r.factor, 'signals', r.signals);
END $$;
GRANT EXECUTE ON FUNCTION public.lh_repurchase_signal(text, text) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.lh_purchases WITH (security_invoker = true) AS
  SELECT id, household_id, name, name_key, purchased_at, source, store_id, store_name, qty, category, subsection, item_id, trip_id, external_ref, created_by, created_at
  FROM list_hub.purchases;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lh_purchases TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Backfill from existing checked-off / bought List items (idempotent).
-- ---------------------------------------------------------------------------
INSERT INTO list_hub.purchases (household_id, name, purchased_at, source, store_id, store_name, qty, category, subsection, item_id, trip_id, external_ref, created_by)
SELECT l.household_id, i.name, coalesce(i.bought_at, i.updated_at, i.created_at), 'backfill',
       coalesce(t.store_id, i.preferred_store_id), coalesce(t.store_name, s.name), i.qty, i.category, i.subsection, i.id, i.trip_id,
       'item:' || i.id::text, 'backfill'
FROM list_hub.items i
JOIN list_hub.lists l ON l.id = i.list_id AND l.kind <> 'wish'
LEFT JOIN list_hub.trips t ON t.id = i.trip_id
LEFT JOIN list_hub.stores s ON s.id = i.preferred_store_id
WHERE i.status IN ('checked', 'bought') OR i.bought_at IS NOT NULL
ON CONFLICT DO NOTHING;
