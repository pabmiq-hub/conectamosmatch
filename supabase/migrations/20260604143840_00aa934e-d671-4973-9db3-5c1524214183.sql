ALTER TABLE public.meetings_1to1
  ADD COLUMN IF NOT EXISTS empresa_responsable jsonb,
  ADD COLUMN IF NOT EXISTS sponsor_responsable jsonb;