CREATE OR REPLACE FUNCTION public.transfer_account_owner_atomic(_target uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE acc uuid; kind public.app_role;
BEGIN
 SELECT account_id,role INTO acc,kind FROM public.profiles WHERE id=_target;
 IF acc IS NULL OR kind NOT IN ('empresa','sponsor') THEN RAISE EXCEPTION 'La persona no pertenece a una empresa o solución'; END IF;
 IF kind='empresa' THEN PERFORM id FROM public.empresa_profiles WHERE id=acc FOR UPDATE; ELSE PERFORM id FROM public.sponsor_profiles WHERE id=acc FOR UPDATE; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cuenta no encontrada'; END IF;
 PERFORM id FROM public.profiles WHERE account_id=acc ORDER BY id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_target AND account_id=acc AND role=kind AND is_active IS NOT FALSE) THEN RAISE EXCEPTION 'La persona ya no pertenece a esta cuenta o está inactiva'; END IF;
 UPDATE public.profiles SET account_role='manager' WHERE account_id=acc AND account_role='owner' AND id<>_target;
 UPDATE public.profiles SET account_role='owner' WHERE id=_target AND account_id=acc;
 IF kind='empresa' THEN UPDATE public.empresa_profiles SET user_id=_target WHERE id=acc; ELSE UPDATE public.sponsor_profiles SET user_id=_target WHERE id=acc; END IF;
 IF (SELECT count(*) FROM public.profiles WHERE account_id=acc AND account_role='owner')<>1 THEN RAISE EXCEPTION 'La cuenta debe tener exactamente un administrador'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.transfer_account_owner_atomic(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_account_owner_atomic(uuid) TO service_role;