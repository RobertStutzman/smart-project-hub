ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS times_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

CREATE INDEX IF NOT EXISTS questions_rotation_idx
  ON public.questions (category, difficulty, times_used, last_used_at NULLS FIRST);