-- Schema-only snapshot of list_hub (tables, constraints, functions, public lh_* views, triggers, RLS)
-- read from project dphkvcdohqsvefbdhsfx on 2026-10-16 (main b803394 live). No data. Test harness use only.

-- ===== tables
CREATE TABLE list_hub.agent_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  name text NOT NULL,
  token_hash text NOT NULL,
  created_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone
);

CREATE TABLE list_hub.category_cache (
  household_id uuid NOT NULL,
  name_key text NOT NULL,
  category text NOT NULL,
  source text NOT NULL DEFAULT 'ai'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  subsection text
);

CREATE TABLE list_hub.find_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  item_id uuid NOT NULL,
  requested_by text NOT NULL DEFAULT 'unknown'::text,
  requested_by_user_id uuid,
  frequency text NOT NULL,
  max_price numeric(12,2),
  condition_pref text,
  notes text,
  status text NOT NULL DEFAULT 'pending'::text,
  last_run_at timestamp with time zone,
  next_run_at timestamp with time zone,
  last_summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE list_hub.finds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  household_id uuid NOT NULL,
  title text NOT NULL,
  price numeric(12,2),
  source text,
  url text,
  condition text,
  notes text,
  found_at timestamp with time zone NOT NULL DEFAULT now(),
  found_by text NOT NULL DEFAULT 'unknown'::text,
  found_by_kind text NOT NULL DEFAULT 'unknown'::text,
  found_by_user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE list_hub.households (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  access_code text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE list_hub.item_prefs (
  household_id uuid NOT NULL,
  name_key text NOT NULL,
  preferred_store_id uuid,
  use_count integer NOT NULL DEFAULT 1,
  last_used_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE list_hub.items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL,
  name text NOT NULL,
  qty text,
  notes text,
  preferred_store_id uuid,
  status text NOT NULL DEFAULT 'needed'::text,
  discreet boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by text NOT NULL DEFAULT 'unknown'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  category text,
  category_source text,
  barcode text,
  bought_at timestamp with time zone,
  trip_id uuid,
  target_price numeric(12,2),
  preferred_source text,
  product_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  added_by_user_id uuid,
  added_by_kind text NOT NULL DEFAULT 'unknown'::text,
  subsection text,
  agent_state text,
  agent_note text
);

CREATE TABLE list_hub.lists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text,
  notes text,
  finalized_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE list_hub.members (
  household_id uuid NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'member'::text,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE list_hub.purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  name text NOT NULL,
  name_key text NOT NULL,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'checkoff'::text,
  store_id uuid,
  store_name text,
  qty text,
  category text,
  subsection text,
  item_id uuid,
  trip_id uuid,
  external_ref text,
  created_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE list_hub.repurchase_overrides (
  household_id uuid NOT NULL,
  name_key text NOT NULL,
  factor numeric(6,3) NOT NULL DEFAULT 1,
  signals integer NOT NULL DEFAULT 0,
  last_signal text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE list_hub.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  household_id uuid NOT NULL,
  app_hint text
);

CREATE TABLE list_hub.trip_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL,
  household_id uuid NOT NULL,
  item_id uuid,
  name text NOT NULL,
  qty text,
  category text,
  checked boolean NOT NULL DEFAULT false,
  checked_at timestamp with time zone,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  subsection text
);

CREATE TABLE list_hub.trips (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  store_id uuid,
  store_name text NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  created_by text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  export_target text,
  export_status text NOT NULL DEFAULT 'none'::text,
  export_payload jsonb,
  notes text
);

-- ===== cons
ALTER TABLE list_hub.agent_tokens ADD CONSTRAINT agent_tokens_pkey PRIMARY KEY (id);
ALTER TABLE list_hub.category_cache ADD CONSTRAINT category_cache_pkey PRIMARY KEY (household_id, name_key);
ALTER TABLE list_hub.find_requests ADD CONSTRAINT find_requests_pkey PRIMARY KEY (id);
ALTER TABLE list_hub.finds ADD CONSTRAINT finds_pkey PRIMARY KEY (id);
ALTER TABLE list_hub.households ADD CONSTRAINT households_pkey PRIMARY KEY (id);
ALTER TABLE list_hub.item_prefs ADD CONSTRAINT item_prefs_pkey PRIMARY KEY (household_id, name_key);
ALTER TABLE list_hub.items ADD CONSTRAINT items_pkey PRIMARY KEY (id);
ALTER TABLE list_hub.lists ADD CONSTRAINT lists_pkey PRIMARY KEY (id);
ALTER TABLE list_hub.members ADD CONSTRAINT members_pkey PRIMARY KEY (household_id, email);
ALTER TABLE list_hub.purchases ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);
ALTER TABLE list_hub.repurchase_overrides ADD CONSTRAINT repurchase_overrides_pkey PRIMARY KEY (household_id, name_key);
ALTER TABLE list_hub.stores ADD CONSTRAINT stores_pkey PRIMARY KEY (id);
ALTER TABLE list_hub.trip_items ADD CONSTRAINT trip_items_pkey PRIMARY KEY (id);
ALTER TABLE list_hub.trips ADD CONSTRAINT trips_pkey PRIMARY KEY (id);
ALTER TABLE list_hub.lists ADD CONSTRAINT lists_household_id_slug_key UNIQUE (household_id, slug);
ALTER TABLE list_hub.agent_tokens ADD CONSTRAINT agent_tokens_name_check CHECK (((char_length(TRIM(BOTH FROM name)) >= 1) AND (char_length(name) <= 80)));
ALTER TABLE list_hub.agent_tokens ADD CONSTRAINT agent_tokens_hash_check CHECK ((char_length(token_hash) = 64));
ALTER TABLE list_hub.category_cache ADD CONSTRAINT category_cache_category_check CHECK ((category = ANY (ARRAY['Food'::text, 'Household'::text, 'Personal care'::text, 'Personal Care'::text, 'Health'::text, 'Electronics'::text, 'Pets'::text, 'Baby'::text, 'Hardware'::text, 'Clothing'::text, 'Other'::text, 'Outdoor & Sports'::text, 'Auto'::text])));
ALTER TABLE list_hub.category_cache ADD CONSTRAINT category_cache_source_check CHECK ((source = ANY (ARRAY['ai'::text, 'local'::text, 'user'::text, 'barcode'::text])));
ALTER TABLE list_hub.find_requests ADD CONSTRAINT find_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'done'::text, 'cancelled'::text])));
ALTER TABLE list_hub.find_requests ADD CONSTRAINT find_requests_max_price_check CHECK (((max_price IS NULL) OR (max_price >= (0)::numeric)));
ALTER TABLE list_hub.find_requests ADD CONSTRAINT find_requests_frequency_check CHECK ((frequency = ANY (ARRAY['once'::text, 'daily'::text, 'weekly'::text])));
ALTER TABLE list_hub.find_requests ADD CONSTRAINT find_requests_condition_pref_check CHECK (((condition_pref IS NULL) OR (condition_pref = ANY (ARRAY['new'::text, 'used'::text, 'any'::text]))));
ALTER TABLE list_hub.finds ADD CONSTRAINT finds_found_by_kind_check CHECK ((found_by_kind = ANY (ARRAY['member'::text, 'assistant'::text, 'unknown'::text])));
ALTER TABLE list_hub.finds ADD CONSTRAINT finds_title_check CHECK ((char_length(TRIM(BOTH FROM title)) >= 1));
ALTER TABLE list_hub.finds ADD CONSTRAINT finds_price_check CHECK (((price IS NULL) OR (price >= (0)::numeric)));
ALTER TABLE list_hub.finds ADD CONSTRAINT finds_condition_check CHECK (((condition IS NULL) OR (condition = ANY (ARRAY['new'::text, 'used'::text, 'refurb'::text]))));
ALTER TABLE list_hub.items ADD CONSTRAINT items_product_links_check CHECK ((jsonb_typeof(product_links) = 'array'::text));
ALTER TABLE list_hub.items ADD CONSTRAINT items_added_by_kind_check CHECK ((added_by_kind = ANY (ARRAY['member'::text, 'assistant'::text, 'unknown'::text])));
ALTER TABLE list_hub.items ADD CONSTRAINT items_agent_state_check CHECK (((agent_state IS NULL) OR (agent_state = ANY (ARRAY['in_cart'::text, 'unavailable'::text]))));
ALTER TABLE list_hub.items ADD CONSTRAINT items_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['Food'::text, 'Household'::text, 'Personal care'::text, 'Personal Care'::text, 'Health'::text, 'Electronics'::text, 'Pets'::text, 'Baby'::text, 'Hardware'::text, 'Clothing'::text, 'Other'::text, 'Outdoor & Sports'::text, 'Auto'::text]))));
ALTER TABLE list_hub.items ADD CONSTRAINT items_category_source_check CHECK (((category_source IS NULL) OR (category_source = ANY (ARRAY['ai'::text, 'local'::text, 'user'::text, 'barcode'::text, 'cache'::text]))));
ALTER TABLE list_hub.items ADD CONSTRAINT items_status_check CHECK ((status = ANY (ARRAY['needed'::text, 'have'::text, 'checked'::text, 'dropped'::text, 'bought'::text])));
ALTER TABLE list_hub.items ADD CONSTRAINT items_target_price_check CHECK (((target_price IS NULL) OR (target_price >= (0)::numeric)));
ALTER TABLE list_hub.lists ADD CONSTRAINT lists_kind_check CHECK ((kind = ANY (ARRAY['needs'::text, 'grocery'::text, 'wish'::text, 'watch'::text, 'other'::text])));
ALTER TABLE list_hub.lists ADD CONSTRAINT lists_status_check CHECK ((status = ANY (ARRAY['open'::text, 'finalized'::text, 'archived'::text])));
ALTER TABLE list_hub.members ADD CONSTRAINT members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])));
ALTER TABLE list_hub.purchases ADD CONSTRAINT purchases_source_check CHECK ((source ~ '^[a-z0-9_-]{2,32}$'::text));
ALTER TABLE list_hub.purchases ADD CONSTRAINT purchases_name_check CHECK ((char_length(TRIM(BOTH FROM name)) >= 1));
ALTER TABLE list_hub.repurchase_overrides ADD CONSTRAINT repurchase_overrides_factor_check CHECK (((factor > (0)::numeric) AND (factor <= (3)::numeric)));
ALTER TABLE list_hub.stores ADD CONSTRAINT stores_kind_check CHECK ((kind = ANY (ARRAY['grocery'::text, 'club'::text, 'general'::text, 'online'::text, 'other'::text])));
ALTER TABLE list_hub.trips ADD CONSTRAINT trips_export_status_check CHECK ((export_status = ANY (ARRAY['none'::text, 'pending'::text, 'sent'::text, 'failed'::text])));
ALTER TABLE list_hub.trips ADD CONSTRAINT trips_status_check CHECK ((status = ANY (ARRAY['active'::text, 'done'::text, 'cancelled'::text])));
ALTER TABLE list_hub.agent_tokens ADD CONSTRAINT agent_tokens_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.category_cache ADD CONSTRAINT category_cache_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.find_requests ADD CONSTRAINT find_requests_item_id_fkey FOREIGN KEY (item_id) REFERENCES list_hub.items(id) ON DELETE CASCADE;
ALTER TABLE list_hub.find_requests ADD CONSTRAINT find_requests_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.finds ADD CONSTRAINT finds_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.finds ADD CONSTRAINT finds_item_id_fkey FOREIGN KEY (item_id) REFERENCES list_hub.items(id) ON DELETE CASCADE;
ALTER TABLE list_hub.item_prefs ADD CONSTRAINT item_prefs_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.item_prefs ADD CONSTRAINT item_prefs_preferred_store_id_fkey FOREIGN KEY (preferred_store_id) REFERENCES list_hub.stores(id) ON DELETE SET NULL;
ALTER TABLE list_hub.items ADD CONSTRAINT items_list_id_fkey FOREIGN KEY (list_id) REFERENCES list_hub.lists(id) ON DELETE CASCADE;
ALTER TABLE list_hub.items ADD CONSTRAINT items_preferred_store_id_fkey FOREIGN KEY (preferred_store_id) REFERENCES list_hub.stores(id) ON DELETE SET NULL;
ALTER TABLE list_hub.lists ADD CONSTRAINT lists_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.members ADD CONSTRAINT members_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.members ADD CONSTRAINT members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE list_hub.purchases ADD CONSTRAINT purchases_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.purchases ADD CONSTRAINT purchases_item_id_fkey FOREIGN KEY (item_id) REFERENCES list_hub.items(id) ON DELETE SET NULL;
ALTER TABLE list_hub.purchases ADD CONSTRAINT purchases_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES list_hub.trips(id) ON DELETE SET NULL;
ALTER TABLE list_hub.purchases ADD CONSTRAINT purchases_store_id_fkey FOREIGN KEY (store_id) REFERENCES list_hub.stores(id) ON DELETE SET NULL;
ALTER TABLE list_hub.repurchase_overrides ADD CONSTRAINT repurchase_overrides_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.stores ADD CONSTRAINT stores_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.trip_items ADD CONSTRAINT trip_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES list_hub.items(id) ON DELETE SET NULL;
ALTER TABLE list_hub.trip_items ADD CONSTRAINT trip_items_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.trip_items ADD CONSTRAINT trip_items_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES list_hub.trips(id) ON DELETE CASCADE;
ALTER TABLE list_hub.trips ADD CONSTRAINT trips_household_id_fkey FOREIGN KEY (household_id) REFERENCES list_hub.households(id) ON DELETE CASCADE;
ALTER TABLE list_hub.trips ADD CONSTRAINT trips_store_id_fkey FOREIGN KEY (store_id) REFERENCES list_hub.stores(id) ON DELETE SET NULL;

