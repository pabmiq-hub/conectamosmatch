ALTER TABLE public.events ADD COLUMN IF NOT EXISTS allow_participant_availability boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "availability insert own or admin" ON public.attendee_availability;
DROP POLICY IF EXISTS "availability update own or admin" ON public.attendee_availability;
DROP POLICY IF EXISTS "availability delete own or admin" ON public.attendee_availability;

CREATE POLICY "availability insert own or admin" ON public.attendee_availability FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.allow_participant_availability)));
CREATE POLICY "availability update own or admin" ON public.attendee_availability FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.allow_participant_availability)))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.allow_participant_availability)));
CREATE POLICY "availability delete own or admin" ON public.attendee_availability FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.allow_participant_availability)));