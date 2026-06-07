
CREATE TABLE public.tts_cache (
  text_hash text PRIMARY KEY,
  preset text NOT NULL,
  text text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  hit_count integer NOT NULL DEFAULT 0
);

GRANT ALL ON public.tts_cache TO service_role;

ALTER TABLE public.tts_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY tts_cache_no_client_access
  ON public.tts_cache FOR ALL
  USING (false)
  WITH CHECK (false);

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS tts_calls_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tts_cap_started_at timestamptz;
