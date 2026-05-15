-- 1. Dedupe existing matches (keep earliest)
DELETE FROM public.matches a USING public.matches b
WHERE a.id > b.id
  AND a.empresa_user_id = b.empresa_user_id
  AND a.sponsor_user_id = b.sponsor_user_id
  AND a.event_id IS NOT DISTINCT FROM b.event_id;

-- 2. Replace unique constraint/index so NULL event_id is also deduped
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_empresa_user_id_sponsor_user_id_event_id_key;
DROP INDEX IF EXISTS public.matches_unique_pair_event;
CREATE UNIQUE INDEX matches_unique_pair_event
  ON public.matches (empresa_user_id, sponsor_user_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 3. Update check_and_create_match: existence-check, idempotent, no duplicate notifications
CREATE OR REPLACE FUNCTION public.check_and_create_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  reverse_exists boolean;
  from_role app_role;
  to_role app_role;
  emp_id uuid;
  spo_id uuid;
  emp_name text;
  spo_name text;
  ev_limit integer;
  emp_count integer;
  spo_count integer;
  pair_count integer;
  new_match_id uuid;
  existing_match RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.likes
    WHERE from_user_id = NEW.to_user_id AND to_user_id = NEW.from_user_id
      AND event_id IS NOT DISTINCT FROM NEW.event_id
  ) INTO reverse_exists;
  IF NOT reverse_exists THEN RETURN NEW; END IF;

  SELECT role INTO from_role FROM public.profiles WHERE id = NEW.from_user_id;
  SELECT role INTO to_role FROM public.profiles WHERE id = NEW.to_user_id;

  IF from_role = 'empresa' AND to_role = 'sponsor' THEN
    emp_id := NEW.from_user_id; spo_id := NEW.to_user_id;
  ELSIF from_role = 'sponsor' AND to_role = 'empresa' THEN
    emp_id := NEW.to_user_id; spo_id := NEW.from_user_id;
  ELSE RETURN NEW; END IF;

  -- If a match already exists for this pair+event, just refresh status; do NOT notify again
  SELECT * INTO existing_match FROM public.matches
   WHERE empresa_user_id = emp_id AND sponsor_user_id = spo_id
     AND event_id IS NOT DISTINCT FROM NEW.event_id
   LIMIT 1;

  IF existing_match.id IS NOT NULL THEN
    UPDATE public.matches SET status = 'mutual', matched_at = COALESCE(matched_at, now())
      WHERE id = existing_match.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.matches (empresa_user_id, sponsor_user_id, event_id, status, matched_at)
  VALUES (emp_id, spo_id, NEW.event_id, 'mutual', now())
  RETURNING id INTO new_match_id;

  SELECT company_name INTO emp_name FROM public.empresa_profiles WHERE user_id = emp_id;
  SELECT company_name INTO spo_name FROM public.sponsor_profiles WHERE user_id = spo_id;

  IF NEW.event_id IS NOT NULL THEN
    SELECT meetings_per_user INTO ev_limit FROM public.events WHERE id = NEW.event_id;
    IF ev_limit IS NULL THEN ev_limit := 8; END IF;
    SELECT COUNT(*) INTO pair_count FROM public.meetings_1to1
      WHERE empresa_user_id = emp_id AND sponsor_user_id = spo_id AND event_id = NEW.event_id;
    SELECT COUNT(*) INTO emp_count FROM public.meetings_1to1
      WHERE empresa_user_id = emp_id AND event_id = NEW.event_id AND status <> 'cancelled';
    SELECT COUNT(*) INTO spo_count FROM public.meetings_1to1
      WHERE sponsor_user_id = spo_id AND event_id = NEW.event_id AND status <> 'cancelled';
    IF pair_count = 0 AND emp_count < ev_limit AND spo_count < ev_limit THEN
      INSERT INTO public.meetings_1to1 (empresa_user_id, sponsor_user_id, event_id, match_id, status)
      VALUES (emp_id, spo_id, NEW.event_id, new_match_id, 'pending')
      ON CONFLICT (empresa_user_id, sponsor_user_id, event_id) DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
    (emp_id, 'new_match', '¡Nuevo match con ' || COALESCE(spo_name,'un sponsor') || '!', 'Ya puedes escribirle desde Mensajes', '/empresa/mensajes?with=' || spo_id::text),
    (spo_id, 'new_match', '¡Nuevo match con ' || COALESCE(emp_name,'una empresa') || '!', 'Ya puedes escribirle desde Mensajes', '/sponsor/mensajes?with=' || emp_id::text);

  RETURN NEW;
END $function$;

-- 4. When a like is removed, drop the corresponding match (the other side never gets notified)
CREATE OR REPLACE FUNCTION public.remove_match_on_unlike()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE emp_id uuid; spo_id uuid; from_role app_role; to_role app_role;
BEGIN
  SELECT role INTO from_role FROM public.profiles WHERE id = OLD.from_user_id;
  SELECT role INTO to_role FROM public.profiles WHERE id = OLD.to_user_id;
  IF from_role = 'empresa' AND to_role = 'sponsor' THEN
    emp_id := OLD.from_user_id; spo_id := OLD.to_user_id;
  ELSIF from_role = 'sponsor' AND to_role = 'empresa' THEN
    emp_id := OLD.to_user_id; spo_id := OLD.from_user_id;
  ELSE RETURN OLD; END IF;

  DELETE FROM public.matches
   WHERE empresa_user_id = emp_id AND sponsor_user_id = spo_id
     AND event_id IS NOT DISTINCT FROM OLD.event_id;
  RETURN OLD;
END $function$;

DROP TRIGGER IF EXISTS likes_remove_match ON public.likes;
CREATE TRIGGER likes_remove_match
AFTER DELETE ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.remove_match_on_unlike();