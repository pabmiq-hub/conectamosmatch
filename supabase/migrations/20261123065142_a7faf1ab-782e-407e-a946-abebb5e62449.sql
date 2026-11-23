CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
ALTER FUNCTION public.directory_event_allowed(uuid) SET SCHEMA private;