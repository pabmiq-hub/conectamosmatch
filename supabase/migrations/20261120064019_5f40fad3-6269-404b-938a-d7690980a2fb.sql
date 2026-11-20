CREATE OR REPLACE FUNCTION public.remove_match_on_unlike() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE fa uuid; ta uuid; fr public.app_role; tr public.app_role; ea uuid; sa uuid;
BEGIN
 SELECT role,account_id INTO fr,fa FROM public.profiles WHERE id=OLD.from_user_id;
 SELECT role,account_id INTO tr,ta FROM public.profiles WHERE id=OLD.to_user_id;
 IF fr='empresa' AND tr='sponsor' THEN ea:=fa; sa:=ta; ELSIF fr='sponsor' AND tr='empresa' THEN ea:=ta; sa:=fa; ELSE RETURN OLD; END IF;
 IF ea IS NULL OR sa IS NULL THEN RETURN OLD; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('match:'||coalesce(OLD.event_id::text,'global')||':'||ea::text||':'||sa::text,0));
 IF EXISTS(SELECT 1 FROM public.likes l JOIN public.profiles f ON f.id=l.from_user_id JOIN public.profiles t ON t.id=l.to_user_id WHERE l.event_id IS NOT DISTINCT FROM OLD.event_id AND f.account_id=ea AND t.account_id=sa AND f.role='empresa' AND t.role='sponsor') AND EXISTS(SELECT 1 FROM public.likes l JOIN public.profiles f ON f.id=l.from_user_id JOIN public.profiles t ON t.id=l.to_user_id WHERE l.event_id IS NOT DISTINCT FROM OLD.event_id AND f.account_id=sa AND t.account_id=ea AND f.role='sponsor' AND t.role='empresa') THEN RETURN OLD; END IF;
 DELETE FROM public.meetings_1to1 mt WHERE mt.match_id IN(SELECT id FROM public.matches WHERE empresa_account_id=ea AND sponsor_account_id=sa AND event_id IS NOT DISTINCT FROM OLD.event_id) AND mt.scheduled_time IS NULL AND mt.status='pending' AND mt.assigned_by IS NULL AND mt.room IS NULL AND mt.notes IS NULL AND mt.slot IS NULL AND mt.bloque IS NULL AND mt.tipo_match IS NULL;
 UPDATE public.meetings_1to1 SET match_id=NULL WHERE match_id IN(SELECT id FROM public.matches WHERE empresa_account_id=ea AND sponsor_account_id=sa AND event_id IS NOT DISTINCT FROM OLD.event_id);
 DELETE FROM public.matches WHERE empresa_account_id=ea AND sponsor_account_id=sa AND event_id IS NOT DISTINCT FROM OLD.event_id;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.remove_match_on_unlike() FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS "matches participants" ON public.matches;
DROP POLICY IF EXISTS "matches account members read" ON public.matches;
DROP POLICY IF EXISTS "matches admin all" ON public.matches;
CREATE POLICY "matches participants" ON public.matches FOR SELECT TO authenticated USING (auth.uid() IN(empresa_user_id,sponsor_user_id) OR public.has_role(auth.uid(),'super_admin') OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active IS NOT FALSE AND p.account_id IN(matches.empresa_account_id,matches.sponsor_account_id)));
CREATE POLICY "matches admin insert" ON public.matches FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "matches admin update" ON public.matches FOR UPDATE TO authenticated USING(public.has_role(auth.uid(),'super_admin')) WITH CHECK(public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "matches admin delete" ON public.matches FOR DELETE TO authenticated USING(public.has_role(auth.uid(),'super_admin'));