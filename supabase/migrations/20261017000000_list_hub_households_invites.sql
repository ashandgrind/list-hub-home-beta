-- List Hub: admin-created households, member invites, one household per user.
--
-- Additive. Scope: list_hub plus public lh_* RPCs. Does not touch Auth settings,
-- the Site URL, the redirect allowlist, or non-List-Hub tables.
--
--   list_hub.admins                     who may create households (user ids; no client access)
--   list_hub.household_invites          one row per invite; stores the SHA-256 of the token only
--   members_one_household_* indexes     one household per user (removable, see below)
--   public.lh_is_admin()
--   public.lh_admin_create_household(p_name, p_owner_email, p_owner_name)
--   public.lh_create_invite(p_email, p_display_name)
--   public.lh_list_invites()
--   public.lh_cancel_invite(p_id)
--   public.lh_resend_invite(p_id)
--   public.lh_invite_preview(p_token)   anon: household name + status for the landing page
--   public.lh_accept_invite(p_token, p_display_name)
--   public.lh_auth_hint(p_email, p_invite)   members OR a valid pending invite
--   public.lh_bootstrap()                     deterministic; adds household {id, name}
--
-- Roadmap: several households per user and shared lists come later. members stays
-- a many-to-many table (household_id, email, user_id) and no user or profile row
-- gets a household_id. One household per user is enforced only by the two
-- members_one_household_* unique indexes plus the already_member checks in the
-- RPCs below; dropping those lifts the rule without reshaping any table.
--
-- Apply BEFORE shipping the matching app.js. The current app keeps working once
-- this is applied: lh_auth_hint still answers a one-argument call and
-- lh_bootstrap keeps every key it returned before.

-- ---------------------------------------------------------------------------
-- admins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS list_hub.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE list_hub.admins IS
  'List Hub admins: may create households. Managed with SQL only; clients cannot read or write it.';
ALTER TABLE list_hub.admins ENABLE ROW LEVEL SECURITY; -- no policies on purpose
REVOKE ALL ON list_hub.admins FROM PUBLIC, anon, authenticated;

-- Seed: the owner of the original household (a0000000-...-000000000001), if signed up.
-- In production that is Chris's account. No-op anywhere else.
INSERT INTO list_hub.admins (user_id, note)
SELECT m.user_id, 'seed: owner of the original household'
  FROM list_hub.members m
 WHERE m.household_id = 'a0000000-0000-4000-8000-000000000001'
   AND m.role = 'owner'
   AND m.user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Admin = signed-in user listed in list_hub.admins. The SQL editor (session user
-- postgres, no JWT) also counts, so Chris can run the create RPC from the console.
CREATE OR REPLACE FUNCTION list_hub.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL THEN EXISTS (SELECT 1 FROM list_hub.admins a WHERE a.user_id = auth.uid())
    ELSE session_user IN ('postgres', 'supabase_admin')
  END;
