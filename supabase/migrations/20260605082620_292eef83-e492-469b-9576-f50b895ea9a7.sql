DROP TRIGGER IF EXISTS trg_enforce_like_limit ON public.likes;
DROP FUNCTION IF EXISTS public.enforce_like_limit();
UPDATE public.events SET max_likes_per_user = 0 WHERE max_likes_per_user IS DISTINCT FROM 0;
ALTER TABLE public.events ALTER COLUMN max_likes_per_user SET DEFAULT 0;