-- ===== idx
CREATE INDEX purchases_hh_key_idx ON list_hub.purchases USING btree (household_id, name_key, purchased_at DESC);
CREATE INDEX agent_tokens_hh_idx ON list_hub.agent_tokens USING btree (household_id, created_at DESC);
CREATE INDEX find_requests_household_idx ON list_hub.find_requests USING btree (household_id, status);
CREATE UNIQUE INDEX agent_tokens_hash_uq ON list_hub.agent_tokens USING btree (token_hash);
CREATE INDEX find_requests_item_idx ON list_hub.find_requests USING btree (item_id, created_at DESC);
CREATE UNIQUE INDEX stores_household_slug_uidx ON list_hub.stores USING btree (household_id, slug);
CREATE INDEX trip_items_trip_idx ON list_hub.trip_items USING btree (trip_id);
CREATE INDEX trips_household_idx ON list_hub.trips USING btree (household_id, status);
CREATE INDEX lists_household_id_idx ON list_hub.lists USING btree (household_id);
CREATE INDEX finds_item_idx ON list_hub.finds USING btree (item_id, found_at DESC);
CREATE INDEX items_list_id_idx ON list_hub.items USING btree (list_id);
CREATE INDEX items_status_idx ON list_hub.items USING btree (status);
CREATE INDEX find_requests_due_idx ON list_hub.find_requests USING btree (status, next_run_at) WHERE (status = ANY (ARRAY['pending'::text, 'active'::text]));
CREATE INDEX finds_household_idx ON list_hub.finds USING btree (household_id, found_at DESC);
CREATE UNIQUE INDEX purchases_external_ref_uq ON list_hub.purchases USING btree (household_id, source, external_ref) WHERE (external_ref IS NOT NULL);
CREATE INDEX purchases_item_idx ON list_hub.purchases USING btree (item_id, purchased_at DESC);

