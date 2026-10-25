-- List Hub: read-only embed tokens for the TV / kiosk list widget (/listhub/embed).
--
-- Additive only. Scope: list_hub plus new public lh_* RPCs. Does not touch Auth,
-- agent tokens, the agent API, or any non-List-Hub table.
--
--   list_hub.embed_tokens                     one row per embed token; stores the SHA-256 only
--   public.lh_create_embed_token(p_label, p_household_id)   returns the plaintext token ONCE
--   public.lh_list_embed_tokens(p_household_id)
--   public.lh_revoke_embed_token(p_id)
--   public.lh_embed_list(p_token)             anon: the household's open List, display fields only
--
-- Embed tokens are a separate kind from agent tokens:
--   * prefix lhe_ (agent tokens use lh_), separate table, separate lookup.
--   * lh_embed_list only reads list_hub.embed_tokens, so an agent token never works here.
--   * lh-agent-api only reads list_hub.agent_tokens and requires the lh_ prefix, so an
--     embed token never works there (no read, no write).
--   * An embed token is not a JWT, so PostgREST refuses it as a bearer token. The only
--     thing it can do is call lh_embed_list, which is read-only apart from a throttled
--     last_used_at stamp on the token row.
--
-- lh_embed_list returns, per open (needed) item on the household's main List:
-- name, quantity, store, section, subsection, plus pinned (true when a member
-- picked the section by hand, so the page groups it the same way the app does). No ids, notes, emails, member names,
-- who added it, prices, or links. Discreet items are left out. It also returns the
-- household name for the widget title.
--
-- Members and admins manage tokens in the app (Menu > TV and embed) or with SQL:
--   select public.lh_create_embed_token('Kitchen TV', '<household id>');   -- admin / SQL editor
--   select public.lh_list_embed_tokens('<household id>');
--   select public.lh_revoke_embed_token('<token id>');
--
-- Safe to apply before the matching app ships: nothing reads these objects until
-- the new embed page and Menu section are deployed.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- embed_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS list_hub.embed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES list_hub.households(id) ON DELETE CASCADE,
  label text NOT NULL,
  token_hash text NOT NULL,
  created_by_user uuid,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by text,
  CONSTRAINT embed_tokens_label_check CHECK (char_length(trim(label)) >= 1 AND char_length(label) <= 80),
  CONSTRAINT embed_tokens_hash_check CHECK (char_length(token_hash) = 64)
);
CREATE UNIQUE INDEX IF NOT EXISTS embed_tokens_hash_uq ON list_hub.embed_tokens (token_hash);
CREATE INDEX IF NOT EXISTS embed_tokens_hh_idx ON list_hub.embed_tokens (household_id, created_at DESC);
COMMENT ON TABLE list_hub.embed_tokens IS
  'Read-only embed tokens (prefix lhe_) for the List Hub TV / kiosk widget. Only sha256(token) is stored. Read and written through lh_* RPCs only.';
ALTER TABLE list_hub.embed_tokens ENABLE ROW LEVEL SECURITY; -- no policies on purpose: RPCs only
REVOKE ALL ON list_hub.embed_tokens FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- which household a token RPC acts on.
--   p_household_id NULL  -> the signed-in member's household
--   p_household_id given -> must be that member's household, or the caller is an
--                           admin (list_hub.admins, or the SQL editor)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_hub.embed_target_household(p_household_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_member list_hub.members;
BEGIN
  SELECT * INTO v_member FROM list_hub.current_member_row();
  IF p_household_id IS NULL THEN
    IF v_member.household_id IS NULL THEN
      RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
    END IF;
    RETURN v_member.household_id;
  END IF;
  IF coalesce(v_member.household_id = p_household_id, false) OR coalesce(list_hub.is_admin(), false) THEN
    IF NOT EXISTS (SELECT 1 FROM list_hub.households h WHERE h.id = p_household_id) THEN
      RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
    END IF;
    RETURN p_household_id;
  END IF;
  RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
END
$function$;
REVOKE ALL ON FUNCTION list_hub.embed_target_household(uuid) FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- public.lh_create_embed_token(p_label, p_household_id)
-- Returns the plaintext token ONCE. Prefix lhe_ + 32 random bytes, base64url.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lh_create_embed_token(p_label text, p_household_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_hh uuid := list_hub.embed_target_household(p_household_id);
  v_member list_hub.members;
  v_label text := left(trim(coalesce(p_label, '')), 80);
  v_raw text;
  v_token text;
  v_row list_hub.embed_tokens;
BEGIN
  IF v_label = '' THEN
    RAISE EXCEPTION 'label is required' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM list_hub.embed_tokens t WHERE t.household_id = v_hh AND t.revoked_at IS NULL) >= 20 THEN
    RAISE EXCEPTION 'too_many_tokens' USING ERRCODE = '54000';
  END IF;
  SELECT * INTO v_member FROM list_hub.current_member_row();

  v_raw := encode(extensions.gen_random_bytes(32), 'base64');
  v_raw := replace(replace(replace(v_raw, '+', '-'), '/', '_'), '=', '');
  v_token := 'lhe_' || v_raw;

  INSERT INTO list_hub.embed_tokens (household_id, label, token_hash, created_by_user, created_by)
  VALUES (v_hh, v_label, list_hub.agent_token_hash(v_token), auth.uid(),
          coalesce(v_member.display_name, CASE WHEN auth.uid() IS NULL THEN 'admin (SQL)' ELSE 'admin' END))
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'label', v_row.label,
    'token', v_token,
    'created_at', v_row.created_at,
    'created_by', v_row.created_by);
