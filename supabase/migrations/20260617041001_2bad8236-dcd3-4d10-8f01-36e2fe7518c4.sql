CREATE TABLE public.category_meta (
  name           text PRIMARY KEY,
  emoji          text NOT NULL DEFAULT '❓',
  off_by_default boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.category_meta TO anon, authenticated;
GRANT ALL    ON public.category_meta TO service_role;

ALTER TABLE public.category_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read category meta"
  ON public.category_meta
  FOR SELECT
  USING (true);

INSERT INTO public.category_meta (name, emoji, off_by_default) VALUES
  ('General Knowledge', '🧠', false),
  ('Movies',            '🎬', false),
  ('Movie Sci-Fi',      '🚀', false),
  ('TV Shows',          '📺', false),
  ('Music',             '🎵', false),
  ('80''s Music',       '🎸', false),
  ('Sports',            '⚽', false),
  ('Science',           '🔬', false),
  ('Geography',         '🌍', false),
  ('History',           '📜', false),
  ('Chapter & Verse',   '📖', false),
  ('Kids',              '🧒', true)
ON CONFLICT (name) DO NOTHING;