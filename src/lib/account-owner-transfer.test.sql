-- Transactional integration test: no changes to real accounts survive this block.
DO $$
DECLARE acc uuid; target uuid; previous uuid; total integer;
BEGIN
  SELECT account_id INTO acc FROM public.profiles
  WHERE role IN ('empresa','sponsor') AND account_id IS NOT NULL AND is_active IS NOT FALSE
  GROUP BY account_id HAVING count(*) >= 2 ORDER BY account_id LIMIT 1;
  IF acc IS NULL THEN RAISE EXCEPTION 'Se necesitan dos miembros activos para comprobar la transferencia'; END IF;
  SELECT id INTO previous FROM public.profiles WHERE account_id=acc AND account_role='owner' ORDER BY id LIMIT 1;
  SELECT id INTO target FROM public.profiles WHERE account_id=acc AND is_active IS NOT FALSE AND id IS DISTINCT FROM previous ORDER BY id LIMIT 1;
  BEGIN
    PERFORM public.transfer_account_owner_atomic(target);
    SELECT count(*) INTO total FROM public.profiles WHERE account_id=acc AND account_role='owner';
    IF total <> 1 THEN RAISE EXCEPTION 'Debe haber exactamente un administrador por cuenta'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=target AND account_role='owner') THEN RAISE EXCEPTION 'La persona elegida no es administradora'; END IF;
    IF previous IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=previous AND account_role='owner') THEN RAISE EXCEPTION 'El administrador anterior no debe seguir siendo administrador'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.empresa_profiles WHERE id=acc AND user_id=target UNION ALL SELECT 1 FROM public.sponsor_profiles WHERE id=acc AND user_id=target) THEN RAISE EXCEPTION 'El administrador debe estar vinculado a su cuenta'; END IF;
    PERFORM public.transfer_account_owner_atomic(target);
    IF (SELECT count(*) FROM public.profiles WHERE account_id=acc AND account_role='owner') <> 1 THEN RAISE EXCEPTION 'Repetir la transferencia no debe crear otro administrador'; END IF;
    RAISE EXCEPTION USING ERRCODE='Z2702', MESSAGE='Prueba correcta: deshacer todos los cambios de prueba';
  EXCEPTION WHEN SQLSTATE 'Z2702' THEN NULL;
  END;
END $$;