END
$function$;
REVOKE ALL ON FUNCTION public.lh_create_embed_token(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lh_create_embed_token(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- public.lh_list_embed_tokens(p_household_id)
-- Active tokens only. Never returns the token or its hash.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lh_list_embed_tokens(p_household_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_hh uuid := list_hub.embed_target_household(p_household_id);
BEGIN
  RETURN coalesce((
    SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
    FROM (
      SELECT id, label, created_by, created_at, last_used_at
      FROM list_hub.embed_tokens
      WHERE household_id = v_hh AND revoked_at IS NULL
    ) t
  ), '[]'::json);
END
$function$;
REVOKE ALL ON FUNCTION public.lh_list_embed_tokens(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lh_list_embed_tokens(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- public.lh_revoke_embed_token(p_id)
-- A member of the token's household, or an admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lh_revoke_embed_token(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_member list_hub.members;
  v_row list_hub.embed_tokens;
BEGIN
  SELECT * INTO v_member FROM list_hub.current_member_row();
  SELECT * INTO v_row FROM list_hub.embed_tokens t WHERE t.id = p_id AND t.revoked_at IS NULL;
  -- coalesce: a caller with no member row must not slip through on a NULL comparison
  IF v_row.id IS NULL OR NOT (coalesce(v_row.household_id = v_member.household_id, false) OR coalesce(list_hub.is_admin(), false)) THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE list_hub.embed_tokens t
     SET revoked_at = now(),
         revoked_by = coalesce(v_member.display_name, 'admin')
   WHERE t.id = v_row.id
  RETURNING * INTO v_row;
  RETURN json_build_object('ok', true, 'id', v_row.id, 'revoked_at', v_row.revoked_at);
END
$function$;
REVOKE ALL ON FUNCTION public.lh_revoke_embed_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lh_revoke_embed_token(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- public.lh_embed_list(p_token)   anon-callable, read-only display data
--
-- Unknown, malformed, revoked, and agent tokens all get the same answer:
-- {"status":"invalid"}. Main List = the household's non-archived list of kind
-- 'needs' (oldest first), else 'grocery', the same list the app opens on.
-- section / subsection fall back to the household category cache the same way
-- the app does, and the page groups them with categories.js.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lh_embed_list(p_token text)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tok list_hub.embed_tokens;
  v_list uuid;
  v_name text;
  v_items json;
BEGIN
  IF p_token IS NULL OR left(p_token, 4) <> 'lhe_' OR char_length(p_token) < 24 OR char_length(p_token) > 200 THEN
    RETURN json_build_object('status', 'invalid');
  END IF;
  SELECT * INTO v_tok FROM list_hub.embed_tokens t WHERE t.token_hash = list_hub.agent_token_hash(p_token);
  IF v_tok.id IS NULL OR v_tok.revoked_at IS NOT NULL THEN
    RETURN json_build_object('status', 'invalid');
  END IF;

  IF v_tok.last_used_at IS NULL OR v_tok.last_used_at < now() - interval '10 minutes' THEN
    UPDATE list_hub.embed_tokens t SET last_used_at = now() WHERE t.id = v_tok.id;
  END IF;

  SELECT h.name INTO v_name FROM list_hub.households h WHERE h.id = v_tok.household_id;
  SELECT l.id INTO v_list
    FROM list_hub.lists l
   WHERE l.household_id = v_tok.household_id
     AND l.status <> 'archived'
     AND l.kind IN ('needs', 'grocery')
   ORDER BY (l.kind = 'needs') DESC, l.created_at
   LIMIT 1;

  SELECT coalesce(json_agg(json_build_object(
           'name', x.name,
           'quantity', x.quantity,
           'store', x.store,
           'section', x.section,
           'subsection', x.subsection,
           'pinned', x.pinned) ORDER BY x.created_at, x.name), '[]'::json)
    INTO v_items
    FROM (
      SELECT i.name,
             nullif(trim(coalesce(i.qty, '')), '') AS quantity,
             s.name AS store,
             coalesce(nullif(i.category, ''), cc.category) AS section,
             coalesce(nullif(i.subsection, ''), nullif(cc.subsection, '')) AS subsection,
             coalesce(i.category_source = 'user', false) AS pinned,
             i.created_at
        FROM list_hub.items i
        LEFT JOIN list_hub.stores s
               ON s.id = i.preferred_store_id AND s.household_id = v_tok.household_id
        LEFT JOIN list_hub.category_cache cc
               ON cc.household_id = v_tok.household_id
              AND cc.name_key = left(regexp_replace(lower(btrim(i.name)), '\s+', ' ', 'g'), 120)
       WHERE i.list_id = v_list
         AND i.status = 'needed'
         AND NOT i.discreet
       ORDER BY i.created_at
       LIMIT 500
    ) x;

  RETURN json_build_object(
    'status', 'ok',
    'household', v_name,
    'list', 'List',
    'generated_at', now(),
    'items', v_items);
END
$function$;
REVOKE ALL ON FUNCTION public.lh_embed_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lh_embed_list(text) TO anon, authenticated;
