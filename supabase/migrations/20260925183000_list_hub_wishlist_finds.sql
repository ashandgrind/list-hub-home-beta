-- List Hub: wishlist details, adder attribution, and Finds log.
--
-- Scope: list_hub tables/functions/triggers/RLS only, plus the existing
-- public lh_* API views that already wrap list_hub (same pattern as
-- lh_items / lh_trips). Does not touch tattoo-shop tables, Auth, or Site URL.
--
-- APPLY THIS BEFORE deploying the matching app. If this file is in the PR
-- but has not been applied to project dphkvcdohqsvefbdhsfx, the wishlist
-- detail UI will hide extra fields / Finds until it is.

-- ---------------------------------------------------------------------------
-- items: wishlist fields + real adder (existing created_by defaulted to 'chris')
-- ---------------------------------------------------------------------------
ALTER TABLE list_hub.items
  ALTER COLUMN created_by SET DEFAULT 'unknown';

ALTER TABLE list_hub.items
  ADD COLUMN IF NOT EXISTS target_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS preferred_source text,
  ADD COLUMN IF NOT EXISTS product_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS added_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS added_by_kind text NOT NULL DEFAULT 'unknown';

ALTER TABLE list_hub.items
  DROP CONSTRAINT IF EXISTS items_added_by_kind_check;
ALTER TABLE list_hub.items
  ADD CONSTRAINT items_added_by_kind_check
  CHECK (added_by_kind = ANY (ARRAY['member'::text, 'assistant'::text, 'unknown'::text]));

ALTER TABLE list_hub.items
  DROP CONSTRAINT IF EXISTS items_target_price_check;
ALTER TABLE list_hub.items
  ADD CONSTRAINT items_target_price_check
  CHECK (target_price IS NULL OR target_price >= 0);

ALTER TABLE list_hub.items
  DROP CONSTRAINT IF EXISTS items_product_links_check;
ALTER TABLE list_hub.items
  ADD CONSTRAINT items_product_links_check
  CHECK (jsonb_typeof(product_links) = 'array');

COMMENT ON COLUMN list_hub.items.target_price IS 'Wishlist target price in USD.';
COMMENT ON COLUMN list_hub.items.preferred_source IS 'Free-text preferred seller/source (Amazon, eBay, FB Marketplace, …) in addition to preferred_store_id.';
COMMENT ON COLUMN list_hub.items.product_links IS 'JSON array of {url, label?} or plain URL strings.';
COMMENT ON COLUMN list_hub.items.added_by_kind IS 'member | assistant (Shopping Buddy) | unknown (pre-attribution rows).';

-- Existing rows were inserted with the old created_by default ('chris'), which
-- is not a reliable attribution. Keep the text but mark them unknown.
UPDATE list_hub.items
SET added_by_kind = 'unknown'
WHERE added_by_user_id IS NULL
  AND added_by_kind IS DISTINCT FROM 'assistant'
  AND added_by_kind IS DISTINCT FROM 'member';

CREATE OR REPLACE FUNCTION list_hub.actor_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT coalesce(auth.role(), '') = 'service_role'
      OR coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$function$;

CREATE OR REPLACE FUNCTION list_hub.current_member_for_item(p_list_id uuid)
RETURNS list_hub.members
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT m.*
  FROM list_hub.members m
  JOIN list_hub.lists l ON l.id = p_list_id AND l.household_id = m.household_id
  WHERE m.user_id = auth.uid()
     OR lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION list_hub.set_item_adder()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_explicit text := lower(trim(coalesce(NEW.created_by, '')));
  v_member list_hub.members;
