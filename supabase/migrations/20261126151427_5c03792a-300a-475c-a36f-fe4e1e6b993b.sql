CREATE TABLE public.event_talk_exclusions (
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 talk_id text NOT NULL,
 person_name text NOT NULL,
 company_name text NOT NULL,
 removed_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (event_id, talk_id, person_name, company_name)
);
GRANT SELECT, INSERT, DELETE ON public.event_talk_exclusions TO authenticated;
GRANT ALL ON public.event_talk_exclusions TO service_role;
ALTER TABLE public.event_talk_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Superadmins read Talk exclusions" ON public.event_talk_exclusions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Superadmins remove Talk attendance" ON public.event_talk_exclusions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin') AND removed_by = auth.uid());
CREATE POLICY "Superadmins restore Talk attendance" ON public.event_talk_exclusions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER update_event_talk_exclusions BEFORE UPDATE ON public.event_talk_exclusions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();