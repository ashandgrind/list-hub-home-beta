-- List Hub: editable agent token labels, token-stamped items, removal log.
--
-- Additive only. Scope: list_hub plus public lh_* wrappers.
-- Does not touch Auth, Site URL, households, members, or non-List-Hub tables.
--
--   list_hub.agent_tokens.label            editable display label (defaults to name)
--   list_hub.items.added_by_token_id       which agent token added the item
--   list_hub.items.agent_by_token_id       which agent token last set agent_state / bought
--   list_hub.item_removals                 one row per deleted item (app or agent)
--   list_hub.set_item_adder()              keeps token-stamped inserts (label comes from the token)
--   public.lh_rename_agent_token(id, label)
--   public.lh_agent_token_labels()         id -> current label for every token (incl. revoked)
--   public.lh_agent_remove_item(item, token) service_role only: delete + log with the token
--   public.lh_item_removals(p_limit)       recent removals for the signed-in household
--
-- Apply on project dphkvcdohqsvefbdhsfx BEFORE deploying the matching
-- lh-agent-api. The current app and edge function keep working once this is
-- applied: every new column is nullable and unused until the new code ships.

-- ---------------------------------------------------------------------------
-- agent_tokens.label
-- ---------------------------------------------------------------------------
ALTER TABLE list_hub.agent_tokens
  ADD COLUMN IF NOT EXISTS label text;

UPDATE list_hub.agent_tokens SET label = name WHERE label IS NULL OR trim(label) = '';

ALTER TABLE list_hub.agent_tokens
  DROP CONSTRAINT IF EXISTS agent_tokens_label_check;
ALTER TABLE list_hub.agent_tokens
  ADD CONSTRAINT agent_tokens_label_check
  CHECK (label IS NULL OR (char_length(trim(label)) >= 1 AND char_length(label) <= 80));

COMMENT ON COLUMN list_hub.agent_tokens.label IS
  'Display label shown on items this token adds (e.g. House). Editable by household members. Falls back to name.';

CREATE OR REPLACE FUNCTION list_hub.agent_token_label_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.label IS NULL OR trim(NEW.label) = '' THEN
    NEW.label := NEW.name;
  ELSE
    NEW.label := left(trim(NEW.label), 80);
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS agent_tokens_label_default ON list_hub.agent_tokens;
CREATE TRIGGER agent_tokens_label_default
  BEFORE INSERT OR UPDATE OF label, name ON list_hub.agent_tokens
  FOR EACH ROW
  EXECUTE FUNCTION list_hub.agent_token_label_default();

-- ---------------------------------------------------------------------------
-- items: token stamps
-- ---------------------------------------------------------------------------
ALTER TABLE list_hub.items
  ADD COLUMN IF NOT EXISTS added_by_token_id uuid REFERENCES list_hub.agent_tokens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_by_token_id uuid REFERENCES list_hub.agent_tokens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS items_added_by_token_idx ON list_hub.items (added_by_token_id) WHERE added_by_token_id IS NOT NULL;

COMMENT ON COLUMN list_hub.items.added_by_token_id IS
  'Agent token that added this item. The app shows the token''s current label, so renaming the token relabels its items.';
COMMENT ON COLUMN list_hub.items.agent_by_token_id IS
  'Agent token that last set agent_state or marked the item bought through lh-agent-api.';

-- ---------------------------------------------------------------------------
-- set_item_adder: token-stamped inserts keep the token and its label.
-- Shopping Buddy (service role, no token) and members behave as before.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_hub.set_item_adder()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_explicit text := lower(trim(coalesce(NEW.created_by, '')));
  v_member list_hub.members;
  v_token list_hub.agent_tokens;
BEGIN
  IF NEW.added_by_token_id IS NOT NULL THEN
    SELECT tok.* INTO v_token
      FROM list_hub.agent_tokens tok
      JOIN list_hub.lists l ON l.id = NEW.list_id AND l.household_id = tok.household_id
     WHERE tok.id = NEW.added_by_token_id;
    IF v_token.id IS NOT NULL AND list_hub.actor_is_service_role() THEN
      NEW.created_by := coalesce(nullif(trim(v_token.label), ''), v_token.name);
      NEW.added_by_kind := 'assistant';
      NEW.added_by_user_id := NULL;
      RETURN NEW;
    END IF;
    -- Unknown token, other household, or not the service role: drop the stamp.
    NEW.added_by_token_id := NULL;
  END IF;

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

