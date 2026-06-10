ALTER TABLE public.meetings_1to1
  ADD COLUMN IF NOT EXISTS slot text,
  ADD COLUMN IF NOT EXISTS bloque text,
  ADD COLUMN IF NOT EXISTS tipo_sponsor text,
  ADD COLUMN IF NOT EXISTS tipo_match text;