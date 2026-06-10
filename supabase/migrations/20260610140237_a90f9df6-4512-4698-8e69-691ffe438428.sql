ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS difficulty_mode text;
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_difficulty_mode_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_difficulty_mode_check CHECK (difficulty_mode IS NULL OR difficulty_mode IN ('easy','medium','hard','impossible'));