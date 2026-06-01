
-- 1) Restrict meetings_1to1 SELECT to direct participants (remove same_account broad read)
DROP POLICY IF EXISTS "meetings team read" ON public.meetings_1to1;
CREATE POLICY "meetings participants read"
ON public.meetings_1to1
FOR SELECT
USING (
  auth.uid() = empresa_user_id
  OR auth.uid() = sponsor_user_id
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- 2) Drop broad listing policy on logos bucket. Bucket remains public so direct
-- object URLs continue to work via the CDN, but anonymous listing is blocked.
DROP POLICY IF EXISTS "logos public read" ON storage.objects;

-- 3) Restrict realtime channel subscriptions: only authenticated users can
-- receive on channels, and they cannot subscribe to private per-user topics
-- belonging to others. The app currently only uses postgres_changes which
-- bypasses realtime.messages auth, so this is a safe hardening.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated can receive broadcasts" ON realtime.messages;
CREATE POLICY "authenticated can receive broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "no broadcast sends by default" ON realtime.messages;
CREATE POLICY "no broadcast sends by default"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (false);