BEGIN
  IF list_hub.actor_is_service_role()
     OR NEW.added_by_kind = 'assistant'
     OR v_explicit IN ('shopping buddy', 'shopping_buddy', 'assistant') THEN
    NEW.created_by := 'Shopping Buddy';
    NEW.added_by_kind := 'assistant';
    NEW.added_by_user_id := NULL;
    RETURN NEW;
  END IF;

  SELECT * INTO v_member FROM list_hub.current_member_for_item(NEW.list_id);
  IF v_member.email IS NOT NULL THEN
    NEW.created_by := v_member.display_name;
    NEW.added_by_kind := 'member';
    NEW.added_by_user_id := coalesce(v_member.user_id, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.created_by IS NULL OR trim(NEW.created_by) = '' OR v_explicit IN ('chris', 'unknown') THEN
    NEW.created_by := 'unknown';
  END IF;
  NEW.added_by_kind := 'unknown';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS items_set_adder ON list_hub.items;
CREATE TRIGGER items_set_adder
  BEFORE INSERT ON list_hub.items
  FOR EACH ROW
  EXECUTE FUNCTION list_hub.set_item_adder();

-- ---------------------------------------------------------------------------
-- finds
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS list_hub.finds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES list_hub.items(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES list_hub.households(id) ON DELETE CASCADE,
  title text NOT NULL,
  price numeric(12,2),
  source text,
  url text,
  condition text,
  notes text,
  found_at timestamptz NOT NULL DEFAULT now(),
  found_by text NOT NULL DEFAULT 'unknown',
  found_by_kind text NOT NULL DEFAULT 'unknown',
  found_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finds_title_check CHECK (char_length(trim(title)) >= 1),
  CONSTRAINT finds_price_check CHECK (price IS NULL OR price >= 0),
  CONSTRAINT finds_condition_check CHECK (
    condition IS NULL OR condition = ANY (ARRAY['new'::text, 'used'::text, 'refurb'::text])
  ),
  CONSTRAINT finds_found_by_kind_check CHECK (
    found_by_kind = ANY (ARRAY['member'::text, 'assistant'::text, 'unknown'::text])
  )
);

CREATE INDEX IF NOT EXISTS finds_item_idx ON list_hub.finds (item_id, found_at DESC);
CREATE INDEX IF NOT EXISTS finds_household_idx ON list_hub.finds (household_id, found_at DESC);

COMMENT ON TABLE list_hub.finds IS 'Logged deals/listings for a wishlist (or list) item. Shopping Buddy uses list_hub.log_find.';

CREATE OR REPLACE FUNCTION list_hub.set_find_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_hh uuid;
  v_member list_hub.members;
  v_explicit text := lower(trim(coalesce(NEW.found_by, '')));
BEGIN
  SELECT l.household_id INTO v_hh
  FROM list_hub.items i
  JOIN list_hub.lists l ON l.id = i.list_id
  WHERE i.id = NEW.item_id;

  IF v_hh IS NULL THEN
    RAISE EXCEPTION 'item_not_found' USING ERRCODE = '23503';
  END IF;
  NEW.household_id := v_hh;

  IF list_hub.actor_is_service_role()
     OR NEW.found_by_kind = 'assistant'
     OR v_explicit IN ('shopping buddy', 'shopping_buddy', 'assistant') THEN
    NEW.found_by := 'Shopping Buddy';
    NEW.found_by_kind := 'assistant';
    NEW.found_by_user_id := NULL;
    RETURN NEW;
  END IF;

  SELECT m.* INTO v_member
  FROM list_hub.members m
  WHERE m.household_id = NEW.household_id
    AND (m.user_id = auth.uid() OR lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  LIMIT 1;

  IF v_member.email IS NOT NULL THEN
    NEW.found_by := v_member.display_name;
    NEW.found_by_kind := 'member';
    NEW.found_by_user_id := coalesce(v_member.user_id, auth.uid());
    RETURN NEW;
  END IF;

  NEW.found_by := coalesce(nullif(trim(coalesce(NEW.found_by, '')), ''), 'unknown');
  NEW.found_by_kind := 'unknown';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS finds_set_defaults ON list_hub.finds;
CREATE TRIGGER finds_set_defaults
  BEFORE INSERT ON list_hub.finds
  FOR EACH ROW
  EXECUTE FUNCTION list_hub.set_find_defaults();

ALTER TABLE list_hub.finds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finds_member ON list_hub.finds;
CREATE POLICY finds_member ON list_hub.finds
  FOR ALL TO authenticated
  USING (list_hub.is_member(household_id))
  WITH CHECK (list_hub.is_member(household_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON list_hub.finds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON list_hub.finds TO service_role;

-- ---------------------------------------------------------------------------
-- RPC: list_hub.log_find — service_role (Shopping Buddy) or household member
-- SECURITY INVOKER so it is safe even if list_hub is exposed. service_role
-- bypasses RLS; members are constrained by finds_member.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_hub.log_find(
  p_item_id uuid,
  p_title text,
  p_price numeric DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_url text DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_found_at timestamptz DEFAULT now(),
  p_found_by text DEFAULT NULL
)
RETURNS list_hub.finds
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_row list_hub.finds;
  v_hh uuid;
BEGIN
  IF p_item_id IS NULL OR char_length(trim(coalesce(p_title, ''))) < 1 THEN
    RAISE EXCEPTION 'title_and_item_required' USING ERRCODE = '23502';
  END IF;

  SELECT l.household_id INTO v_hh
  FROM list_hub.items i
  JOIN list_hub.lists l ON l.id = i.list_id
  WHERE i.id = p_item_id;

  IF v_hh IS NULL THEN
    RAISE EXCEPTION 'item_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT list_hub.actor_is_service_role()
     AND NOT list_hub.is_member(v_hh)
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO list_hub.finds (
    item_id, title, price, source, url, condition, notes, found_at, found_by, found_by_kind
  ) VALUES (
    p_item_id,
    trim(p_title),
    p_price,
    nullif(trim(p_source), ''),
    nullif(trim(p_url), ''),
    nullif(trim(p_condition), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_found_at, now()),
    CASE
      WHEN list_hub.actor_is_service_role() THEN coalesce(nullif(trim(p_found_by), ''), 'Shopping Buddy')
      ELSE p_found_by
    END,
    CASE WHEN list_hub.actor_is_service_role() THEN 'assistant' ELSE NULL END
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

COMMENT ON FUNCTION list_hub.log_find(uuid, text, numeric, text, text, text, text, timestamptz, text) IS
  'Log a Find on an item. service_role is attributed as Shopping Buddy. Household members should call this while signed in.';

GRANT EXECUTE ON FUNCTION list_hub.log_find(uuid, text, numeric, text, text, text, text, timestamptz, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- list_hub-native views (requested API surface lives in this schema)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW list_hub.lh_items
WITH (security_invoker = true) AS
SELECT
  id, list_id, name, qty, notes, preferred_store_id, status, discreet, sort_order,
  created_by, created_at, updated_at, category, category_source, barcode,
  bought_at, trip_id, target_price, preferred_source, product_links,
  added_by_user_id, added_by_kind
FROM list_hub.items;

CREATE OR REPLACE VIEW list_hub.lh_finds
WITH (security_invoker = true) AS
SELECT
  id, item_id, household_id, title, price, source, url, condition, notes,
  found_at, found_by, found_by_kind, found_by_user_id, created_at
FROM list_hub.finds;

GRANT SELECT ON list_hub.lh_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON list_hub.lh_finds TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Existing public lh_* API views (same wrappers the live app already uses).
-- Recreate lh_items so new columns are visible; add lh_finds. No other
-- public objects (tattoo shop / auth) are touched.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.lh_items
WITH (security_invoker = true) AS
SELECT
  id, list_id, name, qty, notes, preferred_store_id, status, discreet, sort_order,
  created_by, created_at, updated_at, category, category_source, barcode,
  bought_at, trip_id, target_price, preferred_source, product_links,
  added_by_user_id, added_by_kind
FROM list_hub.items;

CREATE OR REPLACE VIEW public.lh_finds
WITH (security_invoker = true, check_option = local) AS
SELECT
  id, item_id, household_id, title, price, source, url, condition, notes,
  found_at, found_by, found_by_kind, found_by_user_id, created_at
FROM list_hub.finds
WHERE list_hub.is_member(household_id)
   OR list_hub.actor_is_service_role();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lh_items TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lh_finds TO authenticated, service_role;
