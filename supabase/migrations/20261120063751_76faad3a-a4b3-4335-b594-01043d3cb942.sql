DROP POLICY IF EXISTS "matches account members read" ON public.matches;
CREATE POLICY "matches account members read" ON public.matches FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.is_active IS NOT FALSE AND p.account_id IN (matches.empresa_account_id,matches.sponsor_account_id)));
-- Ensure a trigger exists, without adding a second invocation when one is already installed.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.likes'::regclass AND tgfoid='public.check_and_create_match()'::regprocedure AND NOT tgisinternal) THEN
 CREATE TRIGGER selections_create_account_match AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.check_and_create_match();
 END IF;
END $$;
WITH directions AS (
 SELECT DISTINCT l.event_id,f.account_id AS ea,t.account_id AS sa FROM public.likes l JOIN public.profiles f ON f.id=l.from_user_id JOIN public.profiles t ON t.id=l.to_user_id WHERE f.role='empresa' AND t.role='sponsor' AND f.account_id IS NOT NULL AND t.account_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.likes r JOIN public.profiles rf ON rf.id=r.from_user_id JOIN public.profiles rt ON rt.id=r.to_user_id WHERE r.event_id IS NOT DISTINCT FROM l.event_id AND rf.account_id=t.account_id AND rt.account_id=f.account_id AND rf.role='sponsor' AND rt.role='empresa')
)
INSERT INTO public.matches(empresa_account_id,sponsor_account_id,empresa_user_id,sponsor_user_id,event_id,status,matched_at)
SELECT d.ea,d.sa,e.id,s.id,d.event_id,'mutual',now() FROM directions d
JOIN LATERAL (SELECT id FROM public.profiles WHERE account_id=d.ea AND role='empresa' AND is_active IS NOT FALSE ORDER BY (account_role='owner') DESC,created_at,id LIMIT 1) e ON true
JOIN LATERAL (SELECT id FROM public.profiles WHERE account_id=d.sa AND role='sponsor' AND is_active IS NOT FALSE ORDER BY (account_role='owner') DESC,created_at,id LIMIT 1) s ON true
WHERE NOT EXISTS(SELECT 1 FROM public.matches m WHERE m.empresa_account_id=d.ea AND m.sponsor_account_id=d.sa AND m.event_id IS NOT DISTINCT FROM d.event_id) ON CONFLICT DO NOTHING;
UPDATE public.matches m SET empresa_user_id=coalesce(m.empresa_user_id,(SELECT id FROM public.profiles WHERE account_id=m.empresa_account_id AND role='empresa' AND is_active IS NOT FALSE ORDER BY (account_role='owner') DESC,created_at,id LIMIT 1)),sponsor_user_id=coalesce(m.sponsor_user_id,(SELECT id FROM public.profiles WHERE account_id=m.sponsor_account_id AND role='sponsor' AND is_active IS NOT FALSE ORDER BY (account_role='owner') DESC,created_at,id LIMIT 1)) WHERE m.empresa_user_id IS NULL OR m.sponsor_user_id IS NULL;