
-- 1) Add account-level columns to matches & meetings
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS empresa_account_id uuid,
  ADD COLUMN IF NOT EXISTS sponsor_account_id uuid;

ALTER TABLE public.meetings_1to1
  ADD COLUMN IF NOT EXISTS empresa_account_id uuid,
  ADD COLUMN IF NOT EXISTS sponsor_account_id uuid;

-- 2) Backfill from existing user → account_id
UPDATE public.matches m
SET empresa_account_id = COALESCE(m.empresa_account_id, pe.account_id),
    sponsor_account_id = COALESCE(m.sponsor_account_id, ps.account_id)
FROM public.profiles pe, public.profiles ps
WHERE pe.id = m.empresa_user_id AND ps.id = m.sponsor_user_id;

UPDATE public.meetings_1to1 m
SET empresa_account_id = COALESCE(m.empresa_account_id, pe.account_id),
    sponsor_account_id = COALESCE(m.sponsor_account_id, ps.account_id)
FROM public.profiles pe, public.profiles ps
WHERE pe.id = m.empresa_user_id AND ps.id = m.sponsor_user_id;

-- 3) Deduplicate any existing matches by (account, account, event), keep oldest
DELETE FROM public.matches m
USING public.matches m2
WHERE m.empresa_account_id IS NOT NULL
  AND m.sponsor_account_id IS NOT NULL
  AND m.empresa_account_id = m2.empresa_account_id
  AND m.sponsor_account_id = m2.sponsor_account_id
  AND m.event_id IS NOT DISTINCT FROM m2.event_id
  AND m.created_at > m2.created_at;

-- 4) Unique constraints at account level (only when both account ids present)
CREATE UNIQUE INDEX IF NOT EXISTS matches_account_pair_event_uq
  ON public.matches (empresa_account_id, sponsor_account_id, event_id)
  WHERE empresa_account_id IS NOT NULL AND sponsor_account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS meetings_account_pair_event_uq
  ON public.meetings_1to1 (empresa_account_id, sponsor_account_id, event_id)
  WHERE empresa_account_id IS NOT NULL AND sponsor_account_id IS NOT NULL;

-- 5) Rewrite check_and_create_match: account-level
CREATE OR REPLACE FUNCTION public.check_and_create_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  from_role app_role;
  to_role   app_role;
  from_account uuid;
  to_account   uuid;
  emp_account uuid;
  spo_account uuid;
  emp_owner uuid;
  spo_owner uuid;
  emp_name text;
  spo_name text;
  reverse_exists boolean;
  ev_meetings_limit integer;
  emp_count integer;
  spo_count integer;
  new_match_id uuid;
  existing_match RECORD;
