CREATE OR REPLACE FUNCTION public.notify_like_received()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  reverse_exists boolean;
  receiver_role app_role;
  sender_role app_role;
  receiver_account uuid;
  sender_company_name text;
  link_path text;
  title_text text;
  body_text text;
BEGIN
  -- If a mutual already exists, the match trigger handles its own notification
  SELECT EXISTS (
    SELECT 1 FROM public.likes
     WHERE from_user_id = NEW.to_user_id
       AND to_user_id   = NEW.from_user_id
       AND event_id IS NOT DISTINCT FROM NEW.event_id
  ) INTO reverse_exists;
  IF reverse_exists THEN RETURN NEW; END IF;

  SELECT role, account_id INTO receiver_role, receiver_account FROM public.profiles WHERE id = NEW.to_user_id;
  SELECT role INTO sender_role FROM public.profiles WHERE id = NEW.from_user_id;

  -- Resolve sender's company name for nicer messaging
  IF sender_role = 'empresa' THEN
    SELECT ep.company_name INTO sender_company_name
      FROM public.profiles p
      JOIN public.empresa_profiles ep ON ep.id = p.account_id
     WHERE p.id = NEW.from_user_id;
  ELSIF sender_role = 'sponsor' THEN
    SELECT sp.company_name INTO sender_company_name
      FROM public.profiles p
      JOIN public.sponsor_profiles sp ON sp.id = p.account_id
     WHERE p.id = NEW.from_user_id;
  END IF;

  IF receiver_role = 'empresa' THEN
    link_path := '/empresa/ver-sponsors';
  ELSIF receiver_role = 'sponsor' THEN
    link_path := '/sponsor/ver-empresas';
  ELSE
    link_path := NULL;
  END IF;

  title_text := 'Alguien se ha interesado por tu perfil';
  IF sender_company_name IS NOT NULL AND length(sender_company_name) > 0 THEN
    body_text := sender_company_name || ' ha mostrado interés en tu cuenta';
  ELSE
    body_text := 'Revisa el directorio para descubrir quién';
  END IF;

  -- Notify ALL active members of the receiving account so the whole empresa/solución
  -- is informed when any of its responsables receives a like. Fallback to the
  -- direct recipient when the account is not linked.
  IF receiver_account IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT p.id, 'like_received', title_text, body_text, link_path
      FROM public.profiles p
     WHERE p.account_id = receiver_account
       AND p.is_active IS NOT FALSE;
  ELSE
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.to_user_id, 'like_received', title_text, body_text, link_path);
  END IF;

  RETURN NEW;
END
$function$;