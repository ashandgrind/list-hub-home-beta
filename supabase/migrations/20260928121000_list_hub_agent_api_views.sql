-- List Hub: public views for lh-agent-api (additive).
--
-- PostgREST on this project exposes `public` only (not `list_hub`), so the edge
-- function reads through public lh_* views like lh-categorize does.
--
--   public.lh_items        + agent_state, agent_note (appended; existing columns unchanged)
--   public.lh_agent_tokens service_role only (anon/authenticated have no grants)

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
    agent_note
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
    revoked_at
FROM list_hub.agent_tokens;

REVOKE ALL ON public.lh_agent_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.lh_agent_tokens TO service_role;

COMMENT ON VIEW public.lh_agent_tokens IS
  'Service-role view of list_hub.agent_tokens for lh-agent-api token lookup. Not granted to anon/authenticated.';
