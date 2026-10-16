-- Approximates Supabase default grants for the harness.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA list_hub TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
REVOKE ALL ON public.lh_agent_tokens FROM authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA list_hub TO authenticated, service_role;
-- Keep explicit REVOKEs from migrations (e.g. service-role-only RPCs) intact.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname LIKE 'lh\_%' AND p.proname <> 'lh_agent_remove_item'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
