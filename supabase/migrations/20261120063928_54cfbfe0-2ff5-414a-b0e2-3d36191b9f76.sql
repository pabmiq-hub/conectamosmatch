DO $$
DECLARE eu uuid; su uuid; ea uuid; sa uuid; ev uuid; n integer; expected integer;
BEGIN
 SELECT id,account_id INTO eu,ea FROM public.profiles WHERE role='empresa' AND account_id IS NOT NULL AND is_active IS NOT FALSE ORDER BY id LIMIT 1;
 SELECT id,account_id INTO su,sa FROM public.profiles WHERE role='sponsor' AND account_id IS NOT NULL AND is_active IS NOT FALSE ORDER BY id LIMIT 1;
 IF eu IS NULL OR su IS NULL THEN RAISE EXCEPTION 'Faltan cuentas para comprobar la reciprocidad'; END IF;
 BEGIN
 INSERT INTO public.events(title,status,is_active) VALUES('TEST reciprocidad de selecciones','draft',false) RETURNING id INTO ev;
 INSERT INTO public.likes(from_user_id,to_user_id,event_id) VALUES(su,eu,ev);
 SELECT count(*) INTO n FROM public.matches WHERE event_id=ev;
 IF n<>0 THEN RAISE EXCEPTION 'Un interés unilateral creó un match'; END IF;
 SELECT count(*) INTO n FROM public.notifications WHERE type='like_received' AND user_id IN(SELECT id FROM public.profiles WHERE account_id=ea AND is_active IS NOT FALSE) AND body=(SELECT company_name||' ha mostrado interés en tu cuenta' FROM public.sponsor_profiles WHERE id=sa) AND created_at>=transaction_timestamp();
 SELECT count(*) INTO expected FROM public.profiles WHERE account_id=ea AND is_active IS NOT FALSE;
 IF n<expected THEN RAISE EXCEPTION 'Falta aviso de interés a los miembros de empresa'; END IF;
 INSERT INTO public.likes(from_user_id,to_user_id,event_id) VALUES(eu,su,ev);
 SELECT count(*) INTO n FROM public.matches WHERE event_id=ev AND status='mutual' AND empresa_account_id=ea AND sponsor_account_id=sa AND empresa_user_id IS NOT NULL AND sponsor_user_id IS NOT NULL;
 IF n<>1 THEN RAISE EXCEPTION 'El interés recíproco no creó exactamente un match con responsables'; END IF;
 SELECT count(*) INTO expected FROM public.profiles WHERE account_id IN(ea,sa) AND is_active IS NOT FALSE;
 SELECT count(*) INTO n FROM public.notifications WHERE type='new_match' AND user_id IN(SELECT id FROM public.profiles WHERE account_id IN(ea,sa) AND is_active IS NOT FALSE) AND created_at>=transaction_timestamp();
 IF n<expected THEN RAISE EXCEPTION 'Faltan avisos de match a los equipos'; END IF;
 RAISE EXCEPTION USING ERRCODE='Z2701', MESSAGE='Prueba correcta: revertir datos aislados';
 EXCEPTION WHEN SQLSTATE 'Z2701' THEN NULL;
 END;
END $$;