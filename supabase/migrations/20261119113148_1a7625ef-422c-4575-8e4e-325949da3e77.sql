ALTER TABLE public.events ADD COLUMN IF NOT EXISTS meetings_published boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS meetings_published_at timestamptz;

CREATE OR REPLACE FUNCTION public.meetings_visible(_event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT meetings_published FROM public.events WHERE id = _event), false)
$$;

DROP POLICY IF EXISTS "meetings participants read" ON public.meetings_1to1;
DROP POLICY IF EXISTS "meetings participants" ON public.meetings_1to1;
CREATE POLICY "meetings participants read" ON public.meetings_1to1 FOR SELECT USING (
  public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    public.meetings_visible(event_id) AND (
      auth.uid() = empresa_user_id OR auth.uid() = sponsor_user_id
      OR public.same_account(auth.uid(), empresa_user_id)
      OR public.same_account(auth.uid(), sponsor_user_id)
    )
  )
);

CREATE OR REPLACE FUNCTION public.notify_meeting_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_type text; n_title text; n_body text;
BEGIN
  IF NOT public.meetings_visible(NEW.event_id) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.scheduled_time IS NULL THEN RETURN NEW; END IF;
    n_type := 'meeting_assigned';
    n_title := 'Reunión 1to1 programada';
    n_body := to_char(NEW.scheduled_time AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI') || ' · ' || COALESCE(NEW.room, 'sala por confirmar');
  ELSE
    IF (NEW.scheduled_time IS DISTINCT FROM OLD.scheduled_time)
       OR (NEW.room IS DISTINCT FROM OLD.room)
       OR (NEW.status IS DISTINCT FROM OLD.status) THEN
      IF OLD.scheduled_time IS NULL AND NEW.scheduled_time IS NOT NULL THEN
        n_type := 'meeting_assigned'; n_title := 'Reunión 1to1 programada';
      ELSE
        n_type := 'meeting_updated'; n_title := 'Tu reunión 1to1 ha cambiado';
      END IF;
      n_body := COALESCE(to_char(NEW.scheduled_time AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI'), 'pendiente') || ' · ' || COALESCE(NEW.room, 'sala por confirmar');
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (NEW.empresa_user_id, n_type, n_title, n_body, '/empresa/reuniones-1to1'),
    (NEW.sponsor_user_id, n_type, n_title, n_body, '/sponsor/reuniones-1to1');
  RETURN NEW;
END $$;