-- ---------------------------------------------------------------------------
-- item_removals: removal log (hard delete stays; this records it)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS list_hub.item_removals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  item_id uuid NOT NULL,
  item_name text NOT NULL,
  item_qty text,
  list_id uuid,
  list_kind text,
  list_name text,
  item_status text,
  removed_by_kind text NOT NULL,
  removed_by_token_id uuid,
  removed_by_user_id uuid,
  removed_by_label text,
  removed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_removals_kind_check CHECK (removed_by_kind = ANY (ARRAY['agent'::text, 'member'::text, 'service'::text, 'unknown'::text]))
);
-- No foreign keys on purpose: the log must outlive the item, the list, and the token.

CREATE INDEX IF NOT EXISTS item_removals_hh_idx ON list_hub.item_removals (household_id, removed_at DESC);

COMMENT ON TABLE list_hub.item_removals IS
  'One row per deleted item. Written by the items_log_removal trigger. Agent removals carry the token id and label.';

ALTER TABLE list_hub.item_removals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS item_removals_member_select ON list_hub.item_removals;
CREATE POLICY item_removals_member_select ON list_hub.item_removals
  FOR SELECT TO authenticated
  USING (list_hub.is_member(household_id));

GRANT SELECT ON list_hub.item_removals TO authenticated;
GRANT SELECT, INSERT ON list_hub.item_removals TO service_role;

CREATE OR REPLACE FUNCTION list_hub.items_log_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_list list_hub.lists;
  v_token list_hub.agent_tokens;
  v_member list_hub.members;
  v_token_setting text := nullif(current_setting('list_hub.actor_token_id', true), '');
  v_kind text := 'unknown';
  v_label text;
  v_user uuid;
BEGIN
  SELECT * INTO v_list FROM list_hub.lists WHERE id = OLD.list_id;
  IF v_list.household_id IS NULL THEN
    RETURN OLD; -- list already gone (cascade); nothing to scope the row to.
  END IF;

  IF v_token_setting IS NOT NULL THEN
    SELECT * INTO v_token FROM list_hub.agent_tokens
     WHERE id = v_token_setting::uuid AND household_id = v_list.household_id;
  END IF;

  IF v_token.id IS NOT NULL THEN
    v_kind := 'agent';
    v_label := coalesce(nullif(trim(v_token.label), ''), v_token.name);
  ELSE
    SELECT m.* INTO v_member FROM list_hub.members m
     WHERE m.household_id = v_list.household_id
       AND (m.user_id = auth.uid() OR lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
     LIMIT 1;
    IF v_member.email IS NOT NULL THEN
      v_kind := 'member';
      v_label := v_member.display_name;
      v_user := coalesce(v_member.user_id, auth.uid());
    ELSIF list_hub.actor_is_service_role() THEN
      v_kind := 'service';
      v_label := 'Shopping Buddy';
    END IF;
  END IF;

  INSERT INTO list_hub.item_removals (
    household_id, item_id, item_name, item_qty, list_id, list_kind, list_name, item_status,
    removed_by_kind, removed_by_token_id, removed_by_user_id, removed_by_label
  ) VALUES (
    v_list.household_id, OLD.id, OLD.name, OLD.qty, v_list.id, v_list.kind, v_list.name, OLD.status,
    v_kind, v_token.id, v_user, v_label
  );
  RETURN OLD;
END
$function$;

DROP TRIGGER IF EXISTS items_log_removal ON list_hub.items;
CREATE TRIGGER items_log_removal
  AFTER DELETE ON list_hub.items
  FOR EACH ROW
  EXECUTE FUNCTION list_hub.items_log_removal();

-- ---------------------------------------------------------------------------
-- public views (append columns only; existing columns unchanged)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.lh_items
WITH (security_invoker = true) AS
SELECT id,
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
    agent_note,
    added_by_token_id,
    agent_by_token_id
FROM list_hub.items;

CREATE OR REPLACE VIEW public.lh_agent_tokens
WITH (security_invoker = true) AS
SELECT id,
    household_id,
    name,
    token_hash,
    created_by,
    created_at,
    last_used_at,
    revoked_at,
    label
FROM list_hub.agent_tokens;

REVOKE ALL ON public.lh_agent_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.lh_agent_tokens TO service_role;

-- ---------------------------------------------------------------------------
-- token RPCs: create / list return label; rename; labels map
-- ---------------------------------------------------------------------------
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

  INSERT INTO list_hub.agent_tokens (household_id, name, label, token_hash, created_by)
  VALUES (v_member.household_id, v_name, v_name, v_hash, coalesce(v_member.display_name, v_member.email, 'member'))
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'label', v_row.label,
    'token', v_token,
    'created_at', v_row.created_at,
    'created_by', v_row.created_by
  );
