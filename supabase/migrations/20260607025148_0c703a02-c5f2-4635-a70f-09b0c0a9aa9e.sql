CREATE TABLE public.tts_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid,
  preset text NOT NULL,
  text_hash text NOT NULL,
  char_count int NOT NULL DEFAULT 0,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tts_call_log_created_idx ON public.tts_call_log (created_at DESC);
CREATE INDEX tts_call_log_room_idx ON public.tts_call_log (room_id, created_at DESC);
GRANT ALL ON public.tts_call_log TO service_role;
ALTER TABLE public.tts_call_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tts_call_log_no_client_access ON public.tts_call_log FOR ALL USING (false) WITH CHECK (false);