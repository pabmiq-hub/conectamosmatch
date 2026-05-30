
-- Convert sponsor_profiles.sponsorship_level from enum to text with a CHECK constraint
ALTER TABLE public.sponsor_profiles
  ALTER COLUMN sponsorship_level TYPE text USING sponsorship_level::text;

UPDATE public.sponsor_profiles
SET sponsorship_level = CASE
  WHEN sponsorship_level = 'BRONZE' THEN 'STARTUP'
  WHEN sponsorship_level = 'SILVER' THEN 'BASIC'
  WHEN sponsorship_level = 'PLATINUM' THEN 'GOLD'
  ELSE sponsorship_level
END
WHERE sponsorship_level IN ('BRONZE','SILVER','PLATINUM');

ALTER TABLE public.sponsor_profiles
  ALTER COLUMN sponsorship_level SET DEFAULT 'BASIC';

ALTER TABLE public.sponsor_profiles
  DROP CONSTRAINT IF EXISTS sponsor_profiles_sponsorship_level_check;

ALTER TABLE public.sponsor_profiles
  ADD CONSTRAINT sponsor_profiles_sponsorship_level_check
  CHECK (sponsorship_level IN ('GOLD','PREMIUM','BASIC','STARTUP'));

DROP TYPE IF EXISTS public.sponsor_level_t;
