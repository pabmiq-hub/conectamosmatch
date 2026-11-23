CREATE FUNCTION public.directory_event_allowed(_event uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT public.has_role(auth.uid(),'super_admin') OR EXISTS (
 SELECT 1 FROM public.event_registrations r JOIN public.profiles p ON p.id=r.user_id
 WHERE r.event_id=_event AND r.status <> 'cancelled' AND (r.user_id=auth.uid() OR p.account_id=public.my_account_id())
 );
$$;
REVOKE ALL ON FUNCTION public.directory_event_allowed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.directory_event_allowed(uuid) TO authenticated, service_role;
ALTER POLICY directory_order_read ON public.event_directory_order USING (public.directory_event_allowed(event_id));