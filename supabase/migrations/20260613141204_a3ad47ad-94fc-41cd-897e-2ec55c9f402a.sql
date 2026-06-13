ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS asym_votes jsonb;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS asym_phase_ends_at timestamptz;