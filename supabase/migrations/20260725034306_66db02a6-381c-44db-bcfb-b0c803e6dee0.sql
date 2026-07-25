ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS content_rating text NOT NULL DEFAULT 'pg13';

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_content_rating_check;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_content_rating_check
  CHECK (content_rating IN ('pg', 'pg13', 'ma'));

UPDATE public.questions SET content_rating = 'ma'
  WHERE category = 'Adults Only';
UPDATE public.questions SET content_rating = 'pg'
  WHERE category = 'Kids';
UPDATE public.questions SET content_rating = 'pg13'
  WHERE content_rating NOT IN ('pg','ma') AND category NOT IN ('Adults Only','Kids');

CREATE INDEX IF NOT EXISTS questions_content_rating_idx
  ON public.questions (content_rating);