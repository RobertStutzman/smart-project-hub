ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS final_wager integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_answer integer,
  ADD COLUMN IF NOT EXISTS final_locked_at timestamptz;