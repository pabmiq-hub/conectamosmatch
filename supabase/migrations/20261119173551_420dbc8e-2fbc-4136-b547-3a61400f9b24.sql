CREATE OR REPLACE FUNCTION public.reto_admin_add_participants(_event uuid, _users uuid[])
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.reto_config WHERE event_id = _event) THEN
    RAISE EXCEPTION 'Este evento no tiene Reto 2.700';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reto_config WHERE event_id = _event AND is_closed) THEN
    RAISE EXCEPTION 'El Reto está cerrado: reábrelo para cambiar participantes';
  END IF;
  INSERT INTO public.reto_participants (event_id, user_id, participant_type, account_id, display_name, cargo, company_name, photo_url)
  SELECT _event, p.id,
         CASE WHEN p.role = 'sponsor' THEN 'sponsor' ELSE 'drh' END,
         COALESCE(p.account_id, acc.id),
         COALESCE(NULLIF(trim(p.full_name), ''), p.email, 'Sin nombre'),
         CASE WHEN lower(trim(coalesce(p.cargo,''))) IN ('', 'empresa', 'sponsor', 'solución', 'solucion') THEN NULL ELSE p.cargo END,
         COALESCE(NULLIF(acc.company_name, 'Mi Empresa'), NULLIF(trim(reg.attendee_company), ''), acc.company_name),
         COALESCE(p.avatar_url, acc.logo_url)
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT x.id, x.company_name, x.logo_url FROM (
      SELECT e.id, e.company_name, e.logo_url, (e.id = p.account_id) AS pri FROM public.empresa_profiles e
       WHERE p.role = 'empresa' AND (e.id = p.account_id OR e.user_id = p.id)
      UNION ALL
      SELECT s.id, s.company_name, s.logo_url, (s.id = p.account_id) FROM public.sponsor_profiles s
       WHERE p.role = 'sponsor' AND (s.id = p.account_id OR s.user_id = p.id)
    ) x ORDER BY x.pri DESC, (x.company_name = 'Mi Empresa') ASC LIMIT 1) acc ON true
  LEFT JOIN LATERAL (
    SELECT r.attendee_company FROM public.event_registrations r
     WHERE r.event_id = _event AND r.user_id = p.id ORDER BY r.registered_at DESC NULLS LAST LIMIT 1) reg ON true
  WHERE p.id = ANY(_users) AND p.role IN ('empresa', 'sponsor')
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name, cargo = EXCLUDED.cargo, photo_url = EXCLUDED.photo_url,
        account_id = EXCLUDED.account_id,
        company_name = EXCLUDED.company_name
    WHERE reto_participants.company_name IS DISTINCT FROM EXCLUDED.company_name
       OR reto_participants.display_name IS DISTINCT FROM EXCLUDED.display_name
       OR reto_participants.cargo IS DISTINCT FROM EXCLUDED.cargo
       OR reto_participants.photo_url IS DISTINCT FROM EXCLUDED.photo_url
       OR reto_participants.account_id IS DISTINCT FROM EXCLUDED.account_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.reto_recalc_event_internal(_event);
  RETURN n;
END $function$;

-- Corregir datos actuales
UPDATE public.reto_participants rp
SET company_name = fix.name, account_id = COALESCE(fix.acc_id, rp.account_id)
FROM (
  SELECT rp2.event_id, rp2.user_id, p.account_id AS acc_id,
    COALESCE(NULLIF(COALESCE(ep.company_name, sp.company_name), 'Mi Empresa'),
      (SELECT NULLIF(trim(r.attendee_company), '') FROM public.event_registrations r
        WHERE r.event_id = rp2.event_id AND r.user_id = rp2.user_id ORDER BY r.registered_at DESC NULLS LAST LIMIT 1)) AS name
  FROM public.reto_participants rp2
  JOIN public.profiles p ON p.id = rp2.user_id
  LEFT JOIN public.empresa_profiles ep ON ep.id = p.account_id
  LEFT JOIN public.sponsor_profiles sp ON sp.id = p.account_id
  WHERE rp2.company_name IS NULL OR rp2.company_name = 'Mi Empresa'
) fix
WHERE rp.event_id = fix.event_id AND rp.user_id = fix.user_id AND fix.name IS NOT NULL;

UPDATE public.reto_participants SET cargo = NULL
WHERE lower(trim(coalesce(cargo,''))) IN ('empresa', 'sponsor', 'solución', 'solucion') ;