$function$;
REVOKE ALL ON FUNCTION list_hub.is_admin() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.lh_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT auth.uid() IS NOT NULL AND list_hub.is_admin();
$function$;
REVOKE ALL ON FUNCTION public.lh_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lh_is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- one household per user (removable: DROP these two indexes to allow several)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS members_one_household_email_uq ON list_hub.members (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS members_one_household_user_uq ON list_hub.members (user_id) WHERE user_id IS NOT NULL;
COMMENT ON INDEX list_hub.members_one_household_email_uq IS
  'One household per user for now. Drop (with members_one_household_user_uq) when multi-household lands.';

-- ---------------------------------------------------------------------------
-- household_invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS list_hub.household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES list_hub.households(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  email text,            -- NULL = link invite: whoever opens the link first (one use)
  display_name text,     -- name the new member gets unless they type one
  role text NOT NULL DEFAULT 'member',
  created_by_user uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid,
  used_by_email text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  CONSTRAINT household_invites_role_check CHECK (role = ANY (ARRAY['owner'::text, 'member'::text])),
  CONSTRAINT household_invites_hash_check CHECK (char_length(token_hash) = 64),
  CONSTRAINT household_invites_email_check CHECK (email IS NULL OR (email = lower(email) AND position('@' in email) > 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS household_invites_hash_uq ON list_hub.household_invites (token_hash);
CREATE INDEX IF NOT EXISTS household_invites_hh_idx ON list_hub.household_invites (household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS household_invites_email_idx ON list_hub.household_invites (email) WHERE email IS NOT NULL;
COMMENT ON TABLE list_hub.household_invites IS
  'Household invites. Only the SHA-256 of the token is stored. Valid while used_at, cancelled_at are NULL and expires_at is in the future (7 days). Read and written through lh_* RPCs only.';
ALTER TABLE list_hub.household_invites ENABLE ROW LEVEL SECURITY; -- no policies: RPCs only
REVOKE ALL ON list_hub.household_invites FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION list_hub.invite_status(i list_hub.household_invites)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN i.id IS NULL THEN 'not_found'
    WHEN i.used_at IS NOT NULL THEN 'used'
    WHEN i.cancelled_at IS NOT NULL THEN 'cancelled'
    WHEN i.expires_at <= now() THEN 'expired'
    ELSE 'pending'
  END;
$function$;

CREATE OR REPLACE FUNCTION list_hub.mask_email(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE WHEN p IS NULL OR position('@' in p) < 2 THEN NULL
    ELSE left(p, 1) || '***' || substr(p, position('@' in p)) END;
$function$;

CREATE OR REPLACE FUNCTION list_hub.normalize_email(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT nullif(lower(trim(coalesce(p, ''))), '');
$function$;

CREATE OR REPLACE FUNCTION list_hub.email_is_member(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM list_hub.members m WHERE lower(m.email) = list_hub.normalize_email(p_email));
$function$;
REVOKE ALL ON FUNCTION list_hub.email_is_member(text) FROM PUBLIC, anon, authenticated;

-- Internal: create one invite row and return it with the plain token (shown once).
CREATE OR REPLACE FUNCTION list_hub.issue_invite(
  p_household uuid, p_email text, p_display_name text, p_role text, p_by_user uuid, p_by_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_raw text;
  v_token text;
  v_row list_hub.household_invites;
BEGIN
  -- Defense in depth: the lh_* RPCs that call this already checked it.
  IF NOT (list_hub.is_admin() OR list_hub.is_member(p_household)) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  v_raw := encode(extensions.gen_random_bytes(32), 'base64');
  v_raw := replace(replace(replace(v_raw, '+', '-'), '/', '_'), '=', '');
  v_token := 'lhi_' || v_raw;
  INSERT INTO list_hub.household_invites (household_id, token_hash, email, display_name, role, created_by_user, created_by_name)
  VALUES (p_household, list_hub.agent_token_hash(v_token), p_email,
          nullif(left(trim(coalesce(p_display_name, '')), 80), ''), p_role, p_by_user, p_by_name)
  RETURNING * INTO v_row;
  RETURN json_build_object(
    'id', v_row.id, 'token', v_token, 'email', v_row.email, 'display_name', v_row.display_name,
    'role', v_row.role, 'expires_at', v_row.expires_at, 'household_id', v_row.household_id);
END
$function$;
REVOKE ALL ON FUNCTION list_hub.issue_invite(uuid, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin: create a household (empty List + Wishlist, no items, no stores) + owner invite
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lh_admin_create_household(p_name text, p_owner_email text, p_owner_name text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_name text := left(trim(coalesce(p_name, '')), 80);
  v_email text := list_hub.normalize_email(p_owner_email);
  v_hh uuid;
  v_by text;
  v_invite json;
BEGIN
  IF NOT list_hub.is_admin() THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'household name is required' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'a valid owner email is required' USING ERRCODE = '22023';
  END IF;
  -- One household per user (removable rule, see header).
  IF list_hub.email_is_member(v_email) THEN
    RAISE EXCEPTION 'already_member: that email already belongs to a household' USING ERRCODE = '23505';
  END IF;

  INSERT INTO list_hub.households (name, access_code)
  VALUES (v_name, encode(extensions.gen_random_bytes(6), 'hex'))
  RETURNING id INTO v_hh;

  INSERT INTO list_hub.lists (household_id, slug, name, kind, status) VALUES
    (v_hh, 'list', 'List', 'needs', 'open'),
    (v_hh, 'wish', 'Wishlist', 'wish', 'open');

  SELECT m.display_name INTO v_by FROM list_hub.current_member_row() m;
  v_invite := list_hub.issue_invite(v_hh, v_email, p_owner_name, 'owner', auth.uid(), coalesce(v_by, 'Admin'));

  RETURN json_build_object('ok', true, 'household_id', v_hh, 'name', v_name, 'invite', v_invite);
END
$function$;
REVOKE ALL ON FUNCTION public.lh_admin_create_household(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lh_admin_create_household(text, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- member invites (any member, owner or member role, may invite)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lh_create_invite(p_email text DEFAULT NULL, p_display_name text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_member list_hub.members;
  v_email text := list_hub.normalize_email(p_email);
  v_pending int;
BEGIN
  SELECT * INTO v_member FROM list_hub.current_member_row();
  IF v_member.household_id IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'that email doesn''t look right' USING ERRCODE = '22023';
  END IF;
  -- One household per user (removable rule, see header).
  IF v_email IS NOT NULL AND list_hub.email_is_member(v_email) THEN
    RAISE EXCEPTION 'already_member: that email already belongs to a household' USING ERRCODE = '23505';
  END IF;
  SELECT count(*) INTO v_pending FROM list_hub.household_invites i
   WHERE i.household_id = v_member.household_id AND list_hub.invite_status(i) = 'pending';
  IF v_pending >= 20 THEN
    RAISE EXCEPTION 'too_many_invites: cancel some pending invites first' USING ERRCODE = '54000';
  END IF;
  -- A new invite for the same email replaces the older pending one.
  IF v_email IS NOT NULL THEN
    UPDATE list_hub.household_invites i SET cancelled_at = now(), cancelled_by = auth.uid()
     WHERE i.household_id = v_member.household_id AND i.email = v_email
       AND i.used_at IS NULL AND i.cancelled_at IS NULL;
  END IF;
  RETURN list_hub.issue_invite(v_member.household_id, v_email, p_display_name, 'member',
                               coalesce(v_member.user_id, auth.uid()), v_member.display_name);
END
$function$;
REVOKE ALL ON FUNCTION public.lh_create_invite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lh_create_invite(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lh_list_invites()
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
      SELECT i.id, i.email, i.display_name, i.role, i.created_by_name, i.created_at, i.expires_at,
             i.used_at, i.used_by_email, i.cancelled_at, list_hub.invite_status(i) AS status
        FROM list_hub.household_invites i
       WHERE i.household_id = v_member.household_id
         AND (list_hub.invite_status(i) = 'pending' OR i.created_at > now() - interval '30 days')
       ORDER BY i.created_at DESC
       LIMIT 50
    ) t
  ), '[]'::json);
END
$function$;
REVOKE ALL ON FUNCTION public.lh_list_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lh_list_invites() TO authenticated;

CREATE OR REPLACE FUNCTION public.lh_cancel_invite(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_member list_hub.members;
  v_row list_hub.household_invites;
BEGIN
  SELECT * INTO v_member FROM list_hub.current_member_row();
  IF v_member.household_id IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE list_hub.household_invites i SET cancelled_at = now(), cancelled_by = auth.uid()
   WHERE i.id = p_id AND i.household_id = v_member.household_id
     AND i.used_at IS NULL AND i.cancelled_at IS NULL
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;
  RETURN json_build_object('ok', true, 'id', v_row.id);
END
$function$;
REVOKE ALL ON FUNCTION public.lh_cancel_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lh_cancel_invite(uuid) TO authenticated;

-- Resend = cancel the old invite (pending or expired, never used) and issue a new
-- token for the same email, name and role. Tokens are stored hashed, so the old
-- link cannot be shown again.
CREATE OR REPLACE FUNCTION public.lh_resend_invite(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_member list_hub.members;
  v_old list_hub.household_invites;
BEGIN
  SELECT * INTO v_member FROM list_hub.current_member_row();
  IF v_member.household_id IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_old FROM list_hub.household_invites i
   WHERE i.id = p_id AND i.household_id = v_member.household_id FOR UPDATE;
  IF v_old.id IS NULL OR v_old.used_at IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'error', CASE WHEN v_old.id IS NULL THEN 'not_found' ELSE 'used' END);
  END IF;
  IF v_old.email IS NOT NULL AND list_hub.email_is_member(v_old.email) THEN
    RETURN json_build_object('ok', false, 'error', 'already_member');
  END IF;
  UPDATE list_hub.household_invites
     SET cancelled_at = coalesce(cancelled_at, now()), cancelled_by = coalesce(cancelled_by, auth.uid())
   WHERE id = v_old.id;
  RETURN (list_hub.issue_invite(v_member.household_id, v_old.email, v_old.display_name, v_old.role,
                                coalesce(v_member.user_id, auth.uid()), v_member.display_name)::jsonb
          || jsonb_build_object('ok', true, 'replaces', v_old.id))::json;
END
$function$;
REVOKE ALL ON FUNCTION public.lh_resend_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lh_resend_invite(uuid) TO authenticated;

-- Landing page: anyone holding the token may see the household name and status.
CREATE OR REPLACE FUNCTION public.lh_invite_preview(p_token text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_inv list_hub.household_invites;
  v_name text;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 20 OR char_length(p_token) > 200 THEN
    RETURN json_build_object('status', 'not_found');
  END IF;
  SELECT * INTO v_inv FROM list_hub.household_invites WHERE token_hash = list_hub.agent_token_hash(p_token);
  IF v_inv.id IS NULL THEN
    RETURN json_build_object('status', 'not_found');
  END IF;
  SELECT h.name INTO v_name FROM list_hub.households h WHERE h.id = v_inv.household_id;
  RETURN json_build_object(
    'status', list_hub.invite_status(v_inv),
    'household_name', v_name,
    'invited_by', v_inv.created_by_name,
    'role', v_inv.role,
    'email_hint', list_hub.mask_email(v_inv.email),
    'email_required', v_inv.email IS NOT NULL,
    'expires_at', v_inv.expires_at);
END
$function$;
REVOKE ALL ON FUNCTION public.lh_invite_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lh_invite_preview(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.lh_accept_invite(p_token text, p_display_name text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := list_hub.normalize_email(auth.jwt() ->> 'email');
  v_inv list_hub.household_invites;
  v_status text;
  v_name text;
  v_display text;
  v_existing list_hub.members;
BEGIN
  IF v_uid IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR char_length(p_token) < 20 OR char_length(p_token) > 200 THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;
  SELECT * INTO v_inv FROM list_hub.household_invites
   WHERE token_hash = list_hub.agent_token_hash(p_token) FOR UPDATE;
  v_status := list_hub.invite_status(v_inv);
  SELECT h.name INTO v_name FROM list_hub.households h WHERE h.id = v_inv.household_id;

  SELECT m.* INTO v_existing FROM list_hub.members m
   WHERE m.user_id = v_uid OR lower(m.email) = v_email
   ORDER BY (m.user_id IS NOT DISTINCT FROM v_uid) DESC, m.created_at
   LIMIT 1;
  IF v_existing.household_id IS NOT NULL THEN
    IF v_existing.household_id = v_inv.household_id THEN
      RETURN json_build_object('ok', true, 'already', true, 'household_id', v_inv.household_id, 'household_name', v_name);
    END IF;
    -- One household per user (removable rule, see header).
    RETURN json_build_object('ok', false, 'error', 'already_member');
  END IF;

  IF v_status <> 'pending' THEN
    RETURN json_build_object('ok', false, 'error', v_status, 'household_name', v_name);
  END IF;
  IF v_inv.email IS NOT NULL AND v_inv.email <> v_email THEN
    RETURN json_build_object('ok', false, 'error', 'wrong_email', 'email_hint', list_hub.mask_email(v_inv.email), 'household_name', v_name);
  END IF;

  v_display := coalesce(
    nullif(left(trim(coalesce(p_display_name, '')), 80), ''),
    v_inv.display_name,
    initcap(regexp_replace(split_part(v_email, '@', 1), '[._+-]+', ' ', 'g')));
  BEGIN
    INSERT INTO list_hub.members (household_id, email, display_name, role, user_id)
    VALUES (v_inv.household_id, v_email, v_display, v_inv.role, v_uid);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'already_member');
  END;
  UPDATE list_hub.household_invites SET used_at = now(), used_by = v_uid, used_by_email = v_email WHERE id = v_inv.id;
  RETURN json_build_object('ok', true, 'household_id', v_inv.household_id, 'household_name', v_name,
                           'display_name', v_display, 'role', v_inv.role);
END
$function$;
REVOKE ALL ON FUNCTION public.lh_accept_invite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lh_accept_invite(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- lh_auth_hint: members OR an email with a valid pending invite (or holding one).
-- Replaces lh_auth_hint(text); a one-argument call still resolves to this.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.lh_auth_hint(text);
CREATE OR REPLACE FUNCTION public.lh_auth_hint(p_email text, p_invite text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  e text := lower(trim(coalesce(p_email, '')));
  u auth.users;
  v_member boolean;
  v_invited boolean := false;
  v_inv list_hub.household_invites;
BEGIN
  v_member := e <> '' AND EXISTS (SELECT 1 FROM list_hub.members WHERE lower(email) = e);
  IF NOT v_member AND e <> '' THEN
    v_invited := EXISTS (SELECT 1 FROM list_hub.household_invites i WHERE i.email = e AND list_hub.invite_status(i) = 'pending');
    IF NOT v_invited AND p_invite IS NOT NULL AND char_length(p_invite) BETWEEN 20 AND 200 THEN
      SELECT * INTO v_inv FROM list_hub.household_invites WHERE token_hash = list_hub.agent_token_hash(p_invite);
      v_invited := list_hub.invite_status(v_inv) = 'pending' AND (v_inv.email IS NULL OR v_inv.email = e);
    END IF;
  END IF;
  IF NOT v_member AND NOT v_invited THEN
    RETURN json_build_object('member', false);
  END IF;
  SELECT * INTO u FROM auth.users WHERE lower(email) = e AND deleted_at IS NULL LIMIT 1;
  -- "member" keeps its old meaning for the app: this email may sign in.
  RETURN json_build_object('member', true, 'invited', v_invited, 'account', u.id IS NOT NULL,
    'password_set', coalesce((u.raw_user_meta_data ->> 'has_password')::boolean, false));
END
$function$;
REVOKE ALL ON FUNCTION public.lh_auth_hint(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lh_auth_hint(text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- lh_bootstrap: deterministic member pick (user id match first, then oldest row,
-- then household id); adds household {id, name}. Everything else is unchanged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lh_bootstrap()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m list_hub.members; hh uuid;
begin
  select * into m from list_hub.members x
    where x.user_id = auth.uid() or lower(x.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    order by (x.user_id is not distinct from auth.uid()) desc, x.created_at, x.household_id
    limit 1;
  if m.household_id is null then return json_build_object('member', null); end if;
  hh := m.household_id;
  return json_build_object(
    'member', json_build_object('household_id', m.household_id, 'email', m.email, 'display_name', m.display_name, 'role', m.role, 'user_id', m.user_id),
    'household', (select json_build_object('id', h.id, 'name', h.name) from list_hub.households h where h.id = hh),
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