END
$function$;

GRANT EXECUTE ON FUNCTION public.lh_create_agent_token(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lh_list_agent_tokens()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
      SELECT id, name, coalesce(label, name) AS label, created_by, created_at, last_used_at, revoked_at
      FROM list_hub.agent_tokens
      WHERE household_id = v_member.household_id
        AND revoked_at IS NULL
    ) t
  ), '[]'::json);
END
$function$;

GRANT EXECUTE ON FUNCTION public.lh_list_agent_tokens() TO authenticated;

CREATE OR REPLACE FUNCTION public.lh_rename_agent_token(id uuid, label text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_member list_hub.members;
  v_label text := left(trim(coalesce(label, '')), 80);
  v_row list_hub.agent_tokens;
BEGIN
  SELECT * INTO v_member FROM list_hub.current_member_row();
  IF v_member.household_id IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF v_label = '' THEN
    RAISE EXCEPTION 'label is required' USING ERRCODE = '22023';
  END IF;
  UPDATE list_hub.agent_tokens tok
     SET label = v_label
   WHERE tok.id = lh_rename_agent_token.id
     AND tok.household_id = v_member.household_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN json_build_object('ok', true, 'id', v_row.id, 'name', v_row.name, 'label', v_row.label);
END
$function$;

GRANT EXECUTE ON FUNCTION public.lh_rename_agent_token(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lh_agent_token_labels()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    SELECT json_object_agg(id, coalesce(nullif(trim(label), ''), name))
    FROM list_hub.agent_tokens
    WHERE household_id = v_member.household_id
  ), '{}'::json);
END
$function$;

GRANT EXECUTE ON FUNCTION public.lh_agent_token_labels() TO authenticated;

-- ---------------------------------------------------------------------------
-- agent remove: delete + removal log carrying the token (service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lh_agent_remove_item(p_item_id uuid, p_token_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_token list_hub.agent_tokens;
  v_item list_hub.items;
  v_hh uuid;
BEGIN
  IF NOT list_hub.actor_is_service_role() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_token FROM list_hub.agent_tokens WHERE id = p_token_id AND revoked_at IS NULL;
  IF v_token.id IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT it.* INTO v_item FROM list_hub.items it WHERE it.id = p_item_id;
  SELECT l.household_id INTO v_hh FROM list_hub.lists l WHERE l.id = v_item.list_id;
  IF v_item.id IS NULL OR v_hh IS DISTINCT FROM v_token.household_id THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;
  PERFORM set_config('list_hub.actor_token_id', v_token.id::text, true);
  DELETE FROM list_hub.items WHERE id = v_item.id;
  PERFORM set_config('list_hub.actor_token_id', '', true);
  RETURN json_build_object('ok', true, 'id', v_item.id, 'name', v_item.name, 'removed', 'deleted',
                           'removed_by', coalesce(nullif(trim(v_token.label), ''), v_token.name));
END
$function$;

REVOKE ALL ON FUNCTION public.lh_agent_remove_item(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lh_agent_remove_item(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.lh_item_removals(p_limit integer DEFAULT 50)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    SELECT json_agg(row_to_json(t) ORDER BY t.removed_at DESC)
    FROM (
      SELECT id, item_id, item_name, item_qty, list_kind, list_name, item_status,
             removed_by_kind, removed_by_label, removed_by_token_id, removed_at
      FROM list_hub.item_removals
      WHERE household_id = v_member.household_id
      ORDER BY removed_at DESC
      LIMIT greatest(1, least(coalesce(p_limit, 50), 500))
    ) t
  ), '[]'::json);
END
$function$;

GRANT EXECUTE ON FUNCTION public.lh_item_removals(integer) TO authenticated;
