-- List Hub: household AI-agent tokens + in-cart / unavailable flags.
--
-- Additive only (new table / columns / RPCs). Scope: list_hub plus new public
-- lh_* wrappers. Does not touch Auth, Site URL, or non-List-Hub tables.
--
--   list_hub.agent_tokens              named bearer tokens for AI agents
--   list_hub.items.agent_state         'in_cart' | 'unavailable' (open items stay needed)
--   list_hub.items.agent_note          optional note from an agent status update
--   list_hub.agent_token_hash(text)    sha256 hex of the plaintext token
--   public.lh_create_agent_token(name) returns the plaintext token ONCE
--   public.lh_list_agent_tokens()
--   public.lh_revoke_agent_token(id)
--
-- Apply on project dphkvcdohqsvefbdhsfx (SQL editor or supabase db push)
-- BEFORE deploying supabase/functions/lh-agent-api. The live app keeps working
-- if this file is applied first: new columns are unused until the new client
-- and edge function ship. Do not enable JWT verification on lh-agent-api;
-- that function authenticates with these tokens.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- items: agent progress (in_cart / unavailable). 'bought' uses status=checked
-- so the existing items_record_purchase trigger still fires.
-- ---------------------------------------------------------------------------
ALTER TABLE list_hub.items
  ADD COLUMN IF NOT EXISTS agent_state text,
  ADD COLUMN IF NOT EXISTS agent_note text;

ALTER TABLE list_hub.items
  DROP CONSTRAINT IF EXISTS items_agent_state_check;
ALTER TABLE list_hub.items
  ADD CONSTRAINT items_agent_state_check
  CHECK (agent_state IS NULL OR agent_state = ANY (ARRAY['in_cart'::text, 'unavailable'::text]));

COMMENT ON COLUMN list_hub.items.agent_state IS
  'Agent cart progress while the item is still open (needed): in_cart or unavailable. Bought/checked-off uses items.status.';
COMMENT ON COLUMN list_hub.items.agent_note IS
  'Optional note from an agent status update (store cart, out of stock, …).';

-- ---------------------------------------------------------------------------
-- agent_tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS list_hub.agent_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES list_hub.households(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_hash text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT agent_tokens_name_check CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 80),
  CONSTRAINT agent_tokens_hash_check CHECK (char_length(token_hash) = 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_tokens_hash_uq ON list_hub.agent_tokens (token_hash);
CREATE INDEX IF NOT EXISTS agent_tokens_hh_idx ON list_hub.agent_tokens (household_id, created_at DESC);

COMMENT ON TABLE list_hub.agent_tokens IS
  'Household API tokens for AI agents. Store only sha256(token). Plaintext is shown once at create time.';

ALTER TABLE list_hub.agent_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_tokens_member_select ON list_hub.agent_tokens;
CREATE POLICY agent_tokens_member_select ON list_hub.agent_tokens
  FOR SELECT TO authenticated
  USING (list_hub.is_member(household_id));

GRANT SELECT ON list_hub.agent_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON list_hub.agent_tokens TO service_role;

-- ---------------------------------------------------------------------------
-- hash helper (sha256 hex). Used by create RPC and lh-agent-api.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION list_hub.agent_token_hash(p_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$function$;

GRANT EXECUTE ON FUNCTION list_hub.agent_token_hash(text) TO service_role;

-- ---------------------------------------------------------------------------
-- current household for the signed-in member (same lookup as lh_bootstrap)
-- ---------------------------------------------------------------------------
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
$function$;

GRANT EXECUTE ON FUNCTION list_hub.current_member_row() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- public.lh_create_agent_token(name text)
-- Returns the plaintext token ONCE. Prefix lh_ + 32 random bytes, base64url.
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
$function$;

GRANT EXECUTE ON FUNCTION public.lh_create_agent_token(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- public.lh_list_agent_tokens()
-- Active tokens only. Never returns token or token_hash.
-- ---------------------------------------------------------------------------
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
      SELECT id, name, created_by, created_at, last_used_at, revoked_at
      FROM list_hub.agent_tokens
      WHERE household_id = v_member.household_id
        AND revoked_at IS NULL
    ) t
  ), '[]'::json);
END
$function$;

GRANT EXECUTE ON FUNCTION public.lh_list_agent_tokens() TO authenticated;

-- ---------------------------------------------------------------------------
-- public.lh_revoke_agent_token(id uuid)
-- ---------------------------------------------------------------------------
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
$function$;

GRANT EXECUTE ON FUNCTION public.lh_revoke_agent_token(uuid) TO authenticated;
