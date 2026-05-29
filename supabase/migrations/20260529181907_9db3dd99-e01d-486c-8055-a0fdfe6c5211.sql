
-- Drop overly permissive write policies (writes go through serverFn + supabaseAdmin)
DROP POLICY IF EXISTS "rooms_insert_all" ON public.rooms;
DROP POLICY IF EXISTS "rooms_update_all" ON public.rooms;
DROP POLICY IF EXISTS "players_insert_all" ON public.players;
DROP POLICY IF EXISTS "players_update_all" ON public.players;
DROP POLICY IF EXISTS "players_delete_all" ON public.players;

-- Revoke direct write grants from clients; service_role keeps ALL.
REVOKE INSERT, UPDATE ON public.rooms FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.players FROM anon, authenticated;

-- Lock down trigger function execution
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
