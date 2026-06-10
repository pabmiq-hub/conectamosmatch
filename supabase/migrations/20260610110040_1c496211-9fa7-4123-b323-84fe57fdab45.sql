DROP INDEX IF EXISTS public.meetings_account_pair_event_uq;
DROP INDEX IF EXISTS public.meetings_unique_pair_event;
CREATE UNIQUE INDEX IF NOT EXISTS meetings_1to1_unique_pair_event
  ON public.meetings_1to1 (empresa_user_id, sponsor_user_id, event_id);