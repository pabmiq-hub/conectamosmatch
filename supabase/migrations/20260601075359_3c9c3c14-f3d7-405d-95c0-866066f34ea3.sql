ALTER TABLE public.meetings_1to1 ALTER COLUMN duration_minutes SET DEFAULT 15;
UPDATE public.meetings_1to1 SET duration_minutes = 15 WHERE duration_minutes = 30 OR duration_minutes IS NULL;
ALTER TABLE public.events ALTER COLUMN slot_duration_minutes SET DEFAULT 15;
UPDATE public.events SET slot_duration_minutes = 15 WHERE slot_duration_minutes = 30;