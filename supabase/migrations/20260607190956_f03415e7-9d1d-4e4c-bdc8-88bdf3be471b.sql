ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS explanation_tts_path text,
  ADD COLUMN IF NOT EXISTS explanation_tts_text_hash text;

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS current_explanation_tts_url text;