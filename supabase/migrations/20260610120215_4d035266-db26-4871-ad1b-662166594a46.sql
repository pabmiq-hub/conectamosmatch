DROP POLICY IF EXISTS "meetings participants read" ON public.meetings_1to1;

CREATE POLICY "meetings participants read"
ON public.meetings_1to1
FOR SELECT
USING (
  auth.uid() = empresa_user_id
  OR auth.uid() = sponsor_user_id
  OR public.same_account(auth.uid(), empresa_user_id)
  OR public.same_account(auth.uid(), sponsor_user_id)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);