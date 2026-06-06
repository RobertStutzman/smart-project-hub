ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS tts_path text,
  ADD COLUMN IF NOT EXISTS tts_text_hash text;