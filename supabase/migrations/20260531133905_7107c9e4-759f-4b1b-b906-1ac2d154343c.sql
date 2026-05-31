
DROP TRIGGER IF EXISTS on_like_created ON public.likes;

CREATE OR REPLACE FUNCTION public.check_and_create_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  from_role app_role;
  to_role   app_role;
  from_account uuid;
  to_account   uuid;
  emp_account uuid; spo_account uuid;
  emp_user uuid;    spo_user uuid;
  emp_name text;    spo_name text;
  reverse_like_id uuid;
  ev_meetings_limit integer;
  emp_count integer; spo_count integer;
  new_match_id uuid;
  existing_match RECORD;
BEGIN
  SELECT role, account_id INTO from_role, from_account FROM public.profiles WHERE id = NEW.from_user_id;
  SELECT role, account_id INTO to_role,   to_account   FROM public.profiles WHERE id = NEW.to_user_id;

  IF from_role = 'empresa' AND to_role = 'sponsor' THEN
    emp_account := from_account; spo_account := to_account;
    emp_user := NEW.from_user_id; spo_user := NEW.to_user_id;
  ELSIF from_role = 'sponsor' AND to_role = 'empresa' THEN
    emp_account := to_account;   spo_account := from_account;
    emp_user := NEW.to_user_id;  spo_user := NEW.from_user_id;
  ELSE
    RETURN NEW;
  END IF;

  IF emp_account IS NULL OR spo_account IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mutual = a like in the OPPOSITE direction between the same two individuals (excluding NEW)
  SELECT l.id INTO reverse_like_id
    FROM public.likes l
   WHERE l.id <> NEW.id
     AND l.event_id IS NOT DISTINCT FROM NEW.event_id
     AND l.from_user_id = NEW.to_user_id
     AND l.to_user_id   = NEW.from_user_id
   LIMIT 1;

  IF reverse_like_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT company_name INTO emp_name FROM public.empresa_profiles WHERE id = emp_account;
  SELECT company_name INTO spo_name FROM public.sponsor_profiles WHERE id = spo_account;

  -- Individualized match: one per (empresa_user, sponsor_user, event)
  SELECT * INTO existing_match FROM public.matches
   WHERE empresa_user_id = emp_user
     AND sponsor_user_id = spo_user
     AND event_id IS NOT DISTINCT FROM NEW.event_id
   LIMIT 1;

  IF existing_match.id IS NOT NULL THEN
    UPDATE public.matches
       SET status = 'mutual', matched_at = COALESCE(matched_at, now())
     WHERE id = existing_match.id;
    new_match_id := existing_match.id;
  ELSE
    INSERT INTO public.matches (empresa_user_id, sponsor_user_id, empresa_account_id, sponsor_account_id, event_id, status, matched_at)
    VALUES (emp_user, spo_user, emp_account, spo_account, NEW.event_id, 'mutual', now())
    RETURNING id INTO new_match_id;
  END IF;

  -- Individualized meeting: one per pair of responsables per event
  IF NEW.event_id IS NOT NULL THEN
    SELECT meetings_per_user INTO ev_meetings_limit FROM public.events WHERE id = NEW.event_id;
    IF ev_meetings_limit IS NULL THEN ev_meetings_limit := 8; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.meetings_1to1
       WHERE empresa_user_id = emp_user
         AND sponsor_user_id = spo_user
         AND event_id = NEW.event_id
    ) THEN
      SELECT COUNT(*) INTO emp_count FROM public.meetings_1to1
        WHERE empresa_user_id = emp_user AND event_id = NEW.event_id AND status <> 'cancelled';
      SELECT COUNT(*) INTO spo_count FROM public.meetings_1to1
        WHERE sponsor_user_id = spo_user AND event_id = NEW.event_id AND status <> 'cancelled';
      IF emp_count < ev_meetings_limit AND spo_count < ev_meetings_limit THEN
        INSERT INTO public.meetings_1to1 (empresa_user_id, sponsor_user_id, empresa_account_id, sponsor_account_id, event_id, match_id, status)
        VALUES (emp_user, spo_user, emp_account, spo_account, NEW.event_id, new_match_id, 'pending')
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES
    (emp_user, 'match', '💛 ¡Nuevo match!', 'Has hecho match con ' || COALESCE(spo_name, 'una solución'), '/empresa/mis-matches'),
    (spo_user, 'match', '💛 ¡Nuevo match!', 'Has hecho match con ' || COALESCE(emp_name, 'una empresa'), '/sponsor/mis-matches');

  RETURN NEW;
END;
$$;