-- ===== fns
CREATE OR REPLACE FUNCTION public.lh_claim_member()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update list_hub.members set user_id = auth.uid()
  where user_id is null and auth.uid() is not null and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$function$
;

CREATE OR REPLACE FUNCTION public.lh_stt_key_get()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'lh_xai_api_key' limit 1
$function$
;

CREATE OR REPLACE FUNCTION list_hub.is_member(p_household uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from list_hub.members m
    where m.household_id = p_household
      and (m.user_id = auth.uid() or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))));
$function$
;

CREATE OR REPLACE FUNCTION public.lh_stt_key_set(p_key text, p_nonce text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_id uuid;
begin
  if p_key is null or length(p_key) < 20 or length(p_key) > 400 then raise exception 'bad key'; end if;
  perform 1 from lh_private.setup_tokens where purpose = 'xai_api_key' and used_at is null and token_sha256 = encode(extensions.digest(p_nonce, 'sha256'), 'hex');
  if not found then raise exception 'invalid or used setup token'; end if;
  select id into v_id from vault.secrets where name = 'lh_xai_api_key';
  if v_id is null then perform vault.create_secret(p_key, 'lh_xai_api_key', 'List Hub xAI key for lh-transcribe');
  else perform vault.update_secret(v_id, p_key); end if;
  update lh_private.setup_tokens set used_at = now() where purpose = 'xai_api_key';
  return 'stored';
end $function$
;

CREATE OR REPLACE FUNCTION public.lh_bootstrap()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
$function$
;

CREATE OR REPLACE FUNCTION public.lh_trip_complete(p_trip uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t list_hub.trips; n_bought int; n_left int;
begin
  select * into t from list_hub.trips where id = p_trip;
  if t.id is null or not list_hub.is_member(t.household_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if t.status <> 'active' then return json_build_object('ok', false, 'reason', 'not_active'); end if;
  update list_hub.items i set status = 'bought', bought_at = now(), trip_id = t.id, updated_at = now()
    from list_hub.trip_items ti where ti.trip_id = t.id and ti.checked and ti.item_id = i.id and i.status <> 'bought';
  get diagnostics n_bought = row_count;
  select count(*) into n_left from list_hub.trip_items where trip_id = t.id and not checked;
  update list_hub.trips set status = 'done', completed_at = now() where id = t.id;
  return json_build_object('ok', true, 'bought', n_bought, 'left_on_list', n_left);
end $function$
;

CREATE OR REPLACE FUNCTION public.lh_auth_hint(p_email text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e text := lower(trim(coalesce(p_email, ''))); u auth.users;
begin
  if not exists (select 1 from list_hub.members where lower(email) = e) then return json_build_object('member', false); end if;
  select * into u from auth.users where lower(email) = e and deleted_at is null limit 1;
  return json_build_object('member', true, 'account', u.id is not null,
    'password_set', coalesce((u.raw_user_meta_data ->> 'has_password')::boolean, false));
end $function$
;

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
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION list_hub.actor_is_service_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT coalesce(auth.role(), '') = 'service_role'
      OR coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION list_hub.log_find(p_item_id uuid, p_title text, p_price numeric DEFAULT NULL::numeric, p_source text DEFAULT NULL::text, p_url text DEFAULT NULL::text, p_condition text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_found_at timestamp with time zone DEFAULT now(), p_found_by text DEFAULT NULL::text)
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
$function$
;

CREATE OR REPLACE FUNCTION list_hub.set_find_request_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_hh uuid;
  v_member list_hub.members;
BEGIN
  SELECT l.household_id INTO v_hh
  FROM list_hub.items i
  JOIN list_hub.lists l ON l.id = i.list_id
  WHERE i.id = NEW.item_id;

  IF v_hh IS NULL THEN
    RAISE EXCEPTION 'item_not_found' USING ERRCODE = '23503';
  END IF;
  NEW.household_id := v_hh;
  NEW.updated_at := now();

  IF NEW.frequency IS NULL THEN
    NEW.frequency := 'once';
  END IF;
  IF NEW.status IS NULL THEN
    NEW.status := 'pending';
  END IF;
  IF NEW.next_run_at IS NULL AND NEW.status IN ('pending', 'active') THEN
    NEW.next_run_at := now();
  END IF;

  SELECT m.* INTO v_member
  FROM list_hub.members m
  WHERE m.household_id = NEW.household_id
    AND (m.user_id = auth.uid() OR lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  LIMIT 1;

  IF v_member.email IS NOT NULL THEN
    NEW.requested_by := v_member.display_name;
    NEW.requested_by_user_id := coalesce(v_member.user_id, auth.uid());
  ELSIF list_hub.actor_is_service_role() THEN
    NEW.requested_by := coalesce(nullif(trim(NEW.requested_by), ''), 'Shopping Buddy');
  ELSE
    NEW.requested_by := coalesce(nullif(trim(NEW.requested_by), ''), 'unknown');
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION list_hub.touch_find_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION list_hub.cancel_prior_find_requests()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE list_hub.find_requests
  SET status = 'cancelled', updated_at = now()
  WHERE item_id = NEW.item_id
    AND id IS DISTINCT FROM NEW.id
    AND status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text]);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION list_hub.next_find_run_at(p_frequency text, p_from timestamp with time zone DEFAULT now())
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE p_frequency
    WHEN 'daily' THEN p_from + interval '1 day'
    WHEN 'weekly' THEN p_from + interval '7 days'
    ELSE NULL
  END;
$function$
;

CREATE OR REPLACE FUNCTION list_hub.due_find_requests()
 RETURNS TABLE(id uuid, household_id uuid, item_id uuid, item_name text, item_notes text, target_price numeric, preferred_source text, product_links jsonb, frequency text, max_price numeric, condition_pref text, notes text, status text, requested_by text, last_run_at timestamp with time zone, next_run_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT
    r.id,
    r.household_id,
    r.item_id,
    i.name AS item_name,
    i.notes AS item_notes,
    i.target_price,
    i.preferred_source,
    i.product_links,
    r.frequency,
    r.max_price,
    r.condition_pref,
    r.notes,
    r.status,
    r.requested_by,
    r.last_run_at,
    r.next_run_at,
    r.created_at
  FROM list_hub.find_requests r
  JOIN list_hub.items i ON i.id = r.item_id
  WHERE (
      r.status = 'pending'
      OR (r.status = 'active' AND r.next_run_at IS NOT NULL AND r.next_run_at <= now())
    )
    AND (
      list_hub.actor_is_service_role()
      OR list_hub.is_member(r.household_id)
      OR current_user IN ('postgres', 'supabase_admin')
    )
  ORDER BY r.next_run_at NULLS FIRST, r.created_at;
$function$
;

CREATE OR REPLACE FUNCTION list_hub.complete_find_run(p_request_id uuid, p_summary text DEFAULT NULL::text)
 RETURNS list_hub.find_requests
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_row list_hub.find_requests;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_row FROM list_hub.find_requests WHERE id = p_request_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT list_hub.actor_is_service_role()
     AND NOT list_hub.is_member(v_row.household_id)
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;

  IF v_row.status NOT IN ('pending', 'active') THEN
    RAISE EXCEPTION 'not_runnable' USING ERRCODE = 'P0001';
  END IF;

  UPDATE list_hub.find_requests
  SET
    last_run_at = v_now,
    last_summary = nullif(trim(p_summary), ''),
    status = CASE WHEN frequency = 'once' THEN 'done' ELSE 'active' END,
    next_run_at = list_hub.next_find_run_at(frequency, v_now),
    updated_at = v_now
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.lh_due_find_requests()
 RETURNS TABLE(id uuid, household_id uuid, item_id uuid, item_name text, item_notes text, target_price numeric, preferred_source text, product_links jsonb, frequency text, max_price numeric, condition_pref text, notes text, status text, requested_by text, last_run_at timestamp with time zone, next_run_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT * FROM list_hub.due_find_requests();
$function$
;

CREATE OR REPLACE FUNCTION public.lh_complete_find_run(p_request_id uuid, p_summary text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, household_id uuid, item_id uuid, requested_by text, requested_by_user_id uuid, frequency text, max_price numeric, condition_pref text, notes text, status text, last_run_at timestamp with time zone, next_run_at timestamp with time zone, last_summary text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_row list_hub.find_requests;
BEGIN
  v_row := list_hub.complete_find_run(p_request_id, p_summary);
  RETURN QUERY SELECT
    v_row.id,
    v_row.household_id,
    v_row.item_id,
    v_row.requested_by,
    v_row.requested_by_user_id,
    v_row.frequency,
    v_row.max_price,
    v_row.condition_pref,
    v_row.notes,
    v_row.status,
    v_row.last_run_at,
    v_row.next_run_at,
    v_row.last_summary,
    v_row.created_at,
    v_row.updated_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION list_hub.guess_aisle(p_name text, p_category text DEFAULT NULL::text)
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
$function$
;

CREATE OR REPLACE FUNCTION list_hub.guess_legacy(p_name text, p_category text DEFAULT NULL::text)
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
$function$
;

CREATE OR REPLACE FUNCTION list_hub.purchase_name_key(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT left(regexp_replace(lower(trim(coalesce(p, ''))), '\s+', ' ', 'g'), 120);
$function$
;

CREATE OR REPLACE FUNCTION list_hub.purchases_fill()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.name := trim(NEW.name);
  NEW.name_key := list_hub.purchase_name_key(coalesce(nullif(NEW.name_key, ''), NEW.name));
  NEW.source := lower(trim(coalesce(NEW.source, 'checkoff')));
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION list_hub.items_record_purchase()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION list_hub.repurchase_default_days(p_name_key text, p_subsection text DEFAULT NULL::text)
 RETURNS TABLE(days integer, basis text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION list_hub.repurchase_stats(p_household uuid)
 RETURNS TABLE(name_key text, name text, purchase_count integer, last_purchased_at timestamp with time zone, last_store text, last_source text, median_gap_days numeric, default_days integer, default_basis text, factor numeric, interval_days numeric, confident boolean, probably_have boolean, days_since numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.lh_repurchase()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE hh uuid;
BEGIN
  SELECT m.household_id INTO hh FROM list_hub.members m
   WHERE m.user_id = auth.uid() OR lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')) LIMIT 1;
  IF hh IS NULL THEN RETURN '[]'::json; END IF;
  RETURN coalesce((SELECT json_agg(r) FROM list_hub.repurchase_stats(hh) r), '[]'::json);
END $function$
;

CREATE OR REPLACE FUNCTION public.lh_repurchase_signal(p_name text, p_kind text DEFAULT 'add'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION list_hub.agent_token_hash(p_token text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$function$
;

CREATE OR REPLACE FUNCTION list_hub.current_member_row()
 RETURNS list_hub.members
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT m.*
  FROM list_hub.members m
  WHERE m.user_id = auth.uid()
     OR lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.lh_create_agent_token(name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member list_hub.members;
  v_name text := left(trim(coalesce(name, '')), 80);
  v_raw text;
  v_token text;
  v_hash text;
  v_row list_hub.agent_tokens;
BEGIN
  SELECT * INTO v_member FROM list_hub.current_member_row();
  IF v_member.household_id IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'name is required' USING ERRCODE = '22023';
  END IF;

  v_raw := encode(extensions.gen_random_bytes(32), 'base64');
  v_raw := replace(replace(replace(v_raw, '+', '-'), '/', '_'), '=', '');
  v_token := 'lh_' || v_raw;
  v_hash := list_hub.agent_token_hash(v_token);

  INSERT INTO list_hub.agent_tokens (household_id, name, token_hash, created_by)
  VALUES (v_member.household_id, v_name, v_hash, coalesce(v_member.display_name, v_member.email, 'member'))
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'token', v_token,
    'created_at', v_row.created_at,
    'created_by', v_row.created_by
  );
END
$function$
;

CREATE OR REPLACE FUNCTION public.lh_list_agent_tokens()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member list_hub.members;
BEGIN
  SELECT * INTO v_member FROM list_hub.current_member_row();
  IF v_member.household_id IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
    FROM (
      SELECT id, name, created_by, created_at, last_used_at, revoked_at
      FROM list_hub.agent_tokens
      WHERE household_id = v_member.household_id
        AND revoked_at IS NULL
    ) t
  ), '[]'::json);
END
$function$
;

CREATE OR REPLACE FUNCTION public.lh_revoke_agent_token(id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member list_hub.members;
  v_row list_hub.agent_tokens;
BEGIN
  SELECT * INTO v_member FROM list_hub.current_member_row();
  IF v_member.household_id IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE list_hub.agent_tokens tok
     SET revoked_at = now()
   WHERE tok.id = lh_revoke_agent_token.id
     AND tok.household_id = v_member.household_id
     AND tok.revoked_at IS NULL
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN json_build_object('ok', true, 'id', v_row.id, 'revoked_at', v_row.revoked_at);
END
$function$
;

-- ===== views
CREATE OR REPLACE VIEW public.lh_agent_tokens WITH (security_invoker = true) AS  SELECT id,
    household_id,
    name,
    token_hash,
    created_by,
    created_at,
    last_used_at,
    revoked_at
   FROM list_hub.agent_tokens;

CREATE OR REPLACE VIEW public.lh_category_cache WITH (security_invoker = true) AS  SELECT household_id,
    name_key,
    category,
    source,
    updated_at,
    subsection
   FROM list_hub.category_cache
  WHERE (list_hub.is_member(household_id) OR (COALESCE((auth.jwt() ->> 'role'::text), ''::text) = 'service_role'::text));

CREATE OR REPLACE VIEW public.lh_find_requests WITH (security_invoker = true) AS  SELECT id,
    household_id,
    item_id,
    requested_by,
    requested_by_user_id,
    frequency,
    max_price,
    condition_pref,
    notes,
    status,
    last_run_at,
    next_run_at,
    last_summary,
    created_at,
    updated_at
   FROM list_hub.find_requests
  WHERE (list_hub.is_member(household_id) OR list_hub.actor_is_service_role());

CREATE OR REPLACE VIEW public.lh_finds WITH (security_invoker = true) AS  SELECT id,
    item_id,
    household_id,
    title,
    price,
    source,
    url,
    condition,
    notes,
    found_at,
    found_by,
    found_by_kind,
    found_by_user_id,
    created_at
   FROM list_hub.finds
  WHERE (list_hub.is_member(household_id) OR list_hub.actor_is_service_role());

CREATE OR REPLACE VIEW public.lh_households WITH (security_invoker = true) AS  SELECT id,
    name,
    access_code,
    created_at
   FROM list_hub.households;

CREATE OR REPLACE VIEW public.lh_item_prefs WITH (security_invoker = true) AS  SELECT household_id,
    name_key,
    preferred_store_id,
    use_count,
    last_used_at
   FROM list_hub.item_prefs;

CREATE OR REPLACE VIEW public.lh_items WITH (security_invoker = true) AS  SELECT id,
    list_id,
    name,
    qty,
    notes,
    preferred_store_id,
    status,
    discreet,
    sort_order,
    created_by,
    created_at,
    updated_at,
    category,
    category_source,
    barcode,
    bought_at,
    trip_id,
    target_price,
    preferred_source,
    product_links,
    added_by_user_id,
    added_by_kind,
    subsection,
    agent_state,
    agent_note
   FROM list_hub.items;

CREATE OR REPLACE VIEW public.lh_lists WITH (security_invoker = true) AS  SELECT id,
    household_id,
    slug,
    name,
    kind,
    status,
    notes,
    finalized_at,
    created_at,
    updated_at
   FROM list_hub.lists;

CREATE OR REPLACE VIEW public.lh_members WITH (security_invoker = true) AS  SELECT household_id,
    email,
    display_name,
    role,
    user_id,
    created_at
   FROM list_hub.members;

CREATE OR REPLACE VIEW public.lh_purchases WITH (security_invoker = true) AS  SELECT id,
    household_id,
    name,
    name_key,
    purchased_at,
    source,
    store_id,
    store_name,
    qty,
    category,
    subsection,
    item_id,
    trip_id,
    external_ref,
    created_by,
    created_at
   FROM list_hub.purchases;

CREATE OR REPLACE VIEW public.lh_stores WITH (security_invoker = true) AS  SELECT id,
    slug,
    name,
    kind,
    sort_order,
    active,
    household_id,
    app_hint
   FROM list_hub.stores;

CREATE OR REPLACE VIEW public.lh_trip_items WITH (security_invoker = true) AS  SELECT id,
    trip_id,
    household_id,
    item_id,
    name,
    qty,
    category,
    checked,
    checked_at,
    sort_order,
    created_at,
    subsection
   FROM list_hub.trip_items
  WHERE list_hub.is_member(household_id);

CREATE OR REPLACE VIEW public.lh_trips WITH (security_invoker = true) AS  SELECT id,
    household_id,
    store_id,
    store_name,
    status,
    created_by,
    created_at,
    completed_at,
    export_target,
    export_status,
    export_payload,
    notes
   FROM list_hub.trips
  WHERE list_hub.is_member(household_id);

-- ===== trg
CREATE TRIGGER items_set_adder BEFORE INSERT ON list_hub.items FOR EACH ROW EXECUTE FUNCTION list_hub.set_item_adder();
CREATE TRIGGER finds_set_defaults BEFORE INSERT ON list_hub.finds FOR EACH ROW EXECUTE FUNCTION list_hub.set_find_defaults();
CREATE TRIGGER find_requests_set_defaults BEFORE INSERT ON list_hub.find_requests FOR EACH ROW EXECUTE FUNCTION list_hub.set_find_request_defaults();
CREATE TRIGGER find_requests_touch BEFORE UPDATE ON list_hub.find_requests FOR EACH ROW EXECUTE FUNCTION list_hub.touch_find_request();
CREATE TRIGGER find_requests_cancel_prior AFTER INSERT ON list_hub.find_requests FOR EACH ROW EXECUTE FUNCTION list_hub.cancel_prior_find_requests();
CREATE TRIGGER purchases_fill BEFORE INSERT OR UPDATE ON list_hub.purchases FOR EACH ROW EXECUTE FUNCTION list_hub.purchases_fill();
CREATE TRIGGER items_record_purchase AFTER UPDATE OF status ON list_hub.items FOR EACH ROW EXECUTE FUNCTION list_hub.items_record_purchase();

-- ===== pol
ALTER TABLE list_hub.households ENABLE ROW LEVEL SECURITY; CREATE POLICY households_member_select ON list_hub.households AS PERMISSIVE FOR SELECT TO authenticated USING (list_hub.is_member(id));
ALTER TABLE list_hub.members ENABLE ROW LEVEL SECURITY; CREATE POLICY members_member_select ON list_hub.members AS PERMISSIVE FOR SELECT TO authenticated USING (list_hub.is_member(household_id));
ALTER TABLE list_hub.lists ENABLE ROW LEVEL SECURITY; CREATE POLICY lists_member ON list_hub.lists AS PERMISSIVE FOR ALL TO authenticated USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
ALTER TABLE list_hub.stores ENABLE ROW LEVEL SECURITY; CREATE POLICY stores_member ON list_hub.stores AS PERMISSIVE FOR ALL TO authenticated USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
ALTER TABLE list_hub.item_prefs ENABLE ROW LEVEL SECURITY; CREATE POLICY item_prefs_member ON list_hub.item_prefs AS PERMISSIVE FOR ALL TO authenticated USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
ALTER TABLE list_hub.items ENABLE ROW LEVEL SECURITY; CREATE POLICY items_member ON list_hub.items AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM list_hub.lists l
  WHERE ((l.id = items.list_id) AND list_hub.is_member(l.household_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM list_hub.lists l
  WHERE ((l.id = items.list_id) AND list_hub.is_member(l.household_id)))));
ALTER TABLE list_hub.agent_tokens ENABLE ROW LEVEL SECURITY; CREATE POLICY agent_tokens_member_select ON list_hub.agent_tokens AS PERMISSIVE FOR SELECT TO authenticated USING (list_hub.is_member(household_id));
ALTER TABLE list_hub.category_cache ENABLE ROW LEVEL SECURITY; CREATE POLICY category_cache_member ON list_hub.category_cache AS PERMISSIVE FOR ALL TO authenticated USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
ALTER TABLE list_hub.trips ENABLE ROW LEVEL SECURITY; CREATE POLICY trips_member ON list_hub.trips AS PERMISSIVE FOR ALL TO authenticated USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
ALTER TABLE list_hub.trip_items ENABLE ROW LEVEL SECURITY; CREATE POLICY trip_items_member ON list_hub.trip_items AS PERMISSIVE FOR ALL TO authenticated USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
ALTER TABLE list_hub.finds ENABLE ROW LEVEL SECURITY; CREATE POLICY finds_member ON list_hub.finds AS PERMISSIVE FOR ALL TO authenticated USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
ALTER TABLE list_hub.find_requests ENABLE ROW LEVEL SECURITY; CREATE POLICY find_requests_member ON list_hub.find_requests AS PERMISSIVE FOR ALL TO authenticated USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
ALTER TABLE list_hub.purchases ENABLE ROW LEVEL SECURITY; CREATE POLICY purchases_member ON list_hub.purchases AS PERMISSIVE FOR ALL TO authenticated USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
ALTER TABLE list_hub.repurchase_overrides ENABLE ROW LEVEL SECURITY; CREATE POLICY repurchase_overrides_member ON list_hub.repurchase_overrides AS PERMISSIVE FOR ALL TO authenticated USING (list_hub.is_member(household_id)) WITH CHECK (list_hub.is_member(household_id));
