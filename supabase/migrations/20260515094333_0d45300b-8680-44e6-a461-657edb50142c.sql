
CREATE OR REPLACE FUNCTION public.check_and_create_match()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  INSERT INTO public.matches (empresa_user_id, sponsor_user_id, event_id, status, matched_at)
  VALUES (emp_id, spo_id, NEW.event_id, 'mutual', now())
  ON CONFLICT (empresa_user_id, sponsor_user_id, event_id) DO UPDATE
    SET status = 'mutual', matched_at = now()
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
END $$;
