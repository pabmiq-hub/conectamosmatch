
-- 1. Tighten profiles read: drop broad authed-read policy
DROP POLICY IF EXISTS "profiles authed read basic" ON public.profiles;

-- Allow reading profiles of teammates within the same account (needed by team UIs)
CREATE POLICY "profiles same account read"
ON public.profiles
FOR SELECT
TO authenticated
USING (account_id IS NOT NULL AND account_id = public.my_account_id());

-- 2. Split empresa_profiles write: team can INSERT/UPDATE, only owner can DELETE
DROP POLICY IF EXISTS "empresa account write" ON public.empresa_profiles;

CREATE POLICY "empresa account insert"
ON public.empresa_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR id = public.my_account_id());

CREATE POLICY "empresa account update"
ON public.empresa_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR id = public.my_account_id())
WITH CHECK (auth.uid() = user_id OR id = public.my_account_id());

CREATE POLICY "empresa owner delete"
ON public.empresa_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 3. Same for sponsor_profiles
DROP POLICY IF EXISTS "sponsor account write" ON public.sponsor_profiles;

CREATE POLICY "sponsor account insert"
ON public.sponsor_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR id = public.my_account_id());

CREATE POLICY "sponsor account update"
ON public.sponsor_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR id = public.my_account_id())
WITH CHECK (auth.uid() = user_id OR id = public.my_account_id());

CREATE POLICY "sponsor owner delete"
ON public.sponsor_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Restrict logo bucket listing (public files still served via public URLs / CDN, but LIST is blocked)
DROP POLICY IF EXISTS "logos public read" ON storage.objects;

-- 5. Stop publishing 'matches' on realtime (unused on client, prevents leakage via change events)
ALTER PUBLICATION supabase_realtime DROP TABLE public.matches;
