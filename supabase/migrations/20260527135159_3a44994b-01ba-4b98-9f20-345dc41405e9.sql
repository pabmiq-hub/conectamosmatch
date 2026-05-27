
CREATE TYPE public.responsable_request_status_t AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE public.responsable_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('empresa','sponsor')),
  requested_by uuid NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  status public.responsable_request_status_t NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_responsable_requests_account ON public.responsable_requests(account_id);
CREATE INDEX idx_responsable_requests_status ON public.responsable_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsable_requests TO authenticated;
GRANT ALL ON public.responsable_requests TO service_role;

ALTER TABLE public.responsable_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "req read account members"
ON public.responsable_requests FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR account_id = public.my_account_id()
);

CREATE POLICY "req insert owner"
ON public.responsable_requests FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND account_id = public.my_account_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND account_role = 'owner'
  )
);

CREATE POLICY "req cancel own"
ON public.responsable_requests FOR UPDATE TO authenticated
USING (
  requested_by = auth.uid() AND status = 'pending'
)
WITH CHECK (
  requested_by = auth.uid()
);

CREATE POLICY "req admin all"
ON public.responsable_requests FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
