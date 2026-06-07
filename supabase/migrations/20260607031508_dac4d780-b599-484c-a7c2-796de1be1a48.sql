ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS comeback_bonus boolean NOT NULL DEFAULT false;

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS sudden_death_session_ids text[] NOT NULL DEFAULT '{}'::text[];