BEGIN
  SELECT role, account_id INTO from_role, from_account FROM public.profiles WHERE id = NEW.from_user_id;
  SELECT role, account_id INTO to_role,   to_account   FROM public.profiles WHERE id = NEW.to_user_id;

  IF from_role = 'empresa' AND to_role = 'sponsor' THEN
    emp_account := from_account; spo_account := to_account;
  ELSIF from_role = 'sponsor' AND to_role = 'empresa' THEN
    emp_account := to_account;   spo_account := from_account;
  ELSE
    RETURN NEW;
  END IF;

  IF emp_account IS NULL OR spo_account IS NULL THEN
    RETURN NEW;
  END IF;

  -- Reverse like check: ANY member of opposite account liked ANY member of this account
  SELECT EXISTS (
    SELECT 1
      FROM public.likes l
      JOIN public.profiles pf ON pf.id = l.from_user_id
      JOIN public.profiles pt ON pt.id = l.to_user_id
     WHERE l.event_id IS NOT DISTINCT FROM NEW.event_id
       AND (
         (pf.account_id = spo_account AND pt.account_id = emp_account)
       )
  ) INTO reverse_exists;
  IF NOT reverse_exists THEN
    -- Also accept when current like is the empresa side and a sponsor liked first
    SELECT EXISTS (
      SELECT 1
        FROM public.likes l
        JOIN public.profiles pf ON pf.id = l.from_user_id
        JOIN public.profiles pt ON pt.id = l.to_user_id
       WHERE l.event_id IS NOT DISTINCT FROM NEW.event_id
         AND (pf.account_id = emp_account AND pt.account_id = spo_account)
    ) INTO reverse_exists;
    IF NOT reverse_exists THEN RETURN NEW; END IF;
  END IF;

  -- Pick representative owners
  SELECT user_id, company_name INTO emp_owner, emp_name FROM public.empresa_profiles WHERE id = emp_account;
  SELECT user_id, company_name INTO spo_owner, spo_name FROM public.sponsor_profiles WHERE id = spo_account;

  -- Find existing account-level match
  SELECT * INTO existing_match FROM public.matches
   WHERE empresa_account_id = emp_account
     AND sponsor_account_id = spo_account
     AND event_id IS NOT DISTINCT FROM NEW.event_id
   LIMIT 1;

  IF existing_match.id IS NOT NULL THEN
    UPDATE public.matches
       SET status = 'mutual',
           matched_at = COALESCE(matched_at, now())
     WHERE id = existing_match.id;
    new_match_id := existing_match.id;
  ELSE
    INSERT INTO public.matches (empresa_user_id, sponsor_user_id, empresa_account_id, sponsor_account_id, event_id, status, matched_at)
    VALUES (emp_owner, spo_owner, emp_account, spo_account, NEW.event_id, 'mutual', now())
    RETURNING id INTO new_match_id;
  END IF;

  -- Account-level meeting: only one per (emp_account, spo_account, event)
  IF NEW.event_id IS NOT NULL THEN
    SELECT meetings_per_user INTO ev_meetings_limit FROM public.events WHERE id = NEW.event_id;
    IF ev_meetings_limit IS NULL THEN ev_meetings_limit := 8; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.meetings_1to1
       WHERE empresa_account_id = emp_account
         AND sponsor_account_id = spo_account
         AND event_id = NEW.event_id
    ) THEN
      SELECT COUNT(*) INTO emp_count FROM public.meetings_1to1
        WHERE empresa_account_id = emp_account AND event_id = NEW.event_id AND status <> 'cancelled';
      SELECT COUNT(*) INTO spo_count FROM public.meetings_1to1
        WHERE sponsor_account_id = spo_account AND event_id = NEW.event_id AND status <> 'cancelled';
      IF emp_count < ev_meetings_limit AND spo_count < ev_meetings_limit THEN
        INSERT INTO public.meetings_1to1 (empresa_user_id, sponsor_user_id, empresa_account_id, sponsor_account_id, event_id, match_id, status)
        VALUES (emp_owner, spo_owner, emp_account, spo_account, NEW.event_id, new_match_id, 'pending')
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- Notify every active member of both accounts (deduped by account-level match)
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT p.id,
         'new_match',
         CASE WHEN p.account_id = emp_account
              THEN '¡Nuevo match con ' || COALESCE(spo_name,'una solución') || '!'
              ELSE '¡Nuevo match con ' || COALESCE(emp_name,'una empresa') || '!' END,
         'Revisa tus matches',
         CASE WHEN p.account_id = emp_account THEN '/empresa/mis-matches' ELSE '/sponsor/mis-matches' END
    FROM public.profiles p
   WHERE p.account_id IN (emp_account, spo_account)
     AND p.is_active IS NOT FALSE
     AND NOT EXISTS (
       SELECT 1 FROM public.notifications n
        WHERE n.user_id = p.id AND n.type = 'new_match'
          AND n.created_at > now() - interval '10 seconds'
     );

  RETURN NEW;
END
$function$;

-- 6) Rewrite remove_match_on_unlike: only delete when ALL cross-account likes are gone
CREATE OR REPLACE FUNCTION public.remove_match_on_unlike()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  from_role app_role;
  to_role   app_role;
  from_account uuid;
  to_account   uuid;
  emp_account uuid;
  spo_account uuid;
  still_emp_to_spo boolean;
  still_spo_to_emp boolean;
BEGIN
  SELECT role, account_id INTO from_role, from_account FROM public.profiles WHERE id = OLD.from_user_id;
  SELECT role, account_id INTO to_role,   to_account   FROM public.profiles WHERE id = OLD.to_user_id;

  IF from_role = 'empresa' AND to_role = 'sponsor' THEN
    emp_account := from_account; spo_account := to_account;
  ELSIF from_role = 'sponsor' AND to_role = 'empresa' THEN
    emp_account := to_account;   spo_account := from_account;
  ELSE
    RETURN OLD;
  END IF;

  IF emp_account IS NULL OR spo_account IS NULL THEN RETURN OLD; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.likes l
      JOIN public.profiles pf ON pf.id = l.from_user_id
      JOIN public.profiles pt ON pt.id = l.to_user_id
     WHERE l.event_id IS NOT DISTINCT FROM OLD.event_id
       AND pf.account_id = emp_account AND pt.account_id = spo_account
  ) INTO still_emp_to_spo;

  SELECT EXISTS (
    SELECT 1 FROM public.likes l
      JOIN public.profiles pf ON pf.id = l.from_user_id
      JOIN public.profiles pt ON pt.id = l.to_user_id
     WHERE l.event_id IS NOT DISTINCT FROM OLD.event_id
       AND pf.account_id = spo_account AND pt.account_id = emp_account
  ) INTO still_spo_to_emp;

  -- A mutual account-level match requires likes in both directions
  IF still_emp_to_spo AND still_spo_to_emp THEN
    RETURN OLD;
  END IF;

  DELETE FROM public.meetings_1to1
   WHERE empresa_account_id = emp_account
     AND sponsor_account_id = spo_account
     AND event_id IS NOT DISTINCT FROM OLD.event_id;

  DELETE FROM public.matches
   WHERE empresa_account_id = emp_account
     AND sponsor_account_id = spo_account
     AND event_id IS NOT DISTINCT FROM OLD.event_id;

  RETURN OLD;
END
$function$;
