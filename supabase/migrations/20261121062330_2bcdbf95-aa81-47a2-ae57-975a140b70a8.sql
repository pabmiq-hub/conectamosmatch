CREATE TABLE public.event_featured_solutions (
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 sponsor_account_id uuid NOT NULL REFERENCES public.sponsor_profiles(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (event_id, sponsor_account_id)
);
GRANT SELECT, INSERT, DELETE ON public.event_featured_solutions TO authenticated;
GRANT ALL ON public.event_featured_solutions TO service_role;
ALTER TABLE public.event_featured_solutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read event highlights" ON public.event_featured_solutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Superadmins highlight registered solutions" ON public.event_featured_solutions FOR INSERT TO authenticated WITH CHECK (
 public.has_role(auth.uid(), 'super_admin') AND EXISTS (
 SELECT 1 FROM public.event_registrations r JOIN public.profiles p ON p.id = r.user_id
 WHERE r.event_id = event_featured_solutions.event_id AND p.account_id = event_featured_solutions.sponsor_account_id AND r.status IS DISTINCT FROM 'cancelled' AND r.role_at_event = 'sponsor'
 ));
CREATE POLICY "Superadmins remove highlights" ON public.event_featured_solutions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER event_featured_solutions_updated_at BEFORE UPDATE ON public.event_featured_solutions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();