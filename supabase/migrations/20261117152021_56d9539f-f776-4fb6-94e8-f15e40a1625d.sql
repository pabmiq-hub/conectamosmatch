CREATE TABLE public.attendee_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  attends boolean NOT NULL DEFAULT true,
  blocked_ranges jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_meetings integer,
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, event_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendee_availability TO authenticated;
GRANT ALL ON public.attendee_availability TO service_role;
ALTER TABLE public.attendee_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "availability read own team admin" ON public.attendee_availability FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.same_account(user_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "availability insert own or admin" ON public.attendee_availability FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "availability update own or admin" ON public.attendee_availability FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "availability delete own or admin" ON public.attendee_availability FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER update_attendee_availability_updated_at BEFORE UPDATE ON public.attendee_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();