
-- Phase 5: wildcards, glitch, roast, end-of-game stats
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS wildcard text,
  ADD COLUMN IF NOT EXISTS saboteur_session_id text,
  ADD COLUMN IF NOT EXISTS glitch_active_until timestamptz,
  ADD COLUMN IF NOT EXISTS glitch_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS roast_candidates jsonb;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS correct_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wrong_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fastest_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_response_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS answered_count integer NOT NULL DEFAULT 0;
