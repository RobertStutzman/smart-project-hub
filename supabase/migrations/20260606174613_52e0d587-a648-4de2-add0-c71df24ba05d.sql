ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium';
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_difficulty_check;
ALTER TABLE public.questions ADD CONSTRAINT questions_difficulty_check CHECK (difficulty IN ('easy','medium','hard','impossible'));
CREATE INDEX IF NOT EXISTS questions_difficulty_idx ON public.questions (difficulty, category, is_premium);