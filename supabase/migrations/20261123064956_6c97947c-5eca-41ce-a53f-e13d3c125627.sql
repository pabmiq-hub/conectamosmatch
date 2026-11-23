CREATE TABLE public.event_directory_order (
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 target_kind text NOT NULL CHECK (target_kind IN ('empresa','sponsor')),
 sort_mode text NOT NULL DEFAULT 'alphabetical' CHECK (sort_mode IN ('alphabetical','most_interest','least_interest','random')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (event_id,target_kind)
);
GRANT SELECT, INSERT, UPDATE ON public.event_directory_order TO authenticated;
GRANT ALL ON public.event_directory_order TO service_role;
ALTER TABLE public.event_directory_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY directory_order_read ON public.event_directory_order FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin') OR EXISTS (SELECT 1 FROM public.event_registrations r JOIN public.profiles p ON p.id=r.user_id WHERE r.event_id=event_directory_order.event_id AND r.status <> 'cancelled' AND (r.user_id=auth.uid() OR p.account_id=public.my_account_id())));
CREATE POLICY directory_order_insert ON public.event_directory_order FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY directory_order_update ON public.event_directory_order FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER directory_order_timestamp BEFORE UPDATE ON public.event_directory_order FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();