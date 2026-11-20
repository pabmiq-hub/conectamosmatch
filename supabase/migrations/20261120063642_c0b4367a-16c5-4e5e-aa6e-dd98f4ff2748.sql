CREATE OR REPLACE FUNCTION public.check_and_create_match() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fr public.app_role; tr public.app_role; fa uuid; ta uuid; ea uuid; sa uuid; eu uuid; su uuid; en text; sn text; mid uuid; was_mutual boolean;
BEGIN
 SELECT role, account_id INTO fr,fa FROM public.profiles WHERE id=NEW.from_user_id;
 SELECT role, account_id INTO tr,ta FROM public.profiles WHERE id=NEW.to_user_id;
 IF fr='empresa' AND tr='sponsor' THEN ea:=fa; sa:=ta;
 ELSIF fr='sponsor' AND tr='empresa' THEN ea:=ta; sa:=fa;
 ELSE RETURN NEW; END IF;
 IF ea IS NULL OR sa IS NULL THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('match:'||coalesce(NEW.event_id::text,'global')||':'||ea::text||':'||sa::text,0));
 IF NOT EXISTS (SELECT 1 FROM public.likes l JOIN public.profiles f ON f.id=l.from_user_id JOIN public.profiles t ON t.id=l.to_user_id WHERE l.event_id IS NOT DISTINCT FROM NEW.event_id AND f.account_id=ea AND t.account_id=sa AND f.role='empresa' AND t.role='sponsor')
 OR NOT EXISTS (SELECT 1 FROM public.likes l JOIN public.profiles f ON f.id=l.from_user_id JOIN public.profiles t ON t.id=l.to_user_id WHERE l.event_id IS NOT DISTINCT FROM NEW.event_id AND f.account_id=sa AND t.account_id=ea AND f.role='sponsor' AND t.role='empresa') THEN RETURN NEW; END IF;
 SELECT p.id INTO eu FROM public.profiles p LEFT JOIN public.empresa_profiles a ON a.id=p.account_id WHERE p.account_id=ea AND p.role='empresa' AND p.is_active IS NOT FALSE ORDER BY (p.id=a.user_id) DESC NULLS LAST,(p.account_role='owner') DESC,p.created_at,p.id LIMIT 1;
 SELECT p.id INTO su FROM public.profiles p LEFT JOIN public.sponsor_profiles a ON a.id=p.account_id WHERE p.account_id=sa AND p.role='sponsor' AND p.is_active IS NOT FALSE ORDER BY (p.id=a.user_id) DESC NULLS LAST,(p.account_role='owner') DESC,p.created_at,p.id LIMIT 1;
 SELECT company_name INTO en FROM public.empresa_profiles WHERE id=ea;
 SELECT company_name INTO sn FROM public.sponsor_profiles WHERE id=sa;
 SELECT id,status='mutual' INTO mid,was_mutual FROM public.matches WHERE empresa_account_id=ea AND sponsor_account_id=sa AND event_id IS NOT DISTINCT FROM NEW.event_id ORDER BY created_at,id LIMIT 1;
 IF mid IS NULL THEN
 INSERT INTO public.matches(empresa_account_id,sponsor_account_id,empresa_user_id,sponsor_user_id,event_id,status,matched_at) VALUES(ea,sa,eu,su,NEW.event_id,'mutual',now()) RETURNING id INTO mid;
 ELSE
 UPDATE public.matches SET status='mutual',matched_at=coalesce(matched_at,now()),empresa_user_id=coalesce(empresa_user_id,eu),sponsor_user_id=coalesce(sponsor_user_id,su) WHERE id=mid;
 END IF;
 IF coalesce(was_mutual,false) THEN RETURN NEW; END IF;
 INSERT INTO public.notifications(user_id,type,title,body,link)
 SELECT p.id,'new_match',CASE WHEN p.account_id=ea THEN '¡Nuevo match con '||coalesce(sn,'una solución')||'!' ELSE '¡Nuevo match con '||coalesce(en,'una empresa')||'!' END,'Revisa tus matches',CASE WHEN p.account_id=ea THEN '/empresa/mis-matches' ELSE '/sponsor/mis-matches' END FROM public.profiles p WHERE p.account_id IN(ea,sa) AND p.is_active IS NOT FALSE;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.notify_like_received() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE fa uuid; ta uuid; fr public.app_role; tr public.app_role; company text;
BEGIN
 SELECT account_id,role INTO fa,fr FROM public.profiles WHERE id=NEW.from_user_id;
 SELECT account_id,role INTO ta,tr FROM public.profiles WHERE id=NEW.to_user_id;
 IF fa IS NULL OR ta IS NULL OR NOT ((fr='empresa' AND tr='sponsor') OR (fr='sponsor' AND tr='empresa')) THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM public.likes l JOIN public.profiles f ON f.id=l.from_user_id JOIN public.profiles t ON t.id=l.to_user_id WHERE l.id<>NEW.id AND l.event_id IS NOT DISTINCT FROM NEW.event_id AND f.account_id=fa AND t.account_id=ta) THEN RETURN NEW; END IF;
 IF fr='empresa' THEN SELECT company_name INTO company FROM public.empresa_profiles WHERE id=fa; ELSE SELECT company_name INTO company FROM public.sponsor_profiles WHERE id=fa; END IF;
 INSERT INTO public.notifications(user_id,type,title,body,link) SELECT p.id,'like_received','Alguien se ha interesado por tu cuenta',coalesce(company,'Una cuenta')||' ha mostrado interés en tu cuenta',CASE WHEN tr='sponsor' THEN '/sponsor/me-han-seleccionado' ELSE '/empresa/ver-sponsors' END FROM public.profiles p WHERE p.account_id=ta AND p.is_active IS NOT FALSE;
 RETURN NEW;
END $$;
-- Preserve every scheduled/manual meeting, but remove automatically generated empty drafts from invalid matches.
CREATE TEMP TABLE invalid_selection_matches ON COMMIT DROP AS SELECT m.id FROM public.matches m WHERE m.status='mutual' AND m.empresa_account_id IS NOT NULL AND m.sponsor_account_id IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM public.likes l JOIN public.profiles f ON f.id=l.from_user_id JOIN public.profiles t ON t.id=l.to_user_id WHERE l.event_id IS NOT DISTINCT FROM m.event_id AND f.account_id=m.empresa_account_id AND t.account_id=m.sponsor_account_id AND f.role='empresa' AND t.role='sponsor') OR NOT EXISTS(SELECT 1 FROM public.likes l JOIN public.profiles f ON f.id=l.from_user_id JOIN public.profiles t ON t.id=l.to_user_id WHERE l.event_id IS NOT DISTINCT FROM m.event_id AND f.account_id=m.sponsor_account_id AND t.account_id=m.empresa_account_id AND f.role='sponsor' AND t.role='empresa'));
DELETE FROM public.meetings_1to1 WHERE match_id IN(SELECT id FROM invalid_selection_matches) AND scheduled_time IS NULL AND status='pending' AND assigned_by IS NULL AND room IS NULL AND notes IS NULL AND slot IS NULL AND bloque IS NULL AND tipo_match IS NULL;
UPDATE public.meetings_1to1 SET match_id=NULL WHERE match_id IN(SELECT id FROM invalid_selection_matches);
DELETE FROM public.matches WHERE id IN(SELECT id FROM invalid_selection_matches);
-- Do not delete historical notifications: they cannot be attributed reliably to individual matches.
REVOKE ALL ON FUNCTION public.check_and_create_match() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.notify_like_received() FROM PUBLIC,anon,authenticated;