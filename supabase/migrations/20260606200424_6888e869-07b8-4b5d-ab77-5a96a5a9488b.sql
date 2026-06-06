-- 1. Loosen slot constraint (slot now means "folder" — free-form)
ALTER TABLE public.sound_clips DROP CONSTRAINT IF EXISTS sound_clips_slot_check;

-- 2. Add new columns
ALTER TABLE public.sound_clips
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'misc',
  ADD COLUMN IF NOT EXISTS audience_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_filename text;

-- Backfill category from existing slot for any old rows
UPDATE public.sound_clips SET category = slot WHERE category = 'misc';

CREATE INDEX IF NOT EXISTS sound_clips_category_idx ON public.sound_clips(category);
CREATE INDEX IF NOT EXISTS sound_clips_audience_idx ON public.sound_clips(audience_visible) WHERE audience_visible = true;

-- 3. Folders table (so empty folders persist + renames work cleanly)
CREATE TABLE IF NOT EXISTS public.sound_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sound_folders TO anon, authenticated;
GRANT ALL ON public.sound_folders TO service_role;

ALTER TABLE public.sound_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY sound_folders_select_all ON public.sound_folders FOR SELECT USING (true);
CREATE POLICY sound_folders_admin_insert ON public.sound_folders FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY sound_folders_admin_update ON public.sound_folders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY sound_folders_admin_delete ON public.sound_folders FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default folders
INSERT INTO public.sound_folders (name, sort_order) VALUES
  ('Lobby', 10),
  ('Stings', 20),
  ('Correct', 30),
  ('Wrong', 40),
  ('Reveal', 50),
  ('Leaderboard', 60),
  ('Final', 70),
  ('Victory', 80),
  ('Audience FX', 90)
ON CONFLICT (name) DO NOTHING;

-- 4. Event assignments
CREATE TABLE IF NOT EXISTS public.sound_event_assignments (
  event text PRIMARY KEY,
  clip_id uuid REFERENCES public.sound_clips(id) ON DELETE SET NULL,
  volume real NOT NULL DEFAULT 0.8,
  loop boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sound_event_assignments TO anon, authenticated;
GRANT ALL ON public.sound_event_assignments TO service_role;

ALTER TABLE public.sound_event_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY sea_select_all ON public.sound_event_assignments FOR SELECT USING (true);
CREATE POLICY sea_admin_insert ON public.sound_event_assignments FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY sea_admin_update ON public.sound_event_assignments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY sea_admin_delete ON public.sound_event_assignments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed the 8 known events with empty assignments + sensible defaults
INSERT INTO public.sound_event_assignments (event, volume, loop) VALUES
  ('lobby_music', 0.5, true),
  ('round_intro', 0.9, false),
  ('correct',     0.8, false),
  ('wrong',       0.8, false),
  ('reveal',      0.9, false),
  ('leaderboard', 0.7, false),
  ('final',       0.9, false),
  ('victory',     1.0, false)
ON CONFLICT (event) DO NOTHING;