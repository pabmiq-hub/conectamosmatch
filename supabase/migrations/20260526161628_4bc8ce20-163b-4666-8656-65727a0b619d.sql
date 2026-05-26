
-- ============================================================
-- Multi-responsable model
-- ============================================================

-- 1. Profiles: account membership
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS account_role text NOT NULL DEFAULT 'owner';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_role_check
  CHECK (account_role IN ('owner','manager'));

CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON public.profiles(account_id);

-- 2. Helper functions
CREATE OR REPLACE FUNCTION public.my_account_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.same_account(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pa
    JOIN public.profiles pb ON pb.account_id = pa.account_id
    WHERE pa.id = _a AND pb.id = _b AND pa.account_id IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.account_id_of(_user uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.profiles WHERE id = _user
$$;

-- 3. Backfill: each existing empresa/sponsor primary user becomes 'owner'
-- account_id = the empresa_profile / sponsor_profile id
UPDATE public.profiles p
SET account_id = ep.id, account_role = 'owner'
FROM public.empresa_profiles ep
WHERE ep.user_id = p.id AND (p.account_id IS NULL);

UPDATE public.profiles p
SET account_id = sp.id, account_role = 'owner'
FROM public.sponsor_profiles sp
WHERE sp.user_id = p.id AND (p.account_id IS NULL);

-- 4. RLS: allow teammates to edit shared account profile
DROP POLICY IF EXISTS "empresa self write" ON public.empresa_profiles;
CREATE POLICY "empresa account write"
ON public.empresa_profiles
FOR ALL
USING (auth.uid() = user_id OR id = public.my_account_id())
WITH CHECK (auth.uid() = user_id OR id = public.my_account_id());

DROP POLICY IF EXISTS "sponsor self write" ON public.sponsor_profiles;
CREATE POLICY "sponsor account write"
ON public.sponsor_profiles
FOR ALL
USING (auth.uid() = user_id OR id = public.my_account_id())
WITH CHECK (auth.uid() = user_id OR id = public.my_account_id());

-- 5. RLS: teammates can read meetings of their account members (read-only)
DROP POLICY IF EXISTS "meetings team read" ON public.meetings_1to1;
CREATE POLICY "meetings team read"
ON public.meetings_1to1
FOR SELECT
USING (
  auth.uid() = empresa_user_id
  OR auth.uid() = sponsor_user_id
  OR public.same_account(auth.uid(), empresa_user_id)
  OR public.same_account(auth.uid(), sponsor_user_id)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);
DROP POLICY IF EXISTS "meetings participants" ON public.meetings_1to1;
