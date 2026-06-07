ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS times_correct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_answered integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_response_ms bigint NOT NULL DEFAULT 0;