ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS team_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS team text;

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_team_check;
ALTER TABLE public.players
  ADD CONSTRAINT players_team_check CHECK (team IS NULL OR team IN ('red','blue'));