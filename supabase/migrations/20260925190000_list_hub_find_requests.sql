-- List Hub: Shopping Buddy research requests (once / daily / weekly).
-- list_hub only, plus public.lh_find_requests wrapper (same pattern as lh_finds).
-- No Auth / Site URL / tattoo-shop changes.

CREATE TABLE IF NOT EXISTS list_hub.find_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES list_hub.households(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES list_hub.items(id) ON DELETE CASCADE,
  requested_by text NOT NULL DEFAULT 'unknown',
  requested_by_user_id uuid,
  frequency text NOT NULL,
  max_price numeric(12,2),
  condition_pref text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT find_requests_frequency_check CHECK (frequency = ANY (ARRAY['once'::text, 'daily'::text, 'weekly'::text])),
  CONSTRAINT find_requests_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'paused'::text, 'done'::text, 'cancelled'::text])),
  CONSTRAINT find_requests_condition_pref_check CHECK (
    condition_pref IS NULL OR condition_pref = ANY (ARRAY['new'::text, 'used'::text, 'any'::text])
  ),
  CONSTRAINT find_requests_max_price_check CHECK (max_price IS NULL OR max_price >= 0)
);

CREATE INDEX IF NOT EXISTS find_requests_due_idx
  ON list_hub.find_requests (status, next_run_at)
  WHERE status = ANY (ARRAY['pending'::text, 'active'::text]);

CREATE INDEX IF NOT EXISTS find_requests_item_idx
  ON list_hub.find_requests (item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS find_requests_household_idx
  ON list_hub.find_requests (household_id, status);

COMMENT ON TABLE list_hub.find_requests IS
  'Household research jobs for Shopping Buddy. Poll with list_hub.due_find_requests(); finish a run with list_hub.complete_find_run().';

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
$function$;

DROP TRIGGER IF EXISTS find_requests_set_defaults ON list_hub.find_requests;
CREATE TRIGGER find_requests_set_defaults
  BEFORE INSERT ON list_hub.find_requests
  FOR EACH ROW
  EXECUTE FUNCTION list_hub.set_find_request_defaults();

CREATE OR REPLACE FUNCTION list_hub.touch_find_request()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS find_requests_touch ON list_hub.find_requests;
CREATE TRIGGER find_requests_touch
  BEFORE UPDATE ON list_hub.find_requests
  FOR EACH ROW
  EXECUTE FUNCTION list_hub.touch_find_request();

ALTER TABLE list_hub.find_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS find_requests_member ON list_hub.find_requests;
CREATE POLICY find_requests_member ON list_hub.find_requests
  FOR ALL TO authenticated
  USING (list_hub.is_member(household_id))
  WITH CHECK (list_hub.is_member(household_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON list_hub.find_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON list_hub.find_requests TO service_role;

-- One open (pending/active/paused) request per item. Creating a new one
-- cancels any previous open request for that item.
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
$function$;

DROP TRIGGER IF EXISTS find_requests_cancel_prior ON list_hub.find_requests;
CREATE TRIGGER find_requests_cancel_prior
  AFTER INSERT ON list_hub.find_requests
  FOR EACH ROW
  EXECUTE FUNCTION list_hub.cancel_prior_find_requests();

CREATE OR REPLACE FUNCTION list_hub.next_find_run_at(p_frequency text, p_from timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE p_frequency
    WHEN 'daily' THEN p_from + interval '1 day'
    WHEN 'weekly' THEN p_from + interval '7 days'
    ELSE NULL
  END;
$function$;

-- Due jobs for Shopping Buddy (service role). Members only see their household.
CREATE OR REPLACE FUNCTION list_hub.due_find_requests()
RETURNS TABLE (
  id uuid,
  household_id uuid,
  item_id uuid,
  item_name text,
  item_notes text,
  target_price numeric,
  preferred_source text,
  product_links jsonb,
  frequency text,
  max_price numeric,
  condition_pref text,
  notes text,
  status text,
  requested_by text,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz
)
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
$function$;

COMMENT ON FUNCTION list_hub.due_find_requests() IS
  'Rows Shopping Buddy should research now. After logging finds, call list_hub.complete_find_run.';

GRANT EXECUTE ON FUNCTION list_hub.due_find_requests() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION list_hub.complete_find_run(p_request_id uuid, p_summary text DEFAULT NULL)
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
$function$;

COMMENT ON FUNCTION list_hub.complete_find_run(uuid, text) IS
  'Mark a research run finished. once → done; daily/weekly stay active with next_run_at set.';

GRANT EXECUTE ON FUNCTION list_hub.complete_find_run(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE VIEW list_hub.lh_find_requests
WITH (security_invoker = true) AS
SELECT
  id, household_id, item_id, requested_by, requested_by_user_id, frequency,
  max_price, condition_pref, notes, status, last_run_at, next_run_at,
  last_summary, created_at, updated_at
FROM list_hub.find_requests;

GRANT SELECT, INSERT, UPDATE, DELETE ON list_hub.lh_find_requests TO authenticated, service_role;

CREATE OR REPLACE VIEW public.lh_find_requests
WITH (security_invoker = true, check_option = local) AS
SELECT
  id, household_id, item_id, requested_by, requested_by_user_id, frequency,
  max_price, condition_pref, notes, status, last_run_at, next_run_at,
  last_summary, created_at, updated_at
FROM list_hub.find_requests
WHERE list_hub.is_member(household_id)
   OR list_hub.actor_is_service_role();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lh_find_requests TO authenticated, service_role;

-- Established public lh_* wrappers so PostgREST / supabase-js can call the
-- assistant RPCs without setting the list_hub schema.
CREATE OR REPLACE FUNCTION public.lh_due_find_requests()
RETURNS TABLE (
  id uuid,
  household_id uuid,
  item_id uuid,
  item_name text,
  item_notes text,
  target_price numeric,
  preferred_source text,
  product_links jsonb,
  frequency text,
  max_price numeric,
  condition_pref text,
  notes text,
  status text,
  requested_by text,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT * FROM list_hub.due_find_requests();
$function$;

COMMENT ON FUNCTION public.lh_due_find_requests() IS
  'Public wrapper for list_hub.due_find_requests(). Shopping Buddy (service role) or household members.';

GRANT EXECUTE ON FUNCTION public.lh_due_find_requests() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lh_complete_find_run(p_request_id uuid, p_summary text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  household_id uuid,
  item_id uuid,
  requested_by text,
  requested_by_user_id uuid,
  frequency text,
  max_price numeric,
  condition_pref text,
  notes text,
  status text,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_summary text,
  created_at timestamptz,
  updated_at timestamptz
)
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
$function$;

COMMENT ON FUNCTION public.lh_complete_find_run(uuid, text) IS
  'Public wrapper for list_hub.complete_find_run(request_id, summary).';

GRANT EXECUTE ON FUNCTION public.lh_complete_find_run(uuid, text) TO authenticated, service_role;
