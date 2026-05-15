
-- 1. Likes cap per event
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS max_likes_per_user integer NOT NULL DEFAULT 20;

CREATE OR REPLACE FUNCTION public.enforce_like_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap integer; used integer;
BEGIN
  IF NEW.event_id IS NULL THEN RETURN NEW; END IF;
  SELECT max_likes_per_user INTO cap FROM public.events WHERE id = NEW.event_id;
  IF cap IS NULL OR cap <= 0 THEN RETURN NEW; END IF;
  SELECT count(*) INTO used FROM public.likes WHERE from_user_id = NEW.from_user_id AND event_id = NEW.event_id;
  IF used >= cap THEN
    RAISE EXCEPTION 'Has alcanzado el límite de % likes para este evento', cap USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_like_limit ON public.likes;
CREATE TRIGGER trg_enforce_like_limit BEFORE INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.enforce_like_limit();

-- 2. Like received notification (anonymous, skip if it becomes a mutual match)
CREATE OR REPLACE FUNCTION public.notify_like_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reverse_exists boolean; receiver_role app_role; link_path text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.likes WHERE from_user_id = NEW.to_user_id AND to_user_id = NEW.from_user_id
      AND event_id IS NOT DISTINCT FROM NEW.event_id
  ) INTO reverse_exists;
  IF reverse_exists THEN RETURN NEW; END IF; -- match flow handles its own notification
  SELECT role INTO receiver_role FROM public.profiles WHERE id = NEW.to_user_id;
  IF receiver_role = 'empresa' THEN link_path := '/empresa/ver-sponsors';
  ELSIF receiver_role = 'sponsor' THEN link_path := '/sponsor/ver-empresas';
  ELSE link_path := NULL; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.to_user_id, 'like_received', 'Alguien se ha interesado por tu perfil', 'Revisa el directorio para descubrir quién', link_path);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_like_received ON public.likes;
CREATE TRIGGER trg_notify_like_received AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.notify_like_received();

-- 3. New message notification
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender_name text; receiver_role app_role; link_path text;
BEGIN
  SELECT role INTO receiver_role FROM public.profiles WHERE id = NEW.to_user_id;
  SELECT COALESCE(ep.company_name, sp.company_name, p.full_name, 'alguien')
    INTO sender_name
  FROM public.profiles p
  LEFT JOIN public.empresa_profiles ep ON ep.user_id = p.id
  LEFT JOIN public.sponsor_profiles sp ON sp.user_id = p.id
  WHERE p.id = NEW.from_user_id;
  IF receiver_role = 'empresa' THEN link_path := '/empresa/mensajes?with=' || NEW.from_user_id::text;
  ELSIF receiver_role = 'sponsor' THEN link_path := '/sponsor/mensajes?with=' || NEW.from_user_id::text;
  ELSE link_path := NULL; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.to_user_id, 'new_message', 'Nuevo mensaje de ' || sender_name, left(NEW.content, 120), link_path);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- 4. Meeting assigned / updated notification
CREATE OR REPLACE FUNCTION public.notify_meeting_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_type text; n_title text; n_body text;
BEGIN
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

DROP TRIGGER IF EXISTS trg_notify_meeting_change ON public.meetings_1to1;
CREATE TRIGGER trg_notify_meeting_change AFTER INSERT OR UPDATE ON public.meetings_1to1
FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_change();

-- 5. Bulletin post notification (fan-out to all authenticated users)
CREATE OR REPLACE FUNCTION public.notify_bulletin_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p.id,
         'bulletin_new',
         'Nuevo anuncio: ' || NEW.title,
         left(NEW.content, 140),
         CASE WHEN p.role = 'empresa' THEN '/empresa/tablon'
              WHEN p.role = 'sponsor' THEN '/sponsor/tablon'
              ELSE '/admin/tablon' END
  FROM public.profiles p
  WHERE p.is_active IS NOT FALSE AND p.id <> COALESCE(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_bulletin_post ON public.bulletin_posts;
CREATE TRIGGER trg_notify_bulletin_post AFTER INSERT ON public.bulletin_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_bulletin_post();

-- 6. Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
