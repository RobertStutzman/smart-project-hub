ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS content_rating text NOT NULL DEFAULT 'pg13';

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_content_rating_check;
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_content_rating_check
  CHECK (content_rating IN ('pg', 'pg13', 'ma'));