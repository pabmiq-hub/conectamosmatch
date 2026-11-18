ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS empresa_min_likes integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS empresa_max_likes integer,
  ADD COLUMN IF NOT EXISTS sponsor_max_likes integer,
  ADD COLUMN IF NOT EXISTS likes_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS empresa_max_meetings integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS sponsor_default_max_meetings integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS sponsor_meetings_by_level jsonb NOT NULL DEFAULT '{"PLATINUM":12,"GOLD":8,"SILVER":4}'::jsonb,
  ADD COLUMN IF NOT EXISTS meeting_windows jsonb NOT NULL DEFAULT '[]'::